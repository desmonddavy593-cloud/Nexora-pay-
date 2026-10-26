describe('Migrations au démarrage', () => {
  const originalDatabaseUrl = process.env.DATABASE_URL;

  afterEach(() => {
    if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = originalDatabaseUrl;
    jest.restoreAllMocks();
    jest.resetModules();
  });

  test('ignore les migrations sans DATABASE_URL sans lever d’exception', async () => {
    delete process.env.DATABASE_URL;
    const warning = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const migrate = require('../src/migrate');

    await expect(migrate()).resolves.toBeUndefined();
    expect(warning).toHaveBeenCalledWith('DATABASE_URL manquant, migrations ignorées');
  });
});
