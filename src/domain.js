const { calculateFees, MIN_AMOUNT } = require('./config');
function balanceFromLedger(entries) { return entries.reduce((total, row) => total + (row.sens === 'credit' ? Number(row.montant) : -Number(row.montant)), 0); }
function movementTotal(amount) { if (Number(amount) < MIN_AMOUNT) throw new Error(`Le montant minimum est ${MIN_AMOUNT} XAF`); return { amount: Number(amount), fees: calculateFees(amount), total: Number(amount) + calculateFees(amount) }; }
function simuOutcome(msisdn) { const n = String(msisdn); if (/^(077|066)000001$/.test(n)) return 'paid'; if (/^(077|066)010001$/.test(n)) return 'failed'; if (/^(077|066)210001$/.test(n)) return 'expired'; if (/^077210001$/.test(n)) return 'expired'; if (/^(077)000077$|^(066)000066$/.test(n)) return 'ambiguous'; return 'not_found'; }
module.exports = { balanceFromLedger, movementTotal, simuOutcome };
