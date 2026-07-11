const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '../.tmp/data.db');
const db = new Database(dbPath);

try {
  const update = db.prepare(`UPDATE site_settings SET icp = '沪ICP备2024XXXXXXX号', public_security_record = '沪公网安备31XXXXXXXXXX号' WHERE id = 1`);
  const result = update.run();
  console.log('Updated site_settings:', result.changes, 'rows affected');

  const row = db.prepare('SELECT id, name, icp, public_security_record FROM site_settings WHERE id = 1').get();
  console.log('\n=== Updated Site Settings ===');
  console.log('ID:', row.id);
  console.log('Name:', row.name);
  console.log('ICP:', row.icp);
  console.log('Public Security Record:', row.publicSecurityRecord);

} catch (err) {
  console.error('Error:', err.message);
} finally {
  db.close();
}