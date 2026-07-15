/**
 * floating-button section 初始化脚本
 *
 * 功能:
 *   - 往首页 sections 中添加 floating-button 组件
 *   - 自动关联到所有首页行（draft + published）
 *   - 防止重复插入（已存在则跳过或更新）
 *   - 支持命令行参数自定义配置
 *
 * 用法:
 *   node scripts/seed-floating-button.js                          # 使用默认值插入
 *   node scripts/seed-floating-button.js --label "免费试听" --action contact
 *   node scripts/seed-floating-button.js --phone 400-123-4567 --wechat edu_assistant
 *   node scripts/seed-floating-button.js --position bottom-left
 *   node scripts/seed-floating-button.js --force                  # 强制更新已存在的记录
 *   node scripts/seed-floating-button.js --remove                 # 移除已存在的 floating-button
 *
 * 默认值:
 *   label: 在线咨询
 *   action: contact
 *   position: bottom-right
 *   phone: (空)
 *   wechat: (空)
 */
const Database = require('better-sqlite3');
const path = require('path');

// ============== 解析命令行参数 ==============
function parseArgs() {
  const args = process.argv.slice(2);
  const config = {
    label: '在线咨询',
    action: 'contact',
    position: 'bottom-right',
    phone: '',
    wechat: '',
    icon: 'MessageCircle',
    force: false,
    remove: false,
  };
  for (let i = 0; i < args.length; i++) {
    const key = args[i];
    const val = args[i + 1];
    switch (key) {
      case '--label':    config.label = val; i++; break;
      case '--action':   config.action = val; i++; break;
      case '--position': config.position = val; i++; break;
      case '--phone':    config.phone = val; i++; break;
      case '--wechat':   config.wechat = val; i++; break;
      case '--icon':     config.icon = val; i++; break;
      case '--force':    config.force = true; break;
      case '--remove':   config.remove = true; break;
      case '--help':
      case '-h':
        console.log(__doc);
        process.exit(0);
      default:
        if (key.startsWith('--')) {
          console.error(`未知参数: ${key}`);
          process.exit(1);
        }
    }
  }
  return config;
}

const config = parseArgs();

// ============== 校验枚举值 ==============
const VALID_ACTIONS = ['contact', 'chat', 'phone', 'callback'];
const VALID_POSITIONS = ['bottom-right', 'bottom-left'];

if (!VALID_ACTIONS.includes(config.action)) {
  console.error(`✗ action 必须是 ${VALID_ACTIONS.join('/')} 之一，当前: ${config.action}`);
  process.exit(1);
}
if (!VALID_POSITIONS.includes(config.position)) {
  console.error(`✗ position 必须是 ${VALID_POSITIONS.join('/')} 之一，当前: ${config.position}`);
  process.exit(1);
}

// ============== 连接数据库 ==============
const dbPath = path.join(__dirname, '../.tmp/data.db');
const fs = require('fs');
if (!fs.existsSync(dbPath)) {
  console.error(`✗ 数据库文件不存在: ${dbPath}`);
  console.error('  请先启动 Strapi 后端生成数据库，或检查当前工作目录');
  process.exit(1);
}
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

console.log('=== Floating Button Section 初始化 ===\n');
console.log(`配置:`);
console.log(`  label:    ${config.label}`);
console.log(`  action:   ${config.action}`);
console.log(`  position: ${config.position}`);
console.log(`  phone:    ${config.phone || '(空)'}`);
console.log(`  wechat:   ${config.wechat || '(空)'}`);
console.log(`  icon:     ${config.icon}`);
console.log('');

// ============== 查找首页记录 ==============
const homepages = db.prepare(
  'SELECT id, published_at FROM pages WHERE is_homepage = 1 ORDER BY id'
).all();

if (homepages.length === 0) {
  console.error('✗ 未找到首页 page 记录');
  console.error('  请先运行 seed-homepage-sections.js 创建首页');
  process.exit(1);
}

console.log(`首页 page rows: ${homepages.map(h => `id=${h.id}(${h.published_at ? 'published' : 'draft'})`).join(', ')}\n`);

// ============== 检查是否已存在 floating-button section ==============
function findExistingFloatingButton(homepageId) {
  const rows = db.prepare(`
    SELECT cmp.id AS link_id, cmp.cmp_id, cmp."order",
           fb.label, fb.action, fb.position, fb.phone, fb.wechat, fb.icon
    FROM pages_cmps cmp
    JOIN components_section_floating_buttons fb ON fb.id = cmp.cmp_id
    WHERE cmp.entity_id = ? AND cmp.field = 'sections' AND cmp.component_type = 'section.floating-button'
    ORDER BY cmp."order"
  `).all(homepageId);
  return rows;
}

const existingByHomepage = {};
let totalExisting = 0;
for (const hp of homepages) {
  const rows = findExistingFloatingButton(hp.id);
  existingByHomepage[hp.id] = rows;
  totalExisting += rows.length;
}

// ============== 移除模式 ==============
if (config.remove) {
  if (totalExisting === 0) {
    console.log('未找到 floating-button section，无需移除');
    db.close();
    process.exit(0);
  }
  console.log(`移除 ${totalExisting} 个 floating-button section 关联...`);
  for (const hp of homepages) {
    const rows = existingByHomepage[hp.id];
    for (const row of rows) {
      db.prepare('DELETE FROM pages_cmps WHERE id = ?').run(row.link_id);
      db.prepare('DELETE FROM components_section_floating_buttons WHERE id = ?').run(row.cmp_id);
      console.log(`  ✓ page id=${hp.id}: 移除 link_id=${row.link_id}, cmp_id=${row.cmp_id}`);
    }
    // 重新排序剩余 sections
    const remaining = db.prepare(`
      SELECT id, "order" FROM pages_cmps
      WHERE entity_id = ? AND field = 'sections'
      ORDER BY "order"
    `).all(hp.id);
    remaining.forEach((r, idx) => {
      if (r.order !== idx) {
        db.prepare('UPDATE pages_cmps SET "order" = ? WHERE id = ?').run(idx, r.id);
      }
    });
  }
  console.log('\n=== 移除完成 ===');
  db.close();
  process.exit(0);
}

// ============== 已存在处理 ==============
if (totalExisting > 0 && !config.force) {
  console.log(`⚠ 已存在 ${totalExisting} 个 floating-button section:`);
  for (const hp of homepages) {
    for (const row of existingByHomepage[hp.id]) {
      console.log(`  page id=${hp.id}: label="${row.label}", action=${row.action}, position=${row.position}`);
    }
  }
  console.log('\n如需更新配置，请添加 --force 参数');
  console.log('如需移除，请添加 --remove 参数');
  console.log('\n=== 跳过（未做任何更改）===');
  db.close();
  process.exit(0);
}

// ============== 强制更新模式 ==============
if (totalExisting > 0 && config.force) {
  console.log(`强制更新 ${totalExisting} 个已存在的 floating-button section...`);
  for (const hp of homepages) {
    for (const row of existingByHomepage[hp.id]) {
      db.prepare(`
        UPDATE components_section_floating_buttons
        SET icon = ?, label = ?, action = ?, phone = ?, wechat = ?, position = ?
        WHERE id = ?
      `).run(config.icon, config.label, config.action, config.phone, config.wechat, config.position, row.cmp_id);
      console.log(`  ✓ page id=${hp.id}: 更新 cmp_id=${row.cmp_id}`);
    }
  }
  console.log('\n=== 更新完成 ===');

  // 验证
  console.log('\n验证:');
  for (const hp of homepages) {
    const rows = findExistingFloatingButton(hp.id);
    for (const row of rows) {
      console.log(`  page id=${hp.id} (${hp.published_at ? 'published' : 'draft'}): label="${row.label}", action=${row.action}, position=${row.position}`);
    }
  }
  db.close();
  process.exit(0);
}

// ============== 新增模式 ==============
console.log('创建新的 floating-button section...\n');

// 为每个首页行计算下一个可用 order
const homepageNextOrders = {};
for (const hp of homepages) {
  const existing = db.prepare(
    'SELECT COUNT(*) as c FROM pages_cmps WHERE entity_id = ? AND field = \'sections\''
  ).get(hp.id);
  homepageNextOrders[hp.id] = existing.c;
  console.log(`  page id=${hp.id}: 现有 sections ${existing.c} 个，新 order=${existing.c}`);
}

// 插入 floating-button 组件记录
// 注意：Strapi v5 的 component 表没有 document_id 字段（只有 content type 表才有）
db.prepare(`
  INSERT INTO components_section_floating_buttons (icon, label, action, phone, wechat, position)
  VALUES (?, ?, ?, ?, ?, ?)
`).run(config.icon, config.label, config.action, config.phone, config.wechat, config.position);

const fbSectionId = db.prepare('SELECT last_insert_rowid() as id').get().id;
console.log(`\n  ✓ components_section_floating_buttons (id: ${fbSectionId})`);

// 关联到所有首页行（draft + published）
for (const hp of homepages) {
  const order = homepageNextOrders[hp.id];
  db.prepare(`
    INSERT INTO pages_cmps (entity_id, cmp_id, component_type, field, "order")
    VALUES (?, ?, 'section.floating-button', 'sections', ?)
  `).run(hp.id, fbSectionId, order);
  console.log(`  ✓ 关联到 page id=${hp.id} (${hp.published_at ? 'published' : 'draft'}) at order=${order}`);
}

// ============== 验证 ==============
console.log('\n=== 验证 ===');
for (const hp of homepages) {
  const finalSections = db.prepare(`
    SELECT component_type, cmp_id, "order"
    FROM pages_cmps
    WHERE entity_id = ? AND field = 'sections'
    ORDER BY "order"
  `).all(hp.id);
  const tag = hp.published_at ? 'published' : 'draft';
  console.log(`\npage id=${hp.id} (${tag}): ${finalSections.length} 个 sections`);
  for (const s of finalSections) {
    let detail = '';
    if (s.component_type === 'section.floating-button') {
      const fb = db.prepare('SELECT label, action, position FROM components_section_floating_buttons WHERE id = ?').get(s.cmp_id);
      detail = ` [label="${fb.label}", action=${fb.action}, position=${fb.position}]`;
    }
    console.log(`  ${s.order}: ${s.component_type} (cmp_id: ${s.cmp_id})${detail}`);
  }
}

console.log('\n=== 初始化完成 ===');
console.log('\n提示:');
console.log('  1. 重启 Strapi 后端使更改生效');
console.log('  2. 访问首页底部应能看到浮动按钮');
console.log('  3. 如需修改配置: node scripts/seed-floating-button.js --force --label "新文案"');
console.log('  4. 如需移除: node scripts/seed-floating-button.js --remove');

db.close();
