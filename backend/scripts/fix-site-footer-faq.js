#!/usr/bin/env node
/**
 * 修复服务器站点数据（2026-07-19）
 *
 * 背景：服务器 DB 中 site-settings / footer 为种子默认值（"Enterprise Website"），
 * FAQ 有 3 条英文种子数据混入 zh-CN，导致页头页脚显示默认文案、常见问题中英文混杂。
 *
 * 修复内容：
 * 1. site-settings 双语 → 佑森真实品牌信息 + 挂载 logo（从容器 uploads 目录上传）
 * 2. footer 双语 → 真实 copyright / aboutText / socialLinks / quickLinks
 * 3. faq-items：
 *    - "What products do you offer?"（zh 英文种子）→ 你们提供哪些课程？（双语修正）
 *    - "How do I contact customer support?"（zh 英文种子）→ 如何联系客服？（双语修正）
 *    - "What is your return policy?" → 删除整个文档（与"退费政策是什么？"重复，
 *      且种子答案 "30-day return policy for most products" 与教育业务不符）
 *
 * 幂等：已修复的项自动跳过。
 * 用法: node scripts/fix-site-footer-faq.js [--dry-run]
 */
const path = require('path');
const fs = require('fs');
const { createStrapi } = require('@strapi/strapi');

const DRY_RUN = process.argv.includes('--dry-run');

const SITE_SETTINGS = {
  zh: {
    name: '武汉佑森小课堂艺术培训学校有限公司',
    slogan: '专注幼小衔接教育8年',
    address: '武汉市',
  },
  en: {
    name: 'Wuhan YouSen Xiaoketang Art Training School Co., Ltd.',
    slogan: 'Specializing in preschool-to-primary education for 8 years',
    address: 'Wuhan City',
  },
};

const FOOTER = {
  zh: {
    copyright: '© 2026 佑森小课堂. All rights reserved.',
    aboutText: '武汉佑森小课堂艺术培训学校有限公司，专注幼小衔接教育8年，6大校区遍布武汉三镇。',
    socialLinks: [
      { platform: 'wechat', url: '#', label: '微信' },
      { platform: 'weibo', url: '#', label: '微博' },
      { platform: 'douyin', url: '#', label: '抖音' },
    ],
    quickLinks: [
      { title: '预约试听', url: '/contact' },
      { title: '退费政策', url: '/refund-policy' },
      { title: '常见问题', url: '/faq' },
      { title: '关于我们', url: '/about' },
    ],
  },
  en: {
    copyright: '© 2026 YouSen Xiao Ke Tang. All rights reserved.',
    aboutText:
      'Wuhan YouSen Xiao Ke Tang Art Training School Co., Ltd. specializes in preschool-to-primary education for 8 years, with 6 campuses across Wuhan City.',
    socialLinks: [
      { platform: 'wechat', url: '#', label: 'WeChat' },
      { platform: 'weibo', url: '#', label: 'Weibo' },
      { platform: 'douyin', url: '#', label: 'Douyin' },
    ],
    quickLinks: [
      { title: 'Book a Trial Class', url: '/contact' },
      { title: 'Refund Policy', url: '/refund-policy' },
      { title: 'Frequently Asked Questions', url: '/faq' },
      { title: 'About Us', url: '/about' },
    ],
  },
};

const FAQ_FIXES = [
  {
    matchQuestion: 'What products do you offer?',
    zh: {
      question: '你们提供哪些课程？',
      answer:
        '佑森提供幼小衔接全能班、课后托管班、全日制托班三大课程体系，覆盖语文素养（拼音识字）、数学思维、英语启蒙等科目，详情请查看课程体系页面。',
      category: 'course',
    },
    en: {
      question: 'What courses does YouSen offer?',
      answer:
        'YouSen offers three main programs: Preschool-to-Primary Transition Class, After-school Care, and Full-day Daycare, covering Chinese literacy (pinyin & characters), math thinking, and English enlightenment. See the Courses page for details.',
      category: 'course',
    },
  },
  {
    matchQuestion: 'How do I contact customer support?',
    zh: {
      question: '如何联系客服？',
      answer:
        '您可以点击页面右下角的"在线咨询"与客服实时沟通，或通过"预约免费试听"表单留下联系方式，也可以前往"联系我们"页面查看各校区的地址信息。',
      category: 'service',
    },
    en: {
      question: 'How do I contact customer support?',
      answer:
        'You can chat with us via the online consultation window at the bottom-right corner, leave your contact info in the trial-class booking form, or visit the Contact Us page for campus addresses.',
      category: 'service',
    },
  },
];

const FAQ_DELETE = ['What is your return policy?'];

async function findOneByLocale(strapi, uid, locale) {
  const rows = await strapi.documents(uid).findMany({ locale, limit: 1 });
  return rows && rows.length > 0 ? rows[0] : null;
}

async function fixSiteSettings(strapi) {
  console.log('\n=== 1. site-settings ===');
  const zhDoc = await findOneByLocale(strapi, 'api::site-settings.site-settings', 'zh-CN');
  if (!zhDoc) {
    console.error('[site-settings] zh-CN 记录不存在，跳过（应种子已创建）');
    return;
  }
  const documentId = zhDoc.documentId;
  console.log(`[site-settings] documentId=${documentId}, 当前 name="${zhDoc.name}"`);

  // logo：已挂载则跳过，否则从容器 uploads 目录取现成 PNG 上传
  let logoId = zhDoc.logo?.id || null;
  if (!logoId) {
    const uploadsDir = path.resolve(__dirname, '..', 'public', 'uploads');
    const logoFile = fs
      .readdirSync(uploadsDir)
      .find((f) => /^3_FB_0_E536.*\.png$/.test(f) && !f.startsWith('small_') && !f.startsWith('thumbnail_'));
    if (logoFile) {
      const filePath = path.join(uploadsDir, logoFile);
      const stat = fs.statSync(filePath);
      console.log(`[site-settings] 上传 logo: ${logoFile} (${stat.size} bytes)`);
      if (!DRY_RUN) {
        const uploaded = await strapi.plugin('upload').service('upload').upload({
          data: { fileInfo: { name: 'yousen-logo.png', alternativeText: '佑森小课堂 Logo' } },
          files: {
            filepath: filePath,
            originalFilename: 'yousen-logo.png',
            mimetype: 'image/png',
            size: stat.size,
          },
        });
        logoId = Array.isArray(uploaded) ? uploaded[0].id : uploaded.id;
        console.log(`  ✓ logo 已上传 id=${logoId}`);
      }
    } else {
      console.log('[site-settings] 未找到 logo 源文件，跳过 logo 挂载');
    }
  } else {
    console.log(`[site-settings] logo 已存在 id=${logoId}，跳过上传`);
  }

  if (zhDoc.name === SITE_SETTINGS.zh.name && logoId) {
    console.log('[site-settings] zh-CN 已是目标值，跳过');
  } else if (!DRY_RUN) {
    await strapi.documents('api::site-settings.site-settings').update({
      documentId,
      locale: 'zh-CN',
      data: { ...SITE_SETTINGS.zh, ...(logoId ? { logo: logoId } : {}) },
    });
    console.log('  ✓ zh-CN 已更新');
  }

  const enDoc = await strapi
    .documents('api::site-settings.site-settings')
    .findOne({ documentId, locale: 'en-US' });
  if (enDoc && enDoc.name === SITE_SETTINGS.en.name) {
    console.log('[site-settings] en-US 已是目标值，跳过');
  } else if (!DRY_RUN) {
    await strapi.documents('api::site-settings.site-settings').update({
      documentId,
      locale: 'en-US',
      data: SITE_SETTINGS.en,
    });
    console.log('  ✓ en-US 已更新');
  }
}

async function fixFooter(strapi) {
  console.log('\n=== 2. footer ===');
  const zhDoc = await findOneByLocale(strapi, 'api::footer.footer', 'zh-CN');
  if (!zhDoc) {
    console.error('[footer] zh-CN 记录不存在，跳过');
    return;
  }
  const documentId = zhDoc.documentId;
  console.log(`[footer] documentId=${documentId}, 当前 copyright="${zhDoc.copyright}"`);

  if (zhDoc.copyright === FOOTER.zh.copyright) {
    console.log('[footer] zh-CN 已是目标值，跳过');
  } else if (!DRY_RUN) {
    await strapi.documents('api::footer.footer').update({
      documentId,
      locale: 'zh-CN',
      data: FOOTER.zh,
    });
    console.log('  ✓ zh-CN 已更新');
  }

  const enDoc = await strapi
    .documents('api::footer.footer')
    .findOne({ documentId, locale: 'en-US' });
  if (enDoc && enDoc.copyright === FOOTER.en.copyright) {
    console.log('[footer] en-US 已是目标值，跳过');
  } else if (!DRY_RUN) {
    await strapi.documents('api::footer.footer').update({
      documentId,
      locale: 'en-US',
      data: FOOTER.en,
    });
    console.log('  ✓ en-US 已更新');
  }
}

async function fixFaqItems(strapi) {
  console.log('\n=== 3. faq-items ===');
  for (const fix of FAQ_FIXES) {
    const rows = await strapi.documents('api::faq-item.faq-item').findMany({
      locale: 'zh-CN',
      filters: { question: fix.matchQuestion },
      limit: 1,
    });
    const zhDoc = rows && rows[0];
    if (!zhDoc) {
      console.log(`[faq] "${fix.matchQuestion}" 未找到（可能已修复），跳过`);
      continue;
    }
    console.log(`[faq] 修复 documentId=${zhDoc.documentId}: "${fix.matchQuestion}" → "${fix.zh.question}"`);
    if (DRY_RUN) continue;

    await strapi.documents('api::faq-item.faq-item').update({
      documentId: zhDoc.documentId,
      locale: 'zh-CN',
      data: fix.zh,
    });
    await strapi.documents('api::faq-item.faq-item').update({
      documentId: zhDoc.documentId,
      locale: 'en-US',
      data: fix.en,
    });
    console.log('  ✓ 双语已更新');
  }

  for (const q of FAQ_DELETE) {
    const rows = await strapi.documents('api::faq-item.faq-item').findMany({
      locale: 'zh-CN',
      filters: { question: q },
      limit: 1,
    });
    const doc = rows && rows[0];
    if (!doc) {
      console.log(`[faq] 待删除项 "${q}" 未找到（可能已删除），跳过`);
      continue;
    }
    console.log(`[faq] 删除重复文档 documentId=${doc.documentId}: "${q}"（与"退费政策是什么？"重复）`);
    if (!DRY_RUN) {
      await strapi.documents('api::faq-item.faq-item').delete({ documentId: doc.documentId });
      console.log('  ✓ 已删除（全部 locale）');
    }
  }
}

async function main() {
  const strapi = await createStrapi({ distDir: path.resolve(__dirname, '..', 'dist') }).load();
  console.log(`[fix-site-footer-faq] Strapi 已启动${DRY_RUN ? '（dry-run）' : ''}`);

  await fixSiteSettings(strapi);
  await fixFooter(strapi);
  await fixFaqItems(strapi);

  console.log('\n[fix-site-footer-faq] 完成');
  await Promise.race([strapi.destroy(), new Promise((r) => setTimeout(r, 8000))]);
  process.exit(0);
}

main().catch((err) => {
  console.error('[fix-site-footer-faq] 失败:', err);
  process.exit(1);
});
