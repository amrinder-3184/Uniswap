import { assertTestEnvironment, assertConnectedToTestDatabase } from './setup/testDbGuard.js';
import { pool } from './helpers/db.js';

// Unit tests for the safety guard that protects real databases from test cleanup

const safeEnv = { NODE_ENV: 'test', DB_NAME: 'uniswap_test', DB_HOST: 'localhost', DB_PORT: '5432' };
const NO_DEV_FILE = 'this-file-does-not-exist.env';

describe('test database guard', () => {
  test('accepts a local *_test database in NODE_ENV=test', () => {
    expect(() => assertTestEnvironment(safeEnv, NO_DEV_FILE)).not.toThrow();
  });

  test.each([
    ['NODE_ENV is development', { NODE_ENV: 'development' }, /NODE_ENV/],
    ['NODE_ENV is missing', { NODE_ENV: undefined }, /NODE_ENV/],
    ['DB_NAME is the dev database', { DB_NAME: 'uniswap_db' }, /DB_NAME/],
    ['DB_NAME is missing', { DB_NAME: undefined }, /DB_NAME/],
    ['DB_NAME only contains "_test" in the middle', { DB_NAME: 'my_test_db' }, /DB_NAME/],
    ['DB_HOST is a remote server', { DB_HOST: 'prod-db.example.com' }, /DB_HOST/],
  ])('rejects when %s', (_label, override, message) => {
    expect(() => assertTestEnvironment({ ...safeEnv, ...override }, NO_DEV_FILE)).toThrow(message);
  });

  test('allows an extra host only when listed in TEST_DB_ALLOWED_HOSTS', () => {
    const dockerEnv = { ...safeEnv, DB_HOST: 'db' };
    expect(() => assertTestEnvironment(dockerEnv, NO_DEV_FILE)).toThrow(/DB_HOST/);
    expect(() => assertTestEnvironment({ ...dockerEnv, TEST_DB_ALLOWED_HOSTS: 'db' }, NO_DEV_FILE)).not.toThrow();
  });

  test('rejects a connection whose real database is not a *_test database', async () => {
    const fakeClient = { query: async () => ({ rows: [{ name: 'uniswap_db' }] }) };
    await expect(assertConnectedToTestDatabase(fakeClient)).rejects.toThrow(/uniswap_db/);
  });

  test('the pool used by the app is really connected to a *_test database', async () => {
    await expect(assertConnectedToTestDatabase(pool)).resolves.toMatch(/_test$/);
  });
});
