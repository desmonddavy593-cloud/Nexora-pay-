require('dotenv').config();

const COUNTRIES = Object.freeze({
  GA: { name: 'Gabon', dialCode: '241', localLength: 8 }, CM: { name: 'Cameroun', dialCode: '237', localLength: 9 }, CG: { name: 'Congo-Brazzaville', dialCode: '242', localLength: 9 }, CD: { name: 'RDC', dialCode: '243', localLength: 9 }, SN: { name: 'Sénégal', dialCode: '221', localLength: 9 }, CI: { name: "Côte d'Ivoire", dialCode: '225', localLength: 10 }, BJ: { name: 'Bénin', dialCode: '229', localLength: 8 }, GN: { name: 'Guinée', dialCode: '224', localLength: 9 }, UG: { name: 'Ouganda', dialCode: '256', localLength: 9 }
});
const MIN_AMOUNT = 100;
const FEES_RATE = Number(process.env.FRAIS_TAUX || 0.01);
const MIN_FEES = Number(process.env.FRAIS_MINIMUM || 100);
// TODO: confirmer auprès de Digitech la valeur exacte des statuts E-Billing en LAB/PROD.
const EBILLING_PAID_STATE = process.env.EBILLING_PAID_STATE || 'TODO_CONFIGURE_PAID_STATE';
const EBILLING_FAILED_STATE = process.env.EBILLING_FAILED_STATE || 'TODO_CONFIGURE_FAILED_STATE';
const EBILLING_EXPIRED_STATE = process.env.EBILLING_EXPIRED_STATE || 'TODO_CONFIGURE_EXPIRED_STATE';
const EBILLING_AMBIGUOUS_STATE = process.env.EBILLING_AMBIGUOUS_STATE || 'TODO_CONFIGURE_AMBIGUOUS_STATE';
function countryByCode(code) { return COUNTRIES[code]; }
function cleanLocalPhone(local) { return String(local || '').replace(/[\s-]/g, ''); }
function normalizePhone(countryCode, local) {
  const country = countryByCode(countryCode); const value = cleanLocalPhone(local);
  if (!country || !/^\d+$/.test(value) || value.length !== country.localLength) throw new Error('Le numéro doit contenir 8 chiffres sans le 0, commençant par 6 ou 7');
  if (countryCode === 'GA' && !/^[67]/.test(value)) throw new Error('Le numéro doit contenir 8 chiffres sans le 0, commençant par 6 ou 7');
  return `+${country.dialCode}${value}`;
}
function toProviderMsisdn(international) { return `0${international.replace(/^\+\d{3}/, '')}`; }
function calculateFees(amount) { return Math.max(MIN_FEES, Math.ceil(Number(amount) * FEES_RATE)); }
function expectedPaymentSystem(international) { const msisdn = toProviderMsisdn(international); if (msisdn.startsWith('07')) return 'airtelmoney'; if (msisdn.startsWith('06')) return 'moovmoney4'; return null; }
function assertPaymentSystemMatches(international, paymentSystem) { const expected = expectedPaymentSystem(international); if (expected && paymentSystem !== expected) throw new Error(`Opérateur incohérent : ce numéro nécessite ${expected}`); }
module.exports = { COUNTRIES, MIN_AMOUNT, FEES_RATE, MIN_FEES, EBILLING_PAID_STATE, EBILLING_FAILED_STATE, EBILLING_EXPIRED_STATE, EBILLING_AMBIGUOUS_STATE, normalizePhone, cleanLocalPhone, toProviderMsisdn, calculateFees, expectedPaymentSystem, assertPaymentSystemMatches };
