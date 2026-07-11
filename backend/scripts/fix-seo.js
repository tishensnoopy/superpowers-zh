const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '../.tmp/data.db');

console.log('=== Fix SEO ogImage Validation Error ===');

try {
  if (!fs.existsSync(dbPath)) {
    console.error('Database file not found:', dbPath);
    process.exit(1);
  }
  
  const Database = require('better-sqlite3');
  const db = new Database(dbPath);
  
  console.log('=== All Tables ===');
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
  tables.forEach(t => console.log('  -', t.name));
  
  console.log('\n=== Pages Table Full Schema ===');
  const pagesSchema = db.prepare("PRAGMA table_info(pages)").all();
  pagesSchema.forEach(col => {
    console.log(`${col.name} (${col.type})`);
  });
  
  console.log('\n=== Count of SEO records ===');
  const seoCount = db.prepare("SELECT COUNT(*) as count FROM components_common_seos").get();
  console.log('SEO records:', seoCount.count);
  
  console.log('\n=== Checking for seo_id in pages ===');
  const hasSeoId = pagesSchema.some(col => col.name === 'seo_id');
  console.log('pages table has seo_id column:', hasSeoId);
  
  if (hasSeoId) {
    const pagesWithSeo = db.prepare("SELECT id, seo_id FROM pages WHERE seo_id IS NOT NULL").all();
    console.log('Pages with SEO:', pagesWithSeo.length);
  }
  
  db.close();
  console.log('=== Done ===');
  
} catch (err) {
  console.error('Error:', err.message);
  process.exit(1);
}