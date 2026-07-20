/**
 * 后台可调整入口 —— schema 契约测试。
 *
 * 客户要求：前台可见的内容，后台必须有对应编辑入口。
 * 本文件锁定 content-type / component schema 中必须存在的字段，
 * 防止"前台写死、后台改不了"的回归。
 */
import { describe, test, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const SRC_ROOT = join(__dirname, '..');

function readSchema(rel: string): Record<string, any> {
  return JSON.parse(readFileSync(join(SRC_ROOT, rel), 'utf-8'));
}

describe('后台可调整入口 — schema 契约', () => {
  describe('hero 组件（section/hero.json）', () => {
    const schema = readSchema('components/section/hero.json');

    test('image1 媒体字段存在（上层左侧图片后台可换）', () => {
      expect(schema.attributes.image1).toMatchObject({ type: 'media' });
    });

    test('image2 媒体字段存在（上层右侧图片后台可换）', () => {
      expect(schema.attributes.image2).toMatchObject({ type: 'media' });
    });

    test('badgeText 字段存在（徽章文案后台可改）', () => {
      expect(schema.attributes.badgeText).toMatchObject({ type: 'string' });
    });

    test('stats 可重复组件存在（统计数字后台可增删改）', () => {
      expect(schema.attributes.stats).toMatchObject({
        type: 'component',
        repeatable: true,
        component: 'common.stat',
      });
    });
  });

  describe('common/stat 组件', () => {
    test('组件文件存在且含 value/label 字段', () => {
      const p = join(SRC_ROOT, 'components/common/stat.json');
      expect(existsSync(p)).toBe(true);
      const s = JSON.parse(readFileSync(p, 'utf-8'));
      expect(s.attributes.value).toMatchObject({ type: 'string' });
      expect(s.attributes.label).toMatchObject({ type: 'string' });
    });
  });

  describe('social-link 组件（common/social-link.json）', () => {
    const schema = readSchema('components/common/social-link.json');

    test('qrImage 媒体字段存在（关注二维码后台可加）', () => {
      expect(schema.attributes.qrImage).toMatchObject({ type: 'media' });
    });

    test('url 不再必填（支持纯二维码条目）', () => {
      expect(schema.attributes.url?.required).not.toBe(true);
    });
  });

  describe('site-settings（全局设置）', () => {
    const schema = readSchema('api/site-settings/content-types/site-settings/schema.json');

    test('primaryColor 字段存在（品牌主色后台可调）', () => {
      expect(schema.attributes.primaryColor).toMatchObject({ type: 'string' });
    });

    test('darkColor 字段存在（深色文字/背景色后台可调）', () => {
      expect(schema.attributes.darkColor).toMatchObject({ type: 'string' });
    });

    test('fontSettings 为 common.font-settings 组件（结构化表单，非裸 JSON）', () => {
      expect(schema.attributes.fontSettings).toMatchObject({
        type: 'component',
        component: 'common.font-settings',
      });
    });

    test('aiSummary 文本字段存在（GEO：AI 摘要后台可改）', () => {
      expect(schema.attributes.aiSummary).toMatchObject({ type: 'text' });
    });
  });

  describe('font-settings 组件（common/font-settings.json）', () => {
    const schema = readSchema('components/common/font-settings.json');

    test('fontFamily 字段存在（字体族名称）', () => {
      expect(schema.attributes.fontFamily).toMatchObject({ type: 'string' });
    });

    test('fontFile 媒体字段存在（自定义字体文件后台可传）', () => {
      expect(schema.attributes.fontFile).toMatchObject({ type: 'media' });
    });

    test('fontFormat 枚举字段存在（woff2/ttf/otf/woff）', () => {
      expect(schema.attributes.fontFormat).toMatchObject({ type: 'enumeration' });
      expect(schema.attributes.fontFormat.enum).toEqual(
        expect.arrayContaining(['woff2', 'ttf', 'otf', 'woff'])
      );
    });

    test('fontWeight 字段存在', () => {
      expect(schema.attributes.fontWeight).toMatchObject({ type: 'string' });
    });

    test('fontDisplay 枚举字段存在', () => {
      expect(schema.attributes.fontDisplay).toMatchObject({ type: 'enumeration' });
      expect(schema.attributes.fontDisplay.enum).toEqual(
        expect.arrayContaining(['swap', 'block', 'fallback', 'optional'])
      );
    });
  });

  describe('seo 组件增强（common/seo.json）', () => {
    const schema = readSchema('components/common/seo.json');

    test('noindex 布尔字段存在（后台可控制页面不被索引）', () => {
      expect(schema.attributes.noindex).toMatchObject({ type: 'boolean' });
    });
  });

  describe('site-settings 站长验证 + 统计代码（SEO/GEO 增强）', () => {
    const schema = readSchema('api/site-settings/content-types/site-settings/schema.json');

    test('googleVerification 字段存在（Google Search Console 验证）', () => {
      expect(schema.attributes.googleVerification).toMatchObject({ type: 'string' });
    });

    test('bingVerification 字段存在（Bing Webmaster 验证）', () => {
      expect(schema.attributes.bingVerification).toMatchObject({ type: 'string' });
    });

    test('baiduVerification 字段存在（百度站长验证）', () => {
      expect(schema.attributes.baiduVerification).toMatchObject({ type: 'string' });
    });

    test('analytics 组件存在（统计代码：GA4 / 百度统计 / Facebook Pixel）', () => {
      expect(schema.attributes.analytics).toMatchObject({
        type: 'component',
        component: 'common.analytics',
      });
    });

    test('defaultOgImage 媒体字段存在（站点级默认分享图）', () => {
      expect(schema.attributes.defaultOgImage).toMatchObject({ type: 'media' });
    });
  });

  describe('analytics 组件（common/analytics.json）', () => {
    const schema = readSchema('components/common/analytics.json');

    test('ga4Id 字段存在（Google Analytics 4 ID）', () => {
      expect(schema.attributes.ga4Id).toMatchObject({ type: 'string' });
    });

    test('baiduTongjiId 字段存在（百度统计 ID）', () => {
      expect(schema.attributes.baiduTongjiId).toMatchObject({ type: 'string' });
    });

    test('facebookPixelId 字段存在（Facebook Pixel ID）', () => {
      expect(schema.attributes.facebookPixelId).toMatchObject({ type: 'string' });
    });
  });

  describe('各内容类型 aiSummary 字段（GEO：每条内容独立 AI 摘要）', () => {
    test('product 有 aiSummary（课程级 AI 摘要）', () => {
      const schema = readSchema('api/product/content-types/product/schema.json');
      expect(schema.attributes.aiSummary).toMatchObject({ type: 'text' });
    });

    test('campus 有 aiSummary（校区级 AI 摘要）', () => {
      const schema = readSchema('api/campus/content-types/campus/schema.json');
      expect(schema.attributes.aiSummary).toMatchObject({ type: 'text' });
    });

    test('teacher 有 aiSummary（教师级 AI 摘要）', () => {
      const schema = readSchema('api/teacher/content-types/teacher/schema.json');
      expect(schema.attributes.aiSummary).toMatchObject({ type: 'text' });
    });

    test('news-article 有 aiSummary（新闻级 AI 摘要）', () => {
      const schema = readSchema('api/news-article/content-types/news-article/schema.json');
      expect(schema.attributes.aiSummary).toMatchObject({ type: 'text' });
    });
  });
});
