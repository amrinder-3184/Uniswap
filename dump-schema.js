import pool from './db.js';

async function getSchema() {
  const result = await pool.query(`
    SELECT table_name, column_name, data_type, character_maximum_length, is_nullable, column_default
    FROM information_schema.columns 
    WHERE table_schema = 'public'
    ORDER BY table_name, ordinal_position;
  `);

  const keys = await pool.query(`
    SELECT conname, contype, pg_get_constraintdef(c.oid)
    FROM pg_constraint c
    JOIN pg_namespace n ON n.oid = c.connamespace
    WHERE n.nspname = 'public';
  `);

  console.log("=== COLUMNS ===");
  result.rows.forEach(r => console.log(`${r.table_name}: ${r.column_name} (${r.data_type})`));
  
  console.log("\n=== CONSTRAINTS ===");
  keys.rows.forEach(r => console.log(`${r.conname} (${r.contype}): ${r.pg_get_constraintdef}`));

  process.exit(0);
}

getSchema().catch(console.error);
