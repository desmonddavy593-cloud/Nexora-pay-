const { assertPaymentSystemMatches, expectedPaymentSystem, isSimuLabAllowed } = require('../src/config');

describe('cohérence opérateur recharge', () => {
  test('une recharge Airtel avec un numéro local 06 est refusée', () => {
    expect(expectedPaymentSystem('+24161234567')).toBe('moovmoney4');
    expect(() => assertPaymentSystemMatches('+24161234567', 'airtelmoney')).toThrow('Opérateur incohérent');
  });

  test('une recharge Moov avec un numéro local 07 est refusée', () => {
    expect(expectedPaymentSystem('+24171234567')).toBe('airtelmoney');
    expect(() => assertPaymentSystemMatches('+24171234567', 'moovmoney4')).toThrow('Opérateur incohérent');
  });
});

describe('autorisation SIMU', () => {
  test('autorise uniquement E-Billing LAB', () => {
    expect(isSimuLabAllowed('https://lab.billing-easy.net')).toBe(true);
    expect(isSimuLabAllowed('https://lab.billing-easy.net/api')).toBe(true);
  });
  test('refuse tout autre hôte, y compris la production', () => {
    expect(isSimuLabAllowed('https://billing-easy.net')).toBe(false);
    expect(isSimuLabAllowed('https://lab.example')).toBe(false);
    expect(isSimuLabAllowed('')).toBe(false);
  });
});
