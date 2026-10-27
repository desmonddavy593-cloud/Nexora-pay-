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
  test('rejette une query string contenant un mot de passe sans la journaliser', async () => {
    const logger = jest.spyOn(console, 'log').mockImplementation(() => {});
    try {
      const response = await request(app).get('/connexion.html?password=x');
      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Requête invalide' });
      expect(logger).not.toHaveBeenCalledWith(expect.stringContaining('/connexion.html'));
    } finally {
      logger.mockRestore();
    }
  });
  test('ne met pas en cache les pages d’authentification', async () => {
    const response = await request(app).get('/connexion.html');
    expect(response.headers['cache-control']).toBe('no-store');
  });
});
