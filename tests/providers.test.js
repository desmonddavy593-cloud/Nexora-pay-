describe('client E-Billing', () => {
  let providers;
  beforeEach(() => {
    jest.resetModules();
    process.env.EBILLING_CLIENT_ID = 'fake-id';
    process.env.EBILLING_CLIENT_SECRET = 'fake-secret';
    process.env.EBILLING_TOKEN_URL = 'https://lab.example/oauth/token';
    process.env.EBILLING_BASE_URL = 'https://lab.example';
    providers = require('../src/providers');
  });
  test('SIMU passe par OAuth, création de facture et push USSD HTTP', async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'fake-token', expires_in: 3600 }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ e_bill: { bill_id: 'bill-1' } }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ accepted: true }) });
    await providers.createBill({ amount: 200, payerMsisdn: '077000001', paymentSystem: 'SIMU', externalReference: 'ref-1', name: 'Test', email: 'test@example.com', description: 'Test' });
    await providers.ussdPush({ billId: 'bill-1', payerMsisdn: '077000001', paymentSystem: 'SIMU' });
    expect(global.fetch).toHaveBeenCalledTimes(3);
    expect(global.fetch.mock.calls[2][1].body).toContain('SIMU');
  });
});

test('le module auth refuse le démarrage production sans secret JWT valide', () => {
  const result = require('child_process').spawnSync(process.execPath, ['-e', "process.env.NODE_ENV='production'; delete process.env.JWT_SECRET; require('./src/auth')"], { cwd: process.cwd(), encoding: 'utf8' });
  expect(result.status).not.toBe(0);
  expect(`${result.stderr}${result.stdout}`).toContain('JWT_SECRET');
});
