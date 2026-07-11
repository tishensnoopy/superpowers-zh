const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '../.tmp/data.db');

console.log('=== Update Homepage Hero Section ===');

try {
  if (!fs.existsSync(dbPath)) {
    console.error('Database file not found:', dbPath);
    process.exit(1);
  }
  
  const Database = require('better-sqlite3');
  const db = new Database(dbPath);
  
  const homepage = db.prepare("SELECT id FROM pages WHERE is_homepage = 1 LIMIT 1").get();
  
  if (!homepage) {
    console.error('Homepage not found!');
    db.close();
    process.exit(1);
  }
  
  console.log('Found homepage ID:', homepage.id);
  
  db.prepare("DELETE FROM pages_cmps WHERE entity_id = ? AND field = 'sections'").run(homepage.id);
  
  const insertHero = db.prepare(`
    INSERT INTO components_section_heroes (title, subtitle, description, button_text, button_url, is_full_width, overlay_color)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  
  const result = insertHero.run(
    '让每个孩子\n自信迈入小学大门',
    '2026年秋季班正在招生 · 名额有限',
    '专注幼小衔接教育8年，科学课程体系 + 专业师资团队，帮助3-6岁儿童在入学前全面准备。',
    '立即预约试听',
    '/contact',
    1,
    null
  );
  
  const heroId = result.lastInsertRowid;
  console.log('Created hero section with ID:', heroId);
  
  db.prepare("INSERT INTO pages_cmps (entity_id, cmp_id, component_type, field, \"order\") VALUES (?, ?, ?, ?, ?)")
    .run(homepage.id, heroId, 'section.hero', 'sections', 0);
  
  console.log('Created relation between homepage and hero section');
  
  const verify = db.prepare("SELECT * FROM components_section_heroes WHERE id = ?").get(heroId);
  console.log('\nCreated hero data:');
  console.log('  title:', verify.title);
  console.log('  subtitle:', verify.subtitle);
  console.log('  description:', verify.description);
  console.log('  button_text:', verify.button_text);
  
  db.close();
  console.log('\n=== Done ===');
  
} catch (err) {
  console.error('Error:', err.message);
  process.exit(1);
}