const request = require('supertest');

process.env.NODE_ENV = 'test';
process.env.EBILLING_WEBHOOK_SECRET = 'test-webhook-secret';
process.env.EBILLING_PAID_STATE = 'paid';
process.env.EBILLING_FAILED_STATE = 'failed';
process.env.EBILLING_EXPIRED_STATE = 'expired';
process.env.EBILLING_AMBIGUOUS_STATE = 'ambiguous';

const mockProvider = { getBill: jest.fn() };
const mockClient = { query: jest.fn() };
let rechargeStatus;
jest.mock('../src/providers', () => ({ createBill: jest.fn(), ussdPush: jest.fn(), getBill: (...args) => mockProvider.getBill(...args), shapPayout: jest.fn() }));
jest.mock('../src/db', () => ({ query: jest.fn(), withTransaction: jest.fn(async callback => callback(mockClient)) }));

const app = require('../src/app');
const db = require('../src/db');

beforeEach(() => {
  rechargeStatus = 'pending';
  mockProvider.getBill.mockReset();
  mockClient.query.mockReset();
  mockClient.query.mockImplementation(async (sql) => {
    if (sql.startsWith('SELECT * FROM recharges')) return { rows: [{ reference: 'ref-1', ebilling_bill_id: 'bill-1', montant: 100, frais: 100, user_id: 'user-1', statut: rechargeStatus }] };
    if (sql.startsWith("UPDATE recharges SET statut='paid'")) { rechargeStatus = 'paid'; return { rows: [] }; }
    if (sql.startsWith('UPDATE recharges')) return { rows: [] };
    return { rows: [] };
  });
  db.query.mockReset();
});

async function callback(status, method = 'post', payload = {}) {
  mockProvider.getBill.mockResolvedValue({ bill_id: 'bill-1', amount: 200, status });
  const data = { reference: 'ref-1', billingid: 'bill-1', amount: 200, ...payload };
  const call = request(app)[method]('/api/webhooks/ebilling?token=test-webhook-secret');
  return method === 'get' ? call.query(data) : call.send(data);
}

test('un statut E-Billing inconnu journalise uniquement son nom et sa valeur', async () => {
  const logger = jest.spyOn(console, 'warn').mockImplementation(() => {});
  try {
    const response = await callback('provider_status_unknown');
    expect(response.status).toBe(422);
    expect(logger).toHaveBeenCalledWith('[webhook/ebilling] statut inconnu', { name: 'status', value: 'provider_status_unknown' });
    expect(logger.mock.calls.flat().join(' ')).not.toContain('test-webhook-secret');
  } finally {
    logger.mockRestore();
  }
});

test('un callback GET valide crédite une fois', async () => {
  const response = await callback('paid', 'get');
  expect(response.status).toBe(200);
  expect(response.body).toEqual({ paid: true });
  expect(mockClient.query.mock.calls.filter(([sql]) => sql.startsWith('INSERT INTO ledger')).length).toBe(1);
});

test('un GET sans token valide renvoie 401', async () => {
  const response = await request(app).get('/api/webhooks/ebilling').query({ reference: 'ref-1', billingid: 'bill-1', amount: 200 });
  expect(response.status).toBe(401);
});

test('un GET et un POST identiques ne créditent qu’une seule fois', async () => {
  const first = await callback('paid', 'get');
  const second = await callback('paid', 'post');
  expect(first.status).toBe(200);
  expect(second.status).toBe(200);
  expect(second.body).toEqual({ idempotent: true });
  expect(mockClient.query.mock.calls.filter(([sql]) => sql.startsWith('INSERT INTO ledger')).length).toBe(1);
  expect(mockProvider.getBill).toHaveBeenCalledTimes(1);
});

test('les valeurs du body priment sur celles de la query', async () => {
  const logger = jest.spyOn(console, 'warn').mockImplementation(() => {});
  try {
    mockProvider.getBill.mockResolvedValue({ bill_id: 'bill-1', amount: 200, status: 'provider_status_unknown' });
    const response = await request(app).post('/api/webhooks/ebilling?token=wrong-token&reference=wrong-ref&billingid=wrong-bill&amount=999')
      .send({ token: 'test-webhook-secret', reference: 'ref-1', billingid: 'bill-1', amount: 200 });
    expect(response.status).toBe(422);
    expect(mockProvider.getBill).toHaveBeenCalledWith('bill-1');
  } finally {
    logger.mockRestore();
  }
});
test('un callback SIMU en échec passe la recharge à failed sans crédit', async () => {
  const response = await callback('failed');
  expect(response.status).toBe(200);
  expect(response.body).toEqual({ status: 'failed' });
  expect(mockClient.query).toHaveBeenCalledWith('UPDATE recharges SET statut=$1 WHERE reference=$2', ['failed', 'ref-1']);
  expect(mockClient.query.mock.calls.some(([sql]) => sql.startsWith('INSERT INTO ledger'))).toBe(false);
});

test('un callback d’expiration passe la recharge à expired', async () => {
  const response = await callback('expired');
  expect(response.status).toBe(200);
  expect(response.body).toEqual({ status: 'expired' });
});

test('un callback ambigu passe la recharge à ambiguous', async () => {
  const response = await callback('ambiguous');
  expect(response.status).toBe(200);
  expect(response.body).toEqual({ status: 'ambiguous' });
});

test('un statut E-Billing inconnu reste en 422 sans changement d’état', async () => {
  const response = await callback('provider_pending_unknown');
  expect(response.status).toBe(422);
  expect(mockClient.query.mock.calls.some(([sql]) => sql.startsWith('UPDATE recharges'))).toBe(false);
});
