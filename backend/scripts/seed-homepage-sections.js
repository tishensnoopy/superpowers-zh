const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '../.tmp/data.db');
const db = new Database(dbPath);

console.log('=== 开始填充首页区块数据 ===\n');

function genDocId() {
  return 'doc_' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
}

const now = "datetime('now')";

// 1. 创建 product-categories
console.log('1. 创建 product-categories...');
const catNames = ['语言启蒙', '数学思维', '英语口语', '综合素养'];
const catIds = [];
for (const name of catNames) {
  const docId = genDocId();
  db.prepare(`INSERT INTO product_categories (document_id, name, slug, description, position, is_active, created_at, updated_at, published_at, locale)
    VALUES (?, ?, ?, '', 0, 1, ${now}, ${now}, ${now}, NULL)`).run(docId, name, name);
  const row = db.prepare('SELECT id FROM product_categories WHERE document_id = ?').get(docId);
  catIds.push(row.id);
  console.log(`   ✓ ${name} (id: ${row.id})`);
}

// 2. 创建 product-specs (规格定义)
console.log('\n2. 创建 product-specs...');
const specsData = [
  { name: '课时', code: 'course_hours', unit: '课时', type: 'text', options: '' },
  { name: '班额', code: 'class_size', unit: '人', type: 'text', options: '' },
  { name: '适合年龄', code: 'age_range', unit: '岁', type: 'text', options: '' },
  { name: '课程周期', code: 'duration', unit: '月', type: 'text', options: '' },
];
const specIds = [];
for (const spec of specsData) {
  const docId = genDocId();
  db.prepare(`INSERT INTO product_specs (document_id, name, code, unit, type, options, is_visible, position, created_at, updated_at, published_at, locale)
    VALUES (?, ?, ?, ?, ?, ?, 1, 0, ${now}, ${now}, ${now}, NULL)`).run(docId, spec.name, spec.code, spec.unit, spec.type, spec.options);
  const row = db.prepare('SELECT id FROM product_specs WHERE document_id = ?').get(docId);
  specIds.push(row.id);
  console.log(`   ✓ ${spec.name} (id: ${row.id})`);
}

// 3. 创建 products
console.log('\n3. 创建 products...');
const productsData = [
  { name: '语言启蒙', slug: 'language', sku: 'LANG001', shortDesc: '培养孩子语言表达能力与阅读兴趣', desc: '通过绘本阅读、儿歌律动、故事讲述等方式，系统培养孩子的语言表达能力、阅读兴趣和前书写能力。', catIdx: 0, specValues: { 'course_hours': '48课时', 'class_size': '小班12人', 'age_range': '4-6岁', 'duration': '6个月' } },
  { name: '数学思维', slug: 'math', sku: 'MATH001', shortDesc: '建立数学概念与逻辑推理能力', desc: '通过操作教具、游戏互动、生活情境等方式，帮助孩子建立数、量、形、空间等数学概念。', catIdx: 1, specValues: { 'course_hours': '48课时', 'class_size': '小班12人', 'age_range': '4-6岁', 'duration': '6个月' } },
  { name: '英语口语', slug: 'english', sku: 'ENG001', shortDesc: '浸泡式英语环境培养语感', desc: '通过英文儿歌、情景对话、绘本故事等沉浸式教学方式，培养孩子英语语感和口语表达自信。', catIdx: 2, specValues: { 'course_hours': '48课时', 'class_size': '小班12人', 'age_range': '4-6岁', 'duration': '6个月' } },
  { name: '综合素养', slug: 'comprehensive', sku: 'COMP001', shortDesc: '全面发展社交与生活能力', desc: '通过社交游戏、生活实践、艺术创作等多元化活动，培养孩子的社交能力、生活自理能力和创造力。', catIdx: 3, specValues: { 'course_hours': '48课时', 'class_size': '小班12人', 'age_range': '4-6岁', 'duration': '6个月' } },
];
const productIds = [];
for (const p of productsData) {
  const docId = genDocId();
  db.prepare(`INSERT INTO products (document_id, name, slug, short_description, description, sku, stock, is_in_stock, is_featured, spec_values, price, created_at, updated_at, published_at, locale)
    VALUES (?, ?, ?, ?, ?, ?, 100, 1, 0, ?, 0, ${now}, ${now}, ${now}, NULL)`).run(
    docId, p.name, p.slug, p.shortDesc, p.desc, p.sku, JSON.stringify(p.specValues)
  );
  const row = db.prepare('SELECT id FROM products WHERE document_id = ?').get(docId);
  productIds.push(row.id);
  console.log(`   ✓ ${p.name} (id: ${row.id})`);

  // 关联分类
  db.prepare(`INSERT INTO products_categories_lnk (product_id, product_category_id, product_category_ord, product_ord)
    VALUES (?, ?, 0, 0)`).run(row.id, catIds[p.catIdx]);

  // 关联所有 specs
  for (let i = 0; i < specIds.length; i++) {
    db.prepare(`INSERT INTO products_specs_lnk (product_id, product_spec_id, product_spec_ord)
      VALUES (?, ?, ?)`).run(row.id, specIds[i], i);
  }
}

// 4. 更新首页 — 添加 section 区块
console.log('\n4. 更新首页 sections...');

// Strapi v5 为每个 page 维护 draft (published_at=NULL) 和 published 两行记录
// API 默认返回 published 版本，因此需要把 sections 关联到所有首页行
const homepages = db.prepare('SELECT id, published_at FROM pages WHERE is_homepage = 1 ORDER BY id').all();
if (homepages.length === 0) {
  console.error('   ✗ 未找到首页 page 记录');
  process.exit(1);
}
console.log(`   首页 page rows: ${homepages.map(h => 'id=' + h.id + '(' + (h.published_at ? 'published' : 'draft') + ')').join(', ')}`);

// 为每个首页行计算下一个可用 order
const homepageNextOrders = {};
for (const hp of homepages) {
  const existing = db.prepare(`SELECT COUNT(*) as c FROM pages_cmps WHERE entity_id = ? AND field = 'sections'`).get(hp.id);
  homepageNextOrders[hp.id] = existing.c;
  console.log(`   page id=${hp.id}: 现有 sections ${existing.c} 个`);
}

// 辅助函数：把 section 关联到所有首页行（draft + published）
function linkSectionToHomepages(componentType, sectionId) {
  for (const hp of homepages) {
    const order = homepageNextOrders[hp.id];
    db.prepare(`INSERT INTO pages_cmps (entity_id, cmp_id, component_type, field, "order")
      VALUES (?, ?, ?, 'sections', ?)`).run(hp.id, sectionId, componentType, order);
    homepageNextOrders[hp.id]++;
  }
}

// 4a. 创建 advantages section
console.log('   创建 advantages section...');
// 注意：components_section_advantages 没有 document_id 字段
db.prepare(`INSERT INTO components_section_advantages (title, description)
  VALUES (?, ?)`).run(
  '4大核心优势，给孩子最好的起点',
  '我们深知每位家长对孩子教育的期望与用心，以专业、安全、温暖的教育环境陪伴每一个孩子成长。'
);
const advSectionId = db.prepare('SELECT last_insert_rowid() as id').get().id;
console.log(`   ✓ advantages section (id: ${advSectionId})`);

// 创建 4 个 advantage items
const advantagesData = [
  { title: '专业师资', desc: '8年幼小衔接教学经验，所有教师均持证上岗，定期培训提升教学水平。', icon: 'GraduationCap', color: '#F5851F', bgColor: '#FFF3E5' },
  { title: '科学课程', desc: '对标小学课程标准，由资深教研团队研发，让孩子学得快乐、学得扎实。', icon: 'BookOpen', color: '#2563EB', bgColor: '#EFF6FF' },
  { title: '安全环境', desc: '全程监控覆盖，安全防护到位，每班配备两名教师确保孩子安全。', icon: 'Shield', color: '#059669', bgColor: '#ECFDF5' },
  { title: '小班教学', desc: '每班不超过12人，确保每个孩子都能得到充分关注和个性化指导。', icon: 'Users', color: '#7C3AED', bgColor: '#F5F3FF' },
];
for (let i = 0; i < advantagesData.length; i++) {
  const adv = advantagesData[i];
  db.prepare(`INSERT INTO components_common_advantages (title, description, icon, color, bg_color)
    VALUES (?, ?, ?, ?, ?)`).run(adv.title, adv.desc, adv.icon, adv.color, adv.bgColor);
  const itemId = db.prepare('SELECT last_insert_rowid() as id').get().id;
  // 关联到 advantages section
  db.prepare(`INSERT INTO components_section_advantages_cmps (entity_id, cmp_id, component_type, field, "order")
    VALUES (?, ?, 'common.advantage', 'advantages', ?)`).run(advSectionId, itemId, i);
}

// 将 advantages section 关联到所有首页行
linkSectionToHomepages('section.advantages', advSectionId);

// 4b. 创建 product-grid section
console.log('   创建 product-grid section...');
db.prepare(`INSERT INTO components_section_product_grids (title, description, columns, show_filter)
  VALUES (?, ?, '3', 0)`).run(
  '精品课程体系',
  '由资深教研团队研发，严格对标小学课程标准，让孩子学得快乐、学得扎实。'
);
const pgSectionId = db.prepare('SELECT last_insert_rowid() as id').get().id;

// 关联 4 个 products 到 product-grid
// 实际表结构: components_section_product_grids_products_lnk (id, product_grid_id, product_id, product_ord)
const pgLinkCols = db.prepare('PRAGMA table_info(components_section_product_grids_products_lnk)').all();
console.log('   product_grids_products_lnk 字段:', pgLinkCols.map(c => c.name).join(', '));

for (let i = 0; i < productIds.length; i++) {
  db.prepare(`INSERT INTO components_section_product_grids_products_lnk (product_grid_id, product_id, product_ord)
    VALUES (?, ?, ?)`).run(pgSectionId, productIds[i], i);
}

linkSectionToHomepages('section.product-grid', pgSectionId);
console.log(`   ✓ product-grid section (id: ${pgSectionId})`);

// 4c. 创建 team section
console.log('   创建 team section...');
db.prepare(`INSERT INTO components_section_teams (title, description)
  VALUES (?, ?)`).run(
  '资深教师团队',
  '8年沉淀，打造出一支专业、有爱、懂孩子的教师队伍。'
);
const teamSectionId = db.prepare('SELECT last_insert_rowid() as id').get().id;

const membersData = [
  { name: '王老师', position: '教学总监', bio: '北京师范大学学前教育硕士，12年幼教经验，专注幼小衔接课程研发。' },
  { name: '李老师', position: '语言启蒙组组长', bio: '华东师范大学汉语言文学专业，8年儿童语言教学经验。' },
  { name: '张老师', position: '数学思维组组长', bio: '南京师范大学数学教育专业，擅长将抽象概念游戏化。' },
  { name: '陈老师', position: '英语口语组组长', bio: '上海外国语大学英语教育硕士，TESOL认证教师。' },
];
for (let i = 0; i < membersData.length; i++) {
  const m = membersData[i];
  db.prepare(`INSERT INTO components_common_team_members (name, position, bio)
    VALUES (?, ?, ?)`).run(m.name, m.position, m.bio);
  const itemId = db.prepare('SELECT last_insert_rowid() as id').get().id;
  db.prepare(`INSERT INTO components_section_teams_cmps (entity_id, cmp_id, component_type, field, "order")
    VALUES (?, ?, 'common.team-member', 'members', ?)`).run(teamSectionId, itemId, i);
}

linkSectionToHomepages('section.team', teamSectionId);
console.log(`   ✓ team section (id: ${teamSectionId})`);

// 4d. 创建 contact-form section
console.log('   创建 contact-form section...');
db.prepare(`INSERT INTO components_section_contact_forms (title, description, submit_text, success_message)
  VALUES (?, ?, ?, ?)`).run(
  '预约免费试听',
  '填写下方表单，我们将尽快联系您安排试听课程',
  '立即预约',
  '预约成功！我们将在24小时内联系您确认时间。'
);
const cfSectionId = db.prepare('SELECT last_insert_rowid() as id').get().id;

const fieldsData = [
  { label: '孩子姓名', name: 'childName', type: 'text', required: true, placeholder: '请输入孩子姓名', options: null },
  { label: '家长姓名', name: 'parentName', type: 'text', required: true, placeholder: '请输入家长姓名', options: null },
  { label: '联系电话', name: 'phone', type: 'phone', required: true, placeholder: '请输入手机号码', options: null },
  { label: '孩子年龄', name: 'age', type: 'text', required: false, placeholder: '请输入孩子年龄', options: null },
  { label: '感兴趣的课程', name: 'course', type: 'select', required: false, placeholder: '请选择课程', options: JSON.stringify(['语言启蒙', '数学思维', '英语口语', '综合素养']) },
  { label: '期望时段', name: 'preferredTimeSlot', type: 'select', required: false, placeholder: '请选择时段', options: JSON.stringify([{value:'morning',label:'上午'},{value:'afternoon',label:'下午'},{value:'evening',label:'晚上'}]) },
  { label: '备注', name: 'message', type: 'textarea', required: false, placeholder: '其他需要说明的事项', options: null },
];
for (let i = 0; i < fieldsData.length; i++) {
  const f = fieldsData[i];
  db.prepare(`INSERT INTO components_common_form_fields (label, name, type, required, placeholder, options)
    VALUES (?, ?, ?, ?, ?, ?)`).run(f.label, f.name, f.type, f.required ? 1 : 0, f.placeholder, f.options);
  const itemId = db.prepare('SELECT last_insert_rowid() as id').get().id;
  db.prepare(`INSERT INTO components_section_contact_forms_cmps (entity_id, cmp_id, component_type, field, "order")
    VALUES (?, ?, 'common.form-field', 'fields', ?)`).run(cfSectionId, itemId, i);
}

linkSectionToHomepages('section.contact-form', cfSectionId);
console.log(`   ✓ contact-form section (id: ${cfSectionId})`);

// 5. 验证
console.log('\n5. 验证数据...');
for (const hp of homepages) {
  const finalSections = db.prepare(`
    SELECT component_type, cmp_id, "order" FROM pages_cmps WHERE entity_id = ? AND field = 'sections' ORDER BY "order"
  `).all(hp.id);
  const tag = hp.published_at ? 'published' : 'draft';
  console.log(`   page id=${hp.id} (${tag}): ${finalSections.length} 个 sections`);
  for (const s of finalSections) {
    console.log(`   ${s.order}: ${s.component_type} (cmp_id: ${s.cmp_id})`);
  }
}

console.log('\n=== 数据填充完成 ===');
db.close();
