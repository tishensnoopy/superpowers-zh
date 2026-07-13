const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '../.tmp/data.db');
const db = new Database(dbPath);

try {
  console.log('=== Current Navigation Items ===');
  const rows = db.prepare('SELECT id, name, url, parentId FROM navigations ORDER BY position, id').all();
  rows.forEach(row => {
    console.log(`ID: ${row.id}, Name: ${row.name}, URL: ${row.url}, ParentID: ${row.parentId || 'NULL'}`);
  });

  console.log('\n=== Updating URLs ===');
  const updateUrl = db.prepare('UPDATE navigations SET url = ? WHERE id = ?');
  updateUrl.run('/courses', 2);
  console.log('Updated 课程体系 URL to /courses');

  console.log('\n=== Setting Parent Relationships ===');
  
  const updateParent = db.prepare('UPDATE navigations SET parentId = ? WHERE name = ?');
  
  updateParent.run(3, '学校介绍');
  console.log('学校介绍 -> 关于我们 (parentId=3)');
  
  updateParent.run(3, '办学理念');
  console.log('办学理念 -> 关于我们 (parentId=3)');
  
  updateParent.run(3, '资质荣誉');
  console.log('资质荣誉 -> 关于我们 (parentId=3)');

  console.log('\n=== Creating Course Children ===');
  const insertChild = db.prepare(`INSERT INTO navigations (documentId, name, url, position, isActive, isExternal, parentId, createdAt, updatedAt, publishedAt) 
          VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'), datetime('now'))`);
  
  const courseChildren = [
    { name: '语言启蒙', url: '/courses/language', position: 0 },
    { name: '数学思维', url: '/courses/math', position: 1 },
    { name: '英语口语', url: '/courses/english', position: 2 },
    { name: '综合素养', url: '/courses/comprehensive', position: 3 },
  ];
  
  courseChildren.forEach((child, i) => {
    const docId = `course_child_${i + 1}`;
    const result = insertChild.run(docId, child.name, child.url, child.position, 1, 0, 2);
    console.log(`Created: ${child.name} (${child.url}) -> 课程体系 (parentId=2)`);
  });

  console.log('\n=== Creating Campus Children ===');
  const campusChildren = [
    { name: '朝阳校区', url: '/campuses/chaoyang', position: 0 },
    { name: '海淀校区', url: '/campuses/haidian', position: 1 },
    { name: '西城校区', url: '/campuses/xicheng', position: 2 },
    { name: '丰台校区', url: '/campuses/fengtai', position: 3 },
  ];
  
  campusChildren.forEach((child, i) => {
    const docId = `campus_child_${i + 1}`;
    const result = insertChild.run(docId, child.name, child.url, child.position, 1, 0, 5);
    console.log(`Created: ${child.name} (${child.url}) -> 校区介绍 (parentId=5)`);
  });

  console.log('\n=== Final Navigation Tree ===');
  const finalRows = db.prepare('SELECT id, name, url, parentId FROM navigations ORDER BY parentId NULLS FIRST, position, id').all();
  
  const parentMap = new Map();
  finalRows.forEach(row => {
    if (!row.parentId) {
      parentMap.set(row.id, { ...row, children: [] });
    }
  });
  
  finalRows.forEach(row => {
    if (row.parentId && parentMap.has(row.parentId)) {
      parentMap.get(row.parentId).children.push(row);
    }
  });
  
  parentMap.forEach(item => {
    console.log(`- ${item.name} (${item.url})`);
    item.children.forEach(child => {
      console.log(`  - ${child.name} (${child.url})`);
    });
  });

} catch (err) {
  console.error('Error:', err.message);
} finally {
  db.close();
}