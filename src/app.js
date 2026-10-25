const crypto = require('crypto');
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const { v4: uuid } = require('uuid');
const { COUNTRIES, normalizePhone, toProviderMsisdn, calculateFees, MIN_AMOUNT, EBILLING_PAID_STATE, EBILLING_FAILED_STATE, EBILLING_EXPIRED_STATE, EBILLING_AMBIGUOUS_STATE, assertPaymentSystemMatches } = require('./config');
const { query, withTransaction } = require('./db');
const { hashPassword, verifyPassword, issueToken, setSession, requireAuth, recordAttempt, isLocked } = require('./auth');
const { createBill, ussdPush, getBill, shapPayout } = require('./providers');

const app = express();
app.set('trust proxy', 1);
app.use(helmet());
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, '..', 'public')));
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false });
const valid = (req, res, next) => { const errors = validationResult(req); if (!errors.isEmpty()) return res.status(400).json({ error: 'Données invalides' }); return next(); };
const sameSecret = (provided, expected) => { if (!provided || !expected) return false; const a = Buffer.from(provided); const b = Buffer.from(expected); return a.length === b.length && crypto.timingSafeEqual(a, b); };

app.get('/health', (req, res) => res.json({ status: 'ok', environment: process.env.NODE_ENV || 'development' }));
app.get('/api/countries', (req, res) => res.json(COUNTRIES));

app.post('/api/auth/register', [body('nom').trim().isLength({ min: 2, max: 100 }), body('pays').isIn(Object.keys(COUNTRIES)), body('telephone').isNumeric(), body('password').isLength({ min: 8, max: 100 }), body('email').optional({ values: 'falsy' }).isEmail(), valid], async (req, res) => {
  try {
    const phone = normalizePhone(req.body.pays, req.body.telephone);
    const hash = await hashPassword(req.body.password);
    const result = await query('INSERT INTO users(nom,pays,telephone_international,email,mot_de_passe_hash) VALUES($1,$2,$3,$4,$5) RETURNING id,nom,pays,telephone_international,email', [req.body.nom, req.body.pays, phone, req.body.email || null, hash]);
    setSession(res, issueToken(result.rows[0]));
    return res.status(201).json({ user: result.rows[0] });
  } catch (error) { return res.status(400).json({ error: error.code === '23505' ? 'Compte déjà existant' : 'Inscription impossible' }); }
});

app.post('/api/auth/login', authLimiter, [body('password').isString().isLength({ min: 1 }), body('telephone').optional().isString(), body('email').optional().isEmail(), valid], async (req, res) => {
  try {
    let phone = req.body.telephone;
    if (phone && /^\d+$/.test(phone) && req.body.pays) phone = normalizePhone(req.body.pays, phone);
    const loginKey = phone || String(req.body.email || '').toLowerCase();
    if (loginKey && await isLocked(loginKey)) return res.status(429).json({ error: 'Trop de tentatives. Réessayez dans 15 minutes.' });
    const result = await query('SELECT * FROM users WHERE telephone_international=$1 OR lower(email)=lower($1)', [loginKey]);
    const user = result.rows[0];
    const validPassword = user && await verifyPassword(req.body.password, user.mot_de_passe_hash);
    if (loginKey) await recordAttempt(loginKey, !!validPassword);
    if (!validPassword) return res.status(401).json({ error: 'Identifiants invalides' });
    setSession(res, issueToken(user));
    return res.json({ user: { id: user.id, nom: user.nom, pays: user.pays, telephone_international: user.telephone_international, email: user.email } });
  } catch { return res.status(401).json({ error: 'Identifiants invalides' }); }
});
app.post('/api/auth/logout', (req, res) => { res.clearCookie('nexora_session'); return res.status(204).end(); });
app.get('/api/me', requireAuth, async (req, res) => { const result = await query('SELECT id,nom,pays,telephone_international,email FROM users WHERE id=$1', [req.user.sub]); return res.json({ user: result.rows[0] }); });
app.get('/api/wallet', requireAuth, async (req, res) => { const [balance, movements] = await Promise.all([query("SELECT COALESCE(SUM(CASE WHEN sens='credit' THEN montant ELSE -montant END),0)::int AS solde FROM ledger WHERE user_id=$1 AND statut='posted'", [req.user.sub]), query('SELECT sens,montant,type,reference,statut,created_at FROM ledger WHERE user_id=$1 ORDER BY created_at DESC LIMIT 20', [req.user.sub])]); return res.json({ solde: balance.rows[0].solde, operations: movements.rows }); });

app.post('/api/transfers/lookup', requireAuth, [body('pays').isIn(Object.keys(COUNTRIES)), body('telephone').isNumeric(), valid], async (req, res) => { try { const phone = normalizePhone(req.body.pays, req.body.telephone); const result = await query('SELECT id,nom,pays FROM users WHERE telephone_international=$1', [phone]); if (!result.rows[0]) return res.status(404).json({ error: 'Destinataire introuvable' }); return res.json({ recipient: result.rows[0] }); } catch { return res.status(400).json({ error: 'Numéro invalide' }); } });

app.post('/api/transfers', requireAuth, [body('recipientId').isUUID(), body('amount').isInt({ min: MIN_AMOUNT }), body('password').isString(), body('reference').optional().isUUID(), valid], async (req, res) => {
  try {
    if (req.body.recipientId === req.user.sub) return res.status(400).json({ error: 'Un envoi à soi-même est impossible' });
    const user = (await query('SELECT * FROM users WHERE id=$1', [req.user.sub])).rows[0];
    if (!await verifyPassword(req.body.password, user.mot_de_passe_hash)) return res.status(401).json({ error: 'Mot de passe invalide' });
    const reference = req.body.reference || uuid();
    const fees = calculateFees(req.body.amount);
    const result = await withTransaction(async (client) => {
      await client.query('SELECT id FROM users WHERE id=$1 FOR UPDATE', [req.user.sub]);
      if ((await client.query('SELECT reference FROM ledger WHERE reference=$1', [reference])).rows.length) return { idempotent: true };
      const balance = await client.query("SELECT COALESCE(SUM(CASE WHEN sens='credit' THEN montant ELSE -montant END),0)::int AS solde FROM ledger WHERE user_id=$1 AND statut='posted'", [req.user.sub]);
      if (Number(balance.rows[0].solde) < Number(req.body.amount) + fees) throw Object.assign(new Error('Solde insuffisant'), { status: 422 });
      if (!(await client.query('SELECT id FROM users WHERE id=$1', [req.body.recipientId])).rows.length) throw Object.assign(new Error('Destinataire introuvable'), { status: 404 });
      const debit = await client.query("INSERT INTO ledger(user_id,sens,montant,type,reference) VALUES($1,'debit',$2,'transfer',$3) RETURNING id", [req.user.sub, Number(req.body.amount) + fees, reference]);
      const credit = await client.query("INSERT INTO ledger(user_id,sens,montant,type,reference) VALUES($1,'credit',$2,'transfer',$3) RETURNING id", [req.body.recipientId, Number(req.body.amount), `${reference}:recipient`]);
      await client.query('INSERT INTO transfers(sender_ledger_id,recipient_ledger_id) VALUES($1,$2)', [debit.rows[0].id, credit.rows[0].id]);
      return { reference, fees, total: Number(req.body.amount) + fees };
    });
    return res.status(201).json(result);
  } catch (error) { return res.status(error.status || 400).json({ error: error.message || 'Envoi impossible' }); }
});

app.post('/api/recharges', requireAuth, [body('amount').isInt({ min: MIN_AMOUNT }), body('paymentSystem').isIn(['airtelmoney', 'moovmoney4', 'SIMU']), valid], async (req, res) => {
  try {
    if (req.body.paymentSystem === 'SIMU' && process.env.NODE_ENV === 'production') return res.status(400).json({ error: 'SIMU est interdit en production' });
    const user = (await query('SELECT * FROM users WHERE id=$1', [req.user.sub])).rows[0];
    if (!user.email) return res.status(400).json({ error: 'Ajoutez une adresse email à votre compte pour recharger' });
    if (req.body.paymentSystem !== 'SIMU') assertPaymentSystemMatches(user.telephone_international, req.body.paymentSystem);
    const reference = uuid();
    const fees = calculateFees(req.body.amount);
    const grossAmount = Number(req.body.amount) + fees;
    await query("INSERT INTO recharges(reference,statut,montant,frais,user_id) VALUES($1,'created',$2,$3,$4)", [reference, req.body.amount, fees, user.id]);
    const bill = await createBill({ amount: grossAmount, payerMsisdn: toProviderMsisdn(user.telephone_international), paymentSystem: req.body.paymentSystem, externalReference: reference, name: user.nom, email: user.email, description: 'Recharge Nexora Pay' });
    await query("UPDATE recharges SET statut='pending',ebilling_bill_id=$1 WHERE reference=$2", [bill.billId, reference]);
    await ussdPush({ billId: bill.billId, payerMsisdn: toProviderMsisdn(user.telephone_international), paymentSystem: req.body.paymentSystem });
    return res.status(201).json({ reference, status: 'pending', montant: Number(req.body.amount), frais: fees, total: grossAmount, message: 'Validez la demande sur votre téléphone' });
  } catch (error) { return res.status(400).json({ error: error.message || 'Recharge impossible' }); }
});
app.get('/api/recharges/:reference', requireAuth, async (req, res) => { const result = await query('SELECT reference,statut,montant,frais,(montant+frais) AS total,created_at,paid_at FROM recharges WHERE reference=$1 AND user_id=$2', [req.params.reference, req.user.sub]); if (!result.rows[0]) return res.status(404).json({ error: 'Recharge introuvable' }); return res.json(result.rows[0]); });

app.post('/api/webhooks/ebilling', async (req, res) => {
  if (!sameSecret(req.query.token, process.env.EBILLING_WEBHOOK_SECRET)) return res.status(401).json({ error: 'Webhook non autorisé' });
  const { reference, amount, billingid } = req.body;
  try {
    const result = await withTransaction(async (client) => {
      const recharge = (await client.query('SELECT * FROM recharges WHERE reference=$1 FOR UPDATE', [reference])).rows[0];
      if (!recharge || String(recharge.ebilling_bill_id) !== String(billingid)) throw Object.assign(new Error('Webhook incohérent'), { status: 422 });
      if (Number(recharge.montant) + Number(recharge.frais) !== Number(amount)) throw Object.assign(new Error('Montant webhook incohérent'), { status: 422 });
      if (recharge.statut === 'paid') return { idempotent: true };
      const bill = await getBill(recharge.ebilling_bill_id);
      const billId = bill.bill_id || bill.e_bill?.bill_id || bill.id;
      const billStatus = bill.status || bill.state;
      const billAmount = bill.amount ?? bill.e_bill?.amount;
      if (String(billId) !== String(recharge.ebilling_bill_id) || Number(billAmount) !== Number(recharge.montant) + Number(recharge.frais)) throw Object.assign(new Error('Facture E-Billing incohérente'), { status: 422 });
      const terminalStatuses = new Map([[EBILLING_FAILED_STATE, 'failed'], [EBILLING_EXPIRED_STATE, 'expired'], [EBILLING_AMBIGUOUS_STATE, 'ambiguous']]);
      if (terminalStatuses.has(billStatus)) {
        await client.query('UPDATE recharges SET statut=$1 WHERE reference=$2', [terminalStatuses.get(billStatus), reference]);
        return { status: terminalStatuses.get(billStatus) };
      }
      if (billStatus !== EBILLING_PAID_STATE) throw Object.assign(new Error('Facture E-Billing non payée ou statut inconnu'), { status: 422 });
      await client.query("INSERT INTO ledger(user_id,sens,montant,type,reference) VALUES($1,'credit',$2,'recharge',$3)", [recharge.user_id, recharge.montant, reference]);
      await client.query("UPDATE recharges SET statut='paid',paid_at=now() WHERE reference=$1", [reference]);
      return { paid: true };
    });
    return res.json(result);
  } catch (error) { return res.status(error.status || 400).json({ error: error.message }); }
});

app.post('/api/withdrawals', requireAuth, [body('amount').isInt({ min: MIN_AMOUNT }), body('paymentSystem').isIn(['airtelmoney', 'moovmoney4']), body('password').isString(), valid], async (req, res) => {
  if (process.env.SHAP_ENABLED !== 'true') return res.status(503).json({ error: 'Retrait bientôt disponible' });
  let reference;
  try {
    const user = (await query('SELECT * FROM users WHERE id=$1', [req.user.sub])).rows[0];
    if (!await verifyPassword(req.body.password, user.mot_de_passe_hash)) return res.status(401).json({ error: 'Mot de passe invalide' });
    reference = uuid();
    const fees = calculateFees(req.body.amount);
    const debitAmount = Number(req.body.amount) + fees;
    await withTransaction(async (client) => {
      await client.query('SELECT id FROM users WHERE id=$1 FOR UPDATE', [user.id]);
      const balance = await client.query("SELECT COALESCE(SUM(CASE WHEN sens='credit' THEN montant ELSE -montant END),0)::int AS solde FROM ledger WHERE user_id=$1 AND statut='posted'", [user.id]);
      if (Number(balance.rows[0].solde) < debitAmount) throw Object.assign(new Error('Solde insuffisant'), { status: 422 });
      await client.query("INSERT INTO ledger(user_id,sens,montant,type,reference,statut) VALUES($1,'debit',$2,'withdrawal',$3,'posted')", [user.id, debitAmount, reference]);
      await client.query("INSERT INTO withdrawals(reference,statut,montant,frais,user_id) VALUES($1,'pending',$2,$3,$4)", [reference, req.body.amount, fees, user.id]);
    });
    try {
      const provider = await shapPayout({ msisdn: toProviderMsisdn(user.telephone_international), amount: req.body.amount, externalReference: reference, paymentSystem: req.body.paymentSystem });
      await query('UPDATE withdrawals SET shap_reference=$1 WHERE reference=$2', [provider.reference || provider.transactionid || null, reference]);
      return res.status(201).json({ reference, status: 'pending', frais: fees, provider });
    } catch (providerError) {
      await withTransaction(async (client) => {
        await client.query("INSERT INTO ledger(user_id,sens,montant,type,reference,statut) VALUES($1,'credit',$2,'withdrawal_reversal',$3,'posted')", [user.id, debitAmount, `${reference}:reversal`]);
        await client.query("UPDATE withdrawals SET statut='failed' WHERE reference=$1", [reference]);
      });
      return res.status(502).json({ error: providerError.message || 'Retrait refusé' });
    }
  } catch (error) { return res.status(error.status || 400).json({ error: error.message || 'Retrait impossible' }); }
});

module.exports = app;
