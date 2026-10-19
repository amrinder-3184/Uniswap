import fs from 'fs';
import dotenv from 'dotenv';

// Safety checks that run before the test suite touches a database.
// Tests empty every table between tests, so pointing them at the wrong
// database would destroy real data. Each check fails closed (throws).

const TEST_DB_NAME_PATTERN = /_test$/;
const DEFAULT_ALLOWED_HOSTS = ['localhost', '127.0.0.1', '::1'];

export const assertTestEnvironment = (env = process.env, devEnvFile = '.env') => {
  if (env.NODE_ENV !== 'test') {
    throw new Error(`Refusing to run: NODE_ENV must be "test" (got "${env.NODE_ENV}").`);
  }

  if (!TEST_DB_NAME_PATTERN.test(env.DB_NAME || '')) {
    throw new Error(`Refusing to run: DB_NAME must end in "_test" (got "${env.DB_NAME}"). Check .env.test.`);
  }

  // The name alone is not enough: a *_test database on a remote server could
  // still be someone's real data. Only local hosts are allowed unless listed explicitly.
  const extraHosts = (env.TEST_DB_ALLOWED_HOSTS || '').split(',').map((h) => h.trim()).filter(Boolean);
  const allowedHosts = [...DEFAULT_ALLOWED_HOSTS, ...extraHosts];
  if (!allowedHosts.includes(env.DB_HOST)) {
    throw new Error(`Refusing to run: DB_HOST "${env.DB_HOST}" is not an allowed test host (${allowedHosts.join(', ')}).`);
  }

  // Never target the same database as the development configuration
  if (fs.existsSync(devEnvFile)) {
    const devEnv = dotenv.parse(fs.readFileSync(devEnvFile));
    const sameDatabase = devEnv.DB_NAME === env.DB_NAME
      && (devEnv.DB_HOST || 'localhost') === env.DB_HOST
      && String(devEnv.DB_PORT || 5432) === String(env.DB_PORT || 5432);
    if (sameDatabase) {
      throw new Error('Refusing to run: the test database is the same as the development database in .env.');
    }
  }
};

// Asks PostgreSQL which database this connection is really using, so a wrong
// pool configuration is caught even if the environment variables look right.
export const assertConnectedToTestDatabase = async (client) => {
  const result = await client.query('SELECT current_database() AS name');
  const actualName = result.rows[0].name;
  if (!TEST_DB_NAME_PATTERN.test(actualName)) {
    throw new Error(`Refusing to run: connected to "${actualName}", which is not a *_test database.`);
  }
  return actualName;
};
