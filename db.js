import pg from 'pg';

// Load environment variables (.env, or .env.test when NODE_ENV=test)
import './src/config/env.js';

// Extract the Pool class from the pg package
const { Pool } = pg;

// Create a new PostgreSQL connection pool using our .env variables
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  max: 20, // Limit maximum connections
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

// Catch idle client errors so they don't crash the server
pool.on('error', (err) => {
  console.error('Unexpected error on idle DB client', err);
});

// Export the pool so other files can use it to talk to the database
export default pool;
