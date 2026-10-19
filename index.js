import pool from './db.js';
import { createApp } from './src/app.js';

let app;
try {
  app = createApp();
} catch (err) {
  // Configuration problems (e.g. a missing JWT_SECRET) stop the server before it accepts requests
  console.error(`Startup aborted: ${err.message}`);
  await pool.end();
  process.exit(1);
}
const port = process.env.PORT || 3000;

const server = app.listen(port, async () => {
  console.log(`Server is running on port ${port}`);
  try {
    await pool.query('SELECT NOW() AS current_time;');
    console.log('Database connected successfully!');
  } catch (err) {
    console.error('Failed to connect to the database:', err);
  }
});

// Graceful Shutdown Handler
const gracefulShutdown = () => {
  console.log('SIGTERM/SIGINT received. Shutting down gracefully...');
  server.close(async () => {
    console.log('HTTP server closed.');
    try {
      await pool.end();
      console.log('Database pool closed.');
      process.exit(0);
    } catch (err) {
      console.error('Error during database pool closure', err);
      process.exit(1);
    }
  });

  // Force exit if hanging
  setTimeout(() => {
    console.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
