#!/usr/bin/env node
/**
 * 批量为业务数据创建 en-US 本地化版本（含机器翻译）
 *
 * 策略：
 *   1. 遍历所有启用 i18n 的 content type，对有 zh-CN 但无 en-US 的文档创建 en-US 版本
 *      （v5 会自动继承 components/media/关系，保证结构完整）
 *   2. 从 zh-CN 完整文档（populate）收集可翻译文本字段，调用 DashScope qwen-plus
 *      批量翻译为英文后写入 en-US 版本（避免 en-US 内容为中文占位）
 *   3. 翻译失败时回退为中文占位（保证 en-US 版本存在、页面不 500）
 *
 * 用法:
 *   NODE_ENV=production node scripts/create-en-us-locales.js [--retranslate] [--only=api::page.page,...] [--dry-run]
 *
 *   --retranslate  对已存在的 en-US 版本也重新执行翻译（用于修复存量中文占位数据）
 *   --only         只处理指定 content type（逗号分隔）
 *   --dry-run      只打印将要翻译的字段，不调用 API、不写入
 *
 * 环境变量:
 *   DASHSCOPE_API_KEY  百炼 API Key（必填，无则全部回退中文占位）
 */

const path = require('path');
const { createStrapi } = require('@strapi/strapi');

// 按依赖顺序排列：被引用的类型在前（Phase B 关系复制依赖目标已存在 en-US 版本）
const CONTENT_TYPES = [
  { uid: 'api::product-spec.product-spec', lookupField: 'code' },
  { uid: 'api::product-category.product-category', lookupField: 'slug' },
  { uid: 'api::campus.campus', lookupField: 'slug' },
  { uid: 'api::knowledge-base.knowledge-base', lookupField: 'title' },
  { uid: 'api::navigation.navigation', lookupField: 'name' },
  { uid: 'api::page.page', lookupField: 'slug' },
  { uid: 'api::teacher.teacher', lookupField: 'slug' },
  { uid: 'api::faq-item.faq-item', lookupField: 'question' },
  { uid: 'api::product.product', lookupField: 'slug' },
  { uid: 'api::news-article.news-article', lookupField: 'slug' },
  { uid: 'api::footer.footer', lookupField: 'id' },
  { uid: 'api::site-settings.site-settings', lookupField: 'id' },
];

// Phase B：v5 i18n 中关系字段恒为 localized（不随 locale 版本创建自动继承），
// 需在全部 en-US 版本就绪后，按 owning side 显式复制关系链接（值传 documentId，
// document service 会按源 locale=en-US 解析到对应语言的行）。
// 仅列 owning side（manyToOne / m2m inversedBy 侧），inverse side 由 v5 自动维护。
const RELATION_COPY = {
  'api::navigation.navigation': ['parent'],
  'api::page.page': ['parent'],
  'api::product-category.product-category': ['parent'],
  'api::teacher.teacher': ['campus'],
  'api::faq-item.faq-item': ['sourceDocument'],
  'api::product.product': ['categories', 'specs'],
};

// 不翻译的字段 key（小写精确匹配）：机器可读值/枚举/联系方式/URL 等，前端逻辑依赖原值
const SKIP_KEYS = new Set([
  'id', 'documentid', 'locale', 'slug', 'url', 'sku', 'code', 'icon',
  'platform', 'subject', 'category', 'role', 'type', 'status', 'reviewstatus',
  'sourcetype', 'preferredtimeslot', 'phone', 'email', 'wechat', 'icp',
  'publicsecurityrecord', 'businesshours', 'sessionid', 'ipaddress', 'useragent',
  'sourcepage', '__component', 'createdat', 'updatedat', 'publishedat',
  'createdby', 'updatedby', 'published_at', 'created_at', 'updated_at',
  'imgkey', 'categoryslug', 'campusslug', 'prov', 'mime', 'ext', 'hash',
  'formats', 'width', 'height', 'size', 'previewurl', 'alternativecaption',
]);

const META_KEYS = new Set([
  'id', 'documentId', 'locale', 'createdAt', 'updatedAt', 'publishedAt',
  'createdBy', 'updatedBy', 'published_at', 'created_at', 'updated_at',
]);

// 单批翻译请求的最大字符数（超出分批，避免 qwen 输出截断）
const MAX_BATCH_CHARS = 4000;
// 每个文档之间的间隔（防 API 限流）
const DOC_INTERVAL_MS = 300;

const argv = process.argv.slice(2);
const RETRANSLATE = argv.includes('--retranslate');
const DRY_RUN = argv.includes('--dry-run');
const onlyArg = argv.find((a) => a.startsWith('--only='));
const ONLY = onlyArg ? onlyArg.split('=')[1].split(',') : null;

function log(msg) { console.log(`[i18n-en-US] ${msg}`); }
function ok(msg) { console.log(`  ✓ ${msg}`); }
function info(msg) { console.log(`  ⚠ ${msg}`); }
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

/**
 * 收集对象中所有可翻译的字符串字段（递归 components / dynamic zone）
 * 返回 [{ path: [..keys], value: string }]
 */
function collectTranslatable(obj, pathArr = [], out = []) {
  if (obj === null || obj === undefined) return out;
  if (typeof obj === 'string') {
    const key = String(pathArr[pathArr.length - 1] || '').toLowerCase();
    if (!SKIP_KEYS.has(key) && obj.trim() !== '' && !/^[\d\s\p{P}]+$/u.test(obj)) {
      out.push({ path: pathArr, value: obj });
    }
    return out;
  }
  if (Array.isArray(obj)) {
    obj.forEach((item, i) => collectTranslatable(item, [...pathArr, i], out));
    return out;
  }
  if (typeof obj === 'object') {
    // media 对象（含 url+provider/mime）不递归——图片不翻译，原样 round-trip
    if (obj.url && (obj.provider !== undefined || obj.mime !== undefined)) return out;
    for (const [k, v] of Object.entries(obj)) {
      collectTranslatable(v, [...pathArr, k], out);
    }
  }
  return out;
}

/** 按 path 写回翻译值（原地修改） */
function setByPath(obj, pathArr, value) {
  let cur = obj;
  for (let i = 0; i < pathArr.length - 1; i++) {
    cur = cur[pathArr[i]];
    if (cur === undefined || cur === null) return;
  }
  cur[pathArr[pathArr.length - 1]] = value;
}

/** 把待翻译条目按字符数分批 */
function batchItems(items) {
  const batches = [];
  let cur = [];
  let curChars = 0;
  for (const it of items) {
    if (curChars + it.value.length > MAX_BATCH_CHARS && cur.length > 0) {
      batches.push(cur);
      cur = [];
      curChars = 0;
    }
    cur.push(it);
    curChars += it.value.length;
  }
  if (cur.length > 0) batches.push(cur);
  return batches;
}

async function main() {
  log('=== 创建 en-US 本地化数据（含机器翻译）===');
  if (DRY_RUN) log('模式: dry-run（不调用 API、不写入）');
  if (RETRANSLATE) log('模式: retranslate（已有 en-US 版本也重新翻译）');

  const apiKey = process.env.DASHSCOPE_API_KEY;
  if (!apiKey && !DRY_RUN) {
    info('未配置 DASHSCOPE_API_KEY，将创建中文占位的 en-US 版本（不翻译）');
  }

  // 加载编译后的翻译服务
  const distDir = path.resolve(__dirname, '..', 'dist');
  let translateDocument = null;
  if (apiKey && !DRY_RUN) {
    try {
      ({ translateDocument } = require(path.join(distDir, 'src/api/translation/services/translation.js')));
    } catch (e) {
      info(`翻译服务加载失败: ${e.message}，将回退中文占位`);
    }
  }

  const strapi = await createStrapi({ distDir }).load();
  log('Strapi 已启动\n');

  let totalCreated = 0;
  let totalTranslated = 0;
  let totalSkipped = 0;
  let totalError = 0;

  const types = ONLY ? CONTENT_TYPES.filter((t) => ONLY.includes(t.uid)) : CONTENT_TYPES;

  for (const { uid, lookupField } of types) {
    log(`处理 ${uid}`);
    let zhDocs;
    try {
      const result = await strapi.documents(uid).findMany({
        locale: 'zh-CN',
        limit: 1000,
        status: 'published',
      });
      zhDocs = Array.isArray(result) ? result : (result ? [result] : []);
    } catch (e) {
      info(`查询 zh-CN 失败: ${e.message}`);
      totalError++;
      continue;
    }

    if (zhDocs.length === 0) {
      info('无 zh-CN 文档，跳过');
      continue;
    }

    for (const doc of zhDocs) {
      const lookupValue = doc[lookupField] || doc.id;

      // 检查 en-US 版本是否已存在
      let enDoc = null;
      try {
        enDoc = await strapi.documents(uid).findOne({
          documentId: doc.documentId,
          locale: 'en-US',
          status: 'published',
        });
      } catch (e) { /* 不存在 */ }

      if (enDoc && !RETRANSLATE) {
        totalSkipped++;
        continue;
      }

      // 读取 zh-CN 完整文档（populate 全部字段，含 components）
      let zhFull;
      try {
        zhFull = await strapi.documents(uid).findOne({
          documentId: doc.documentId,
          locale: 'zh-CN',
          status: 'published',
          populate: '*',
        });
      } catch (e) {
        info(`读取 zh-CN 完整数据失败 (${lookupValue}): ${e.message}`);
        totalError++;
        continue;
      }
      if (!zhFull) {
        info(`zh-CN 完整数据为空 (${lookupValue})`);
        totalError++;
        continue;
      }

      // 剥离元数据字段；剔除顶层 relation 字段（v5 建 locale 版本时自动继承）
      const contentType = strapi.contentType(uid);
      const fields = {};
      for (const [k, v] of Object.entries(zhFull)) {
        if (META_KEYS.has(k)) continue;
        const attr = contentType.attributes[k];
        if (attr && attr.type === 'relation') continue; // 关系跨 locale 共享，不携带
        if (v === undefined) continue;
        fields[k] = v;
      }

      // 收集可翻译文本
      const items = collectTranslatable(fields);

      if (DRY_RUN) {
        ok(`[dry-run] ${lookupValue}: ${items.length} 个可翻译字段`);
        items.slice(0, 5).forEach((it) => console.log(`      ${it.path.join('.')} = ${it.value.slice(0, 40)}`));
        totalCreated++;
        continue;
      }

      // 翻译（失败回退中文）
      let translatedCount = 0;
      if (translateDocument && items.length > 0) {
        for (const batch of batchItems(items)) {
          const payload = {};
          batch.forEach((it, i) => { payload[`f${i}`] = it.value; });
          try {
            const result = await translateDocument({ apiKey, fields: payload });
            batch.forEach((it, i) => {
              const tv = result[`f${i}`];
              if (typeof tv === 'string' && tv.trim() !== '') {
                setByPath(fields, it.path, tv);
                translatedCount++;
              }
            });
          } catch (e) {
            info(`翻译批次失败 (${lookupValue}): ${e.message}，该批回退中文`);
          }
          await sleep(200);
        }
      }

      // 创建/更新 en-US 版本
      try {
        await strapi.documents(uid).update({
          documentId: doc.documentId,
          data: fields,
          locale: 'en-US',
          status: 'published',
        });
        ok(`en-US ${enDoc ? '重翻' : '创建'}: ${lookupValue}（翻译 ${translatedCount}/${items.length} 字段）`);
        totalCreated++;
        if (translatedCount > 0) totalTranslated++;
      } catch (e) {
        info(`en-US 写入失败 (${lookupValue}): ${e.message}`);
        totalError++;
      }

      await sleep(DOC_INTERVAL_MS);
    }
    log(`  ${uid} 完成\n`);
  }

  // ===== Phase B：复制 owning side 关系到 en-US 版本 =====
  if (!DRY_RUN) {
    log('=== Phase B: 复制关系到 en-US 版本 ===');
    let relUpdated = 0;
    let relSkipped = 0;
    let relError = 0;

    const relTypes = ONLY ? Object.keys(RELATION_COPY).filter((u) => ONLY.includes(u)) : Object.keys(RELATION_COPY);

    for (const uid of relTypes) {
      const relFields = RELATION_COPY[uid];
      let zhDocs;
      try {
        const result = await strapi.documents(uid).findMany({
          locale: 'zh-CN',
          limit: 1000,
          status: 'published',
          populate: relFields,
        });
        zhDocs = Array.isArray(result) ? result : (result ? [result] : []);
      } catch (e) {
        info(`Phase B 查询 ${uid} 失败: ${e.message}`);
        relError++;
        continue;
      }

      for (const doc of zhDocs) {
        // 提取关系 documentId（manyToOne → 对象/null；m2m → 数组）
        const relData = {};
        for (const field of relFields) {
          const val = doc[field];
          if (!val) continue;
          if (Array.isArray(val)) {
            const ids = val.map((v) => v && v.documentId).filter(Boolean);
            if (ids.length > 0) relData[field] = ids;
          } else if (val.documentId) {
            relData[field] = val.documentId;
          }
        }
        if (Object.keys(relData).length === 0) {
          relSkipped++;
          continue;
        }

        try {
          await strapi.documents(uid).update({
            documentId: doc.documentId,
            locale: 'en-US',
            status: 'published',
            data: relData,
          });
          ok(`Phase B ${uid} ${doc.documentId}: ${Object.keys(relData).join(', ')}`);
          relUpdated++;
        } catch (e) {
          info(`Phase B ${uid} ${doc.documentId} 失败: ${e.message}`);
          relError++;
        }
        await sleep(100);
      }
    }

    log(`Phase B 完成: 更新 ${relUpdated}, 跳过(无关系) ${relSkipped}, 错误 ${relError}\n`);
  }

  log('=== 总结 ===');
  log(`创建/更新: ${totalCreated}`);
  log(`含翻译: ${totalTranslated}`);
  log(`跳过(已有): ${totalSkipped}`);
  log(`错误: ${totalError}`);

  await strapi.destroy();
}

main().catch((e) => {
  console.error('FATAL:', e.message);
  console.error(e.stack);
  process.exit(1);
});
