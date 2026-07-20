/**
 * API populate 契约测试。
 *
 * 前端依赖的嵌套媒体字段必须通过 REST API 返回：
 * - seo.ogImage（页面/站点设置的分享图）
 * - socialLinks.qrImage（页脚二维码）
 * - favicon（浏览器图标）
 * 浅层 populate 不会返回组件内的媒体字段，导致前端永远拿不到。
 */
import { describe, test, expect, vi } from 'vitest';

// vitest 无法以 ESM 方式加载 @strapi/strapi（lodash/fp 目录导入问题），
// 但控制器里只需要 factories 占位，真正的断言对象是导出的 POPULATE 常量。
vi.mock('@strapi/strapi', () => ({
  factories: {
    createCoreController: (_uid: string, factory?: unknown) =>
      typeof factory === 'function' ? factory({ strapi: undefined }) : {},
    createCoreService: (_uid: string, factory?: unknown) =>
      typeof factory === 'function' ? factory({ strapi: undefined }) : {},
    createCoreRouter: () => ({}),
  },
}));

describe('API populate 契约（嵌套媒体字段必须深取）', () => {
  test('page 控制器导出 PAGE_POPULATE，seo 深度 populate ogImage', async () => {
    const mod = await import('../api/page/controllers/page');
    const PAGE_POPULATE = (mod as any).PAGE_POPULATE;
    expect(PAGE_POPULATE).toBeDefined();
    const seoPopulate = PAGE_POPULATE.seo?.populate;
    // 允许 '*' 或显式 { ogImage: true }
    const ok =
      seoPopulate === '*' ||
      (typeof seoPopulate === 'object' && seoPopulate !== null && (seoPopulate.ogImage === true || seoPopulate['*']));
    expect(ok).toBe(true);
  });

  test('site-settings 控制器导出 SITE_SETTINGS_POPULATE，含 logo/favicon/seo.ogImage', async () => {
    const mod = await import('../api/site-settings/controllers/site-settings');
    const POPULATE = (mod as any).SITE_SETTINGS_POPULATE;
    expect(POPULATE).toBeDefined();
    const flat: string[] = [];
    const walk = (p: unknown) => {
      if (typeof p === 'string') flat.push(p);
      else if (Array.isArray(p)) p.forEach(walk);
      else if (p && typeof p === 'object') Object.keys(p as object).forEach((k) => flat.push(k));
    };
    walk(POPULATE);
    expect(flat).toContain('logo');
    expect(flat).toContain('favicon');
    expect(flat.some((f) => f === 'seo.ogImage' || f === 'seo')).toBe(true);
    // seo 必须深取 ogImage：字符串形式 'seo.ogImage' 或对象形式 { seo: { populate: ... } }
    const deep =
      flat.includes('seo.ogImage') ||
      (Array.isArray(POPULATE) &&
        POPULATE.some((p: any) => p && typeof p === 'object' && p.seo?.populate));
    expect(deep).toBe(true);
    // fontSettings 组件含 fontFile 媒体，必须深取，否则前端拿不到字体文件 URL
    const fontDeep =
      flat.includes('fontSettings.fontFile') ||
      flat.includes('fontSettings') ||
      (Array.isArray(POPULATE) &&
        POPULATE.some((p: any) => p && typeof p === 'object' && p.fontSettings?.populate));
    expect(fontDeep).toBe(true);
  });

  test('footer 控制器导出 FOOTER_POPULATE，socialLinks 深取 qrImage', async () => {
    const mod = await import('../api/footer/controllers/footer');
    const POPULATE = (mod as any).FOOTER_POPULATE;
    expect(POPULATE).toBeDefined();
    const flat: string[] = [];
    const walk = (p: unknown) => {
      if (typeof p === 'string') flat.push(p);
      else if (Array.isArray(p)) p.forEach(walk);
      else if (p && typeof p === 'object') Object.keys(p as object).forEach((k) => flat.push(k));
    };
    walk(POPULATE);
    const deep =
      flat.includes('socialLinks.qrImage') ||
      (Array.isArray(POPULATE) &&
        POPULATE.some((p: any) => p && typeof p === 'object' && p.socialLinks?.populate));
    expect(deep).toBe(true);
  });
});
