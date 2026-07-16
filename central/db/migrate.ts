import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pool } from '../lib/db';

async function migrate() {
  const sql = readFileSync(join(__dirname, 'schema.sql'), 'utf8');
  const client = await pool.connect();
  try {
    await client.query(sql);
    console.log('[migrate] schema applied');
  } finally {
    client.release();
  }
  await pool.end();
}

migrate().catch((err) => {
  console.error('[migrate] failed:', err);
  process.exit(1);
});
