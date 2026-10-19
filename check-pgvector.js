import pool from './db.js';
(async () => {
  try {
    const res = await pool.query("SELECT name FROM pg_available_extensions WHERE name = 'vector'");
    console.log("Vector extension available?", res.rows.length > 0);
  } catch (e) {
    console.error(e);
  } finally {
    pool.end();
  }
})();
