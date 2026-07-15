const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '../.tmp/data.db');
const db = new Database(dbPath);

function generateDocId() {
  return Math.random().toString(36).substring(2, 15);
}

try {
  console.log('=== Step 1: Current Navigation Items ===');
  const allRows = db.prepare('SELECT id, name, url, position FROM navigations ORDER BY position, id').all();
  const nameToId = new Map();
  allRows.forEach(row => {
    nameToId.set(row.name, row.id);
    console.log(`ID: ${row.id}, Name: ${row.name}, URL: ${row.url}`);
  });

  console.log('\n=== Step 2: Update Course URL ===');
  const updateUrl = db.prepare('UPDATE navigations SET url = ? WHERE id = ?');
  if (nameToId.has('课程体系')) {
    updateUrl.run('/courses', nameToId.get('课程体系'));
    console.log('Updated 课程体系 URL to /courses');
  }

  console.log('\n=== Step 3: Create Missing Items ===');
  const insertNav = db.prepare(`INSERT INTO navigations (document_id, name, url, position, is_active, is_external, created_at, updated_at, published_at) 
          VALUES (?, ?, ?, ?, ?, ?, strftime('%s','now') * 1000, strftime('%s','now') * 1000, strftime('%s','now') * 1000)`);

  const missingItems = [
    { name: '办学理念', url: '/about/philosophy', position: 10 },
    { name: '资质荣誉', url: '/about/achievements', position: 11 },
    { name: '语言启蒙', url: '/courses/language', position: 20 },
    { name: '数学思维', url: '/courses/math', position: 21 },
    { name: '英语口语', url: '/courses/english', position: 22 },
    { name: '综合素养', url: '/courses/comprehensive', position: 23 },
    { name: '朝阳校区', url: '/campuses/chaoyang', position: 30 },
    { name: '海淀校区', url: '/campuses/haidian', position: 31 },
    { name: '西城校区', url: '/campuses/xicheng', position: 32 },
    { name: '丰台校区', url: '/campuses/fengtai', position: 33 },
  ];

  missingItems.forEach(item => {
    if (!nameToId.has(item.name)) {
      const result = insertNav.run(generateDocId(), item.name, item.url, item.position, 1, 0);
      nameToId.set(item.name, result.lastInsertRowid);
      console.log(`Created: ${item.name} (ID: ${result.lastInsertRowid})`);
    } else {
      console.log(`Already exists: ${item.name} (ID: ${nameToId.get(item.name)})`);
    }
  });

  console.log('\n=== Step 4: Set Parent Relationships ===');
  const insertLink = db.prepare('INSERT INTO navigations_parent_lnk (navigation_id, inv_navigation_id) VALUES (?, ?)');

  const parentChildren = [
    { parent: '关于我们', children: ['学校介绍', '办学理念', '资质荣誉'] },
    { parent: '课程体系', children: ['语言启蒙', '数学思维', '英语口语', '综合素养'] },
    { parent: '校区介绍', children: ['朝阳校区', '海淀校区', '西城校区', '丰台校区'] },
  ];

  const existingLinks = db.prepare('SELECT navigation_id FROM navigations_parent_lnk').all();
  const existingChildIds = new Set(existingLinks.map(l => l.navigation_id));

  parentChildren.forEach(pc => {
    const parentId = nameToId.get(pc.parent);
    if (!parentId) {
      console.log(`Warning: Parent not found: ${pc.parent}`);
      return;
    }
    pc.children.forEach(childName => {
      const childId = nameToId.get(childName);
      if (!childId) {
        console.log(`Warning: Child not found: ${childName}`);
        return;
      }
      if (!existingChildIds.has(childId)) {
        insertLink.run(childId, parentId);
        console.log(`Linked: ${childName} -> ${pc.parent}`);
      } else {
        console.log(`Already linked: ${childName} -> ${pc.parent}`);
      }
    });
  });

  console.log('\n=== Step 5: Final Navigation Tree ===');
  const finalNav = db.prepare('SELECT id, name, url, position FROM navigations ORDER BY position NULLS FIRST, id').all();
  const finalLinks = db.prepare('SELECT navigation_id, inv_navigation_id FROM navigations_parent_lnk').all();
  
  const childMap = new Map();
  finalLinks.forEach(link => {
    if (!childMap.has(link.inv_navigation_id)) {
      childMap.set(link.inv_navigation_id, []);
    }
    childMap.get(link.inv_navigation_id).push(link.navigation_id);
  });

  const idToName = new Map();
  finalNav.forEach(item => {
    idToName.set(item.id, item.name);
  });

  finalNav.forEach(item => {
    if (!finalLinks.find(l => l.navigation_id === item.id)) {
      const children = childMap.get(item.id) || [];
      console.log(`- ${item.name} (${item.url})`);
      children.forEach(childId => {
        const child = finalNav.find(n => n.id === childId);
        if (child) {
          console.log(`  - ${child.name} (${child.url})`);
        }
      });
    }
  });

} catch (err) {
  console.error('Error:', err.message);
  console.error(err.stack);
} finally {
  db.close();
}