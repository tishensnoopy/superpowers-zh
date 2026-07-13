const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '../.tmp/data.db');
const db = new Database(dbPath);

try {
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
  console.log('Tables:', tables.map(t => t.name));
  
  const schema = db.prepare("PRAGMA table_info(navigations)").all();
  console.log('\nNavigations table schema:');
  schema.forEach(col => {
    console.log(`  ${col.name} (${col.type}) ${col.notnull ? 'NOT NULL' : ''} ${col.pk ? 'PK' : ''}`);
  });
  
  const rows = db.prepare('SELECT * FROM navigations ORDER BY id LIMIT 1').all();
  console.log('\nSample row:', JSON.stringify(rows[0], null, 2));

} catch (err) {
  console.error('Error:', err.message);
} finally {
  db.close();
}