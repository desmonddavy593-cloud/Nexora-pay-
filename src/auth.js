const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { query } = require('./db');
const SECRET = process.env.JWT_SECRET || 'development-only-secret-change-me';
async function hashPassword(password) { return bcrypt.hash(password, 12); }
async function verifyPassword(password, hash) { return bcrypt.compare(password, hash); }
function issueToken(user) { return jwt.sign({ sub: user.id }, SECRET, { expiresIn: '24h' }); }
function setSession(res, token) { res.cookie('nexora_session', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', maxAge: 86400000 }); }
async function requireAuth(req, res, next) { try { const token = req.cookies.nexora_session; if (!token) return res.status(401).json({ error: 'Authentification requise' }); req.user = jwt.verify(token, SECRET); next(); } catch { return res.status(401).json({ error: 'Authentification requise' }); } }
async function recordAttempt(phone, success) { await query('INSERT INTO login_attempts(telephone, success) VALUES($1,$2)', [phone, success]); }
async function isLocked(phone) { const r = await query("SELECT count(*)::int AS n FROM login_attempts WHERE telephone=$1 AND success=false AND created_at > now()-interval '15 minutes'", [phone]); return r.rows[0].n >= 5; }
module.exports = { hashPassword, verifyPassword, issueToken, setSession, requireAuth, recordAttempt, isLocked };
