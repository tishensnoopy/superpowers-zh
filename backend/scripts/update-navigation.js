const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '../.tmp/data.db');

console.log('=== Update Navigation Items ===');

try {
  if (!fs.existsSync(dbPath)) {
    console.error('Database file not found:', dbPath);
    process.exit(1);
  }
  
  const Database = require('better-sqlite3');
  const db = new Database(dbPath);
  
  const navItems = [
    { id: 1, name: '首页', url: '/', position: 0 },
    { id: 2, name: '课程体系', url: '/products', position: 1 },
    { id: 3, name: '关于我们', url: '/about', position: 2 },
    { id: 4, name: '联系我们', url: '/contact', position: 3 },
  ];
  
  navItems.forEach(item => {
    db.prepare("UPDATE navigations SET name = ?, url = ?, position = ? WHERE id = ?")
      .run(item.name, item.url, item.position, item.id);
    console.log(`Updated navigation ${item.id}: ${item.name} -> ${item.url}`);
  });
  
  const verify = db.prepare("SELECT id, name, url, position FROM navigations ORDER BY position").all();
  console.log('\nUpdated navigation items:');
  verify.forEach(item => {
    console.log(`  ${item.id}. ${item.name} (${item.url})`);
  });
  
  db.close();
  console.log('\n=== Done ===');
  
} catch (err) {
  console.error('Error:', err.message);
  process.exit(1);
}