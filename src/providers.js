let ebillingToken;
let shapToken;

async function oauthToken() {
  if (ebillingToken && ebillingToken.expires > Date.now() + 300000) return ebillingToken.value;
  if (!process.env.EBILLING_CLIENT_ID || !process.env.EBILLING_CLIENT_SECRET) throw new Error('E-Billing non configuré');
  const basic = Buffer.from(`${process.env.EBILLING_CLIENT_ID}:${process.env.EBILLING_CLIENT_SECRET}`).toString('base64');
  const scope = 'ebilling-api/invoice:create ebilling-api/invoice:read ebilling-api/payment:create ebilling-api/payment:read';
  const r = await fetch(process.env.EBILLING_TOKEN_URL, {
    method: 'POST',
    headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=client_credentials&scope=${encodeURIComponent(scope)}`
  });
  if (!r.ok) throw new Error('Authentification E-Billing impossible');
  const data = await r.json();
  ebillingToken = { value: data.access_token, expires: Date.now() + Number(data.expires_in || 3600) * 1000 };
  return ebillingToken.value;
}

async function createBill(input) {
  const token = await oauthToken();
  const r = await fetch(`${process.env.EBILLING_BASE_URL}/api/v1/merchant/e_bills`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount: input.amount, payer_msisdn: input.payerMsisdn, payer_email: input.email, payer_name: input.name, short_description: input.description, external_reference: input.externalReference })
  });
  if (!r.ok) throw new Error('Création E-Billing impossible');
  const data = await r.json();
  return { billId: data.e_bill?.bill_id || data.bill_id };
}

async function ussdPush(input) {
  const token = await oauthToken();
  const r = await fetch(`${process.env.EBILLING_BASE_URL}/api/v2/merchant/e_bills/${input.billId}/ussd_push`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ payer_msisdn: input.payerMsisdn, payment_system_name: input.paymentSystem })
  });
  if (!r.ok) throw new Error('Push USSD impossible');
  return r.json();
}

async function getBill(billId) {
  const token = await oauthToken();
  const r = await fetch(`${process.env.EBILLING_BASE_URL}/api/v1/merchant/e_bills/${encodeURIComponent(billId)}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error('Lecture E-Billing impossible');
  return r.json();
}

async function shapPayout(input) {
  if (process.env.SHAP_ENABLED !== 'true') throw new Error('Retrait bientôt disponible');
  if (!shapToken || shapToken.expires < Date.now() + 300000) {
    const r = await fetch(`${process.env.SHAP_BASE_URL}/auth`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ api_id: process.env.SHAP_API_ID, api_secret: process.env.SHAP_API_SECRET }) });
    if (!r.ok) throw new Error('Authentification SHAP impossible');
    const data = await r.json();
    shapToken = { value: data.access_token, expires: Date.now() + Number(data.expires_in || 7200) * 1000 };
  }
  const r = await fetch(`${process.env.SHAP_BASE_URL}/payout`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${shapToken.value}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ payment_system_name: input.paymentSystem, payout: { payee_msisdn: input.msisdn, amount: input.amount, external_reference: input.externalReference, payout_type: 'withdrawal' } })
  });
  if (!r.ok) throw new Error('Demande de retrait refusée');
  return r.json();
}

module.exports = { createBill, ussdPush, getBill, shapPayout, oauthToken };
