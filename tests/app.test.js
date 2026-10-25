const request = require('supertest');
const app = require('../src/app');

describe('API publique', () => {
  test('health', async () => {
    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
  });
  test('webhook sans secret valide est rejeté en 401', async () => {
    const response = await request(app).post('/api/webhooks/ebilling').send({ reference: 'missing', amount: 100 });
    expect(response.status).toBe(401);
  });
});
