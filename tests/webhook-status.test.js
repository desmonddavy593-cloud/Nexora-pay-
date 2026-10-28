const request = require('supertest');

process.env.NODE_ENV = 'test';
process.env.EBILLING_WEBHOOK_SECRET = 'test-webhook-secret';
process.env.EBILLING_PAID_STATE = 'paid';
process.env.EBILLING_FAILED_STATE = 'failed';
process.env.EBILLING_EXPIRED_STATE = 'expired';
process.env.EBILLING_AMBIGUOUS_STATE = 'ambiguous';

const mockProvider = { getBill: jest.fn() };
const mockClient = { query: jest.fn() };
jest.mock('../src/providers', () => ({ createBill: jest.fn(), ussdPush: jest.fn(), getBill: (...args) => mockProvider.getBill(...args), shapPayout: jest.fn() }));
jest.mock('../src/db', () => ({ query: jest.fn(), withTransaction: jest.fn(async callback => callback(mockClient)) }));

const app = require('../src/app');
const db = require('../src/db');

beforeEach(() => {
  mockProvider.getBill.mockReset();
  mockClient.query.mockReset();
  mockClient.query.mockImplementation(async (sql) => {
    if (sql.startsWith('SELECT * FROM recharges')) return { rows: [{ reference: 'ref-1', ebilling_bill_id: 'bill-1', montant: 100, frais: 100, user_id: 'user-1', statut: 'pending' }] };
    if (sql.startsWith('UPDATE recharges')) return { rows: [] };
    if (sql.startsWith('INSERT INTO ledger')) throw new Error('Le callback non payé ne doit jamais créditer le ledger');
    return { rows: [] };
  });
  db.query.mockReset();
});

async function callback(status) {
  mockProvider.getBill.mockResolvedValue({ bill_id: 'bill-1', amount: 200, status });
  return request(app).post('/api/webhooks/ebilling?token=test-webhook-secret').send({ reference: 'ref-1', billingid: 'bill-1', amount: 200 });
}

test('le diagnostic webhook capture le statut reçu sans exposer le token', async () => {
  mockProvider.getBill.mockResolvedValue({ bill_id: 'bill-1', amount: 200, status: 'failed' });
  const logger = jest.spyOn(console, 'log').mockImplementation(() => {});
  try {
    const response = await request(app).post('/api/webhooks/ebilling?token=test-webhook-secret').send({ reference: 'ref-1', billingid: 'bill-1', amount: 200, status: 'provider_status' });
    expect(response.status).toBe(200);
    expect(logger).toHaveBeenCalledWith('[webhook/ebilling] diagnostic', { fields: ['reference', 'billingid', 'amount', 'status'], status: 'provider_status', reference: 'ref-1', billingid: 'bill-1', amount: 200 });
    expect(logger.mock.calls.flat().join(' ')).not.toContain('test-webhook-secret');
  } finally {
    logger.mockRestore();
  }
});

test('le diagnostic webhook ne journalise que les champs autorisés', async () => {
  const logger = jest.spyOn(console, 'log').mockImplementation(() => {});
  try {
    await callback('failed');
    expect(logger).toHaveBeenCalledWith('[webhook/ebilling] diagnostic', { fields: ['reference', 'billingid', 'amount'], status: null, reference: 'ref-1', billingid: 'bill-1', amount: 200 });
    expect(logger.mock.calls.flat().join(' ')).not.toContain('test-webhook-secret');
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
