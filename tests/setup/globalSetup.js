import fs from 'fs';
import pg from 'pg';
import { assertTestEnvironment, assertConnectedToTestDatabase } from './testDbGuard.js';
import { TEST_UPLOAD_PARENT } from './paths.js';

// Runs once before the whole suite.
export default async function globalSetup() {
  // Loads .env.test (never .env) because Jest sets NODE_ENV=test
  await import('../../src/config/env.js');

  assertTestEnvironment();

  const client = new pg.Client({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  });

  await client.connect();
  try {
    const databaseName = await assertConnectedToTestDatabase(client);
    // schema.sql only uses CREATE ... IF NOT EXISTS, so this never removes anything.
    // It lets a brand-new empty test database (e.g. in CI) be used straight away.
    await client.query(fs.readFileSync('schema.sql', 'utf8'));
    console.log(`\nTest database: ${databaseName} on ${process.env.DB_HOST}:${process.env.DB_PORT}`);
  } finally {
    await client.end();
  }

  // Remove upload folders left behind by an interrupted earlier run
  fs.rmSync(TEST_UPLOAD_PARENT, { recursive: true, force: true });
}
