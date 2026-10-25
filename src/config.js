require('dotenv').config();

const COUNTRIES = Object.freeze({
  GA: { name: 'Gabon', dialCode: '241', localLength: 8 },
  CM: { name: 'Cameroun', dialCode: '237', localLength: 9 },
  CG: { name: 'Congo-Brazzaville', dialCode: '242', localLength: 9 },
  CD: { name: 'RDC', dialCode: '243', localLength: 9 },
  SN: { name: 'Sénégal', dialCode: '221', localLength: 9 },
  CI: { name: "Côte d'Ivoire", dialCode: '225', localLength: 10 },
  BJ: { name: 'Bénin', dialCode: '229', localLength: 8 },
  GN: { name: 'Guinée', dialCode: '224', localLength: 9 },
  UG: { name: 'Ouganda', dialCode: '256', localLength: 9 }
});
const MIN_AMOUNT = 100;
const FEES_RATE = Number(process.env.FRAIS_TAUX || 0.01);
const MIN_FEES = Number(process.env.FRAIS_MINIMUM || 100);
function countryByCode(code) { return COUNTRIES[code]; }
function normalizePhone(countryCode, local) {
  const country = countryByCode(countryCode);
  if (!country || !/^\d+$/.test(String(local)) || String(local).length !== country.localLength) throw new Error('Numéro invalide');
  if (countryCode === 'GA' && !/^[67]/.test(String(local))) throw new Error('Préfixe gabonais invalide');
  return `+${country.dialCode}${local}`;
}
function toProviderMsisdn(international) { return `0${international.replace(/^\+\d{3}/, '')}`; }
function calculateFees(amount) { return Math.max(MIN_FEES, Math.ceil(Number(amount) * FEES_RATE)); }
module.exports = { COUNTRIES, MIN_AMOUNT, FEES_RATE, MIN_FEES, normalizePhone, toProviderMsisdn, calculateFees };
