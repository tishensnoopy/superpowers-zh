const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '../data.db');
const db = new Database(dbPath);

try {
  const insert1 = db.prepare(`INSERT INTO navigations (documentId, name, url, position, isActive, isExternal, createdAt, updatedAt) 
          VALUES ('test_child_1', '语言启蒙', '/courses/language', 1, 1, 0, datetime('now'), datetime('now'))`);
  const result1 = insert1.run();
  console.log('Inserted language course, rowid:', result1.lastInsertRowid);

  const insert2 = db.prepare(`INSERT INTO navigations (documentId, name, url, position, isActive, isExternal, createdAt, updatedAt) 
          VALUES ('test_child_2', '数学思维', '/courses/math', 2, 1, 0, datetime('now'), datetime('now'))`);
  const result2 = insert2.run();
  console.log('Inserted math course, rowid:', result2.lastInsertRowid);

  const update1 = db.prepare(`UPDATE navigations SET parentId = 2 WHERE documentId = 'test_child_1'`);
  update1.run();
  console.log('Updated language course parentId');

  const update2 = db.prepare(`UPDATE navigations SET parentId = 2 WHERE documentId = 'test_child_2'`);
  update2.run();
  console.log('Updated math course parentId');

  const rows = db.prepare('SELECT id, name, url, parentId FROM navigations').all();
  console.log('\n=== Navigation Items ===');
  rows.forEach(row => {
    console.log(`ID: ${row.id}, Name: ${row.name}, URL: ${row.url}, ParentID: ${row.parentId}`);
  });

} catch (err) {
  console.error('Error:', err.message);
} finally {
  db.close();
}