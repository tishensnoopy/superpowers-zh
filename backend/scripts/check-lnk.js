const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '../.tmp/data.db');
const db = new Database(dbPath);

try {
  const schema = db.prepare("PRAGMA table_info(navigations_parent_lnk)").all();
  console.log('navigations_parent_lnk schema:');
  schema.forEach(col => {
    console.log(`  ${col.name} (${col.type})`);
  });
  
  const rows = db.prepare('SELECT * FROM navigations_parent_lnk').all();
  console.log('\nCurrent links:', rows);

} catch (err) {
  console.error('Error:', err.message);
} finally {
  db.close();
}