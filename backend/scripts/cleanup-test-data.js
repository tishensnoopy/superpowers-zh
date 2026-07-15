#!/usr/bin/env node
/**
 * 清理 E2E 测试产生的污染数据（FAQ / 新闻 / 预约）
 *
 * 用法:
 *   # 容器内
 *   docker compose exec backend node scripts/cleanup-test-data.js
 *
 *   # 宿主机（指向正在运行的 Strapi）
 *   STRAPI_URL=http://localhost:1337 node backend/scripts/cleanup-test-data.js
 *
 *   # CI 环境（通过环境变量传入凭据）
 *   STRAPI_URL=https://api.example.com \
 *   ADMIN_EMAIL=$SECRETS_ADMIN_EMAIL \
 *   ADMIN_PASSWORD=$SECRETS_ADMIN_PASSWORD \
 *   node backend/scripts/cleanup-test-data.js
 *
 * 清理规则:
 *   - faq-items: question 以 "测试FAQ-" 开头，或 === "test q"
 *   - news-articles: title 包含 "测试新闻"，或 slug 以 "yousen-news-test-" 开头
 *   - appointments: message 包含 "Strapi Admin REST API"，或 parentName === "测试家长"
 *
 * 幂等：可重复执行，无测试数据时输出 0 删除。
 */

const STRAPI_URL = process.env.STRAPI_URL || 'http://localhost:1337';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@yousen.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Yousen2026!';

const log = (msg) => console.log(msg);
const ok = (msg) => console.log(`  ✓ ${msg}`);
const info = (msg) => console.log(`  → ${msg}`);

async function adminLogin() {
  const res = await fetch(`${STRAPI_URL}/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Admin login failed: ${res.status} ${text}`);
  }
  const body = await res.json();
  return body.data.token;
}

/**
 * 通过 Content Manager API 分页查询所有记录
 */
async function listAll(token, contentType) {
  const all = [];
  let page = 1;
  const pageSize = 100;
  while (true) {
    const url = `${STRAPI_URL}/content-manager/collection-types/${contentType}?page=${page}&pageSize=${pageSize}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`List ${contentType} page ${page} failed: ${res.status} ${text}`);
    }
    const body = await res.json();
    const results = body.results || [];
    all.push(...results);
    const total = body.pagination?.total ?? results.length;
    if (all.length >= total || results.length === 0) break;
    page += 1;
  }
  return all;
}

async function deleteOne(token, contentType, documentId) {
  const res = await fetch(
    `${STRAPI_URL}/content-manager/collection-types/${contentType}/${documentId}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  return res.ok;
}

function isTestFaq(item) {
  const q = item.question || '';
  return q.startsWith('测试FAQ-') || q === 'test q';
}

function isTestNews(item) {
  const title = item.title || '';
  const slug = item.slug || '';
  return title.includes('测试新闻') || slug.startsWith('yousen-news-test-');
}

function isTestAppointment(item) {
  const msg = item.message || '';
  const parent = item.parentName || '';
  return msg.includes('Strapi Admin REST API') || parent === '测试家长';
}

async function cleanupCollection(token, contentType, label, predicate) {
  log(`\n=== 清理 ${label} ===`);
  const items = await listAll(token, contentType);
  info(`共 ${items.length} 条记录`);

  const toDelete = items.filter(predicate);
  info(`匹配测试数据 ${toDelete.length} 条`);

  let deleted = 0;
  for (const item of toDelete) {
    const success = await deleteOne(token, contentType, item.documentId);
    if (success) {
      deleted += 1;
      ok(`删除 ${item.documentId}`);
    } else {
      console.warn(`  ⚠ 删除失败 ${item.documentId}`);
    }
  }
  log(`  小计: 删除 ${deleted}/${toDelete.length} 条`);
  return deleted;
}

async function main() {
  log('=== E2E 测试数据清理脚本 ===');
  log(`Strapi URL: ${STRAPI_URL}`);

  const token = await adminLogin();
  ok('Admin 登录成功');

  const faqDeleted = await cleanupCollection(
    token,
    'api::faq-item.faq-item',
    'FAQ Items',
    isTestFaq
  );
  const newsDeleted = await cleanupCollection(
    token,
    'api::news-article.news-article',
    'News Articles',
    isTestNews
  );
  const apptDeleted = await cleanupCollection(
    token,
    'api::appointment.appointment',
    'Appointments',
    isTestAppointment
  );

  const total = faqDeleted + newsDeleted + apptDeleted;
  log(`\n=== 清理完成：共删除 ${total} 条测试数据 ===`);
  log(`  FAQ: ${faqDeleted} | 新闻: ${newsDeleted} | 预约: ${apptDeleted}`);
}

main().catch((err) => {
  console.error('\n❌ 清理失败:', err.message);
  console.error(err.stack);
  process.exit(1);
});
