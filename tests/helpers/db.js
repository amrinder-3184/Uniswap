import pool from '../../db.js';
import { assertTestEnvironment, assertConnectedToTestDatabase } from '../setup/testDbGuard.js';

// Every application table. Schema objects are never dropped; only rows are removed.
const APP_TABLES = ['transactions', 'messages', 'favorites', 'listing_images', 'listings', 'categories', 'users'];

// Empties all application tables so each test starts from a known state.
// The guard and the TRUNCATE run on the SAME connection, so the database that
// was checked is exactly the database that gets cleared.
export const resetDatabase = async () => {
  assertTestEnvironment();
  const client = await pool.connect();
  try {
    await assertConnectedToTestDatabase(client);
    await client.query(`TRUNCATE TABLE ${APP_TABLES.join(', ')} RESTART IDENTITY CASCADE`);
  } finally {
    client.release();
  }
};

export const countRows = async (table) => {
  if (!APP_TABLES.includes(table)) {
    throw new Error(`Unknown table: ${table}`);
  }
  const result = await pool.query(`SELECT COUNT(*)::int AS count FROM ${table}`);
  return result.rows[0].count;
};

export { pool };
