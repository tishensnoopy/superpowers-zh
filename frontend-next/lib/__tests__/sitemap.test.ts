import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('sitemap dynamic URLs', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://example.com';
    vi.mock('@/lib/api', () => ({
      getProducts: vi.fn().mockResolvedValue({
        data: [{ slug: 'pinyin', updatedAt: '2026-01-01T00:00:00Z' }],
      }),
      getNews: vi.fn().mockResolvedValue({
        data: [{ slug: 'opening-notice', publishedAt: '2026-01-15T00:00:00Z' }],
      }),
      getCampuses: vi.fn().mockResolvedValue({
        data: [{ slug: 'baibuting' }],
      }),
      getTeachers: vi.fn().mockResolvedValue({
        data: [{ slug: 'zhang-laoshi' }],
      }),
    }));
  });

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
  });

  it('includes campuses/[slug] dynamic URLs with hreflang', async () => {
    const { default: sitemap } = await import('../../app/sitemap');
    const entries = await sitemap();
    const campusUrls = entries.filter((e) => e.url.includes('/campuses/baibuting'));
    expect(campusUrls).toHaveLength(2);
    const zhEntry = campusUrls.find((e) => !e.url.includes('/en-US'));
    const enEntry = campusUrls.find((e) => e.url.includes('/en-US'));
    expect(zhEntry?.url).toBe('https://example.com/campuses/baibuting');
    expect(enEntry?.url).toBe('https://example.com/en-US/campuses/baibuting');
    expect(zhEntry?.alternates?.languages).toEqual({
      'zh-CN': 'https://example.com/campuses/baibuting',
      'en-US': 'https://example.com/en-US/campuses/baibuting',
    });
  });

  it('includes teachers/[slug] dynamic URLs with hreflang', async () => {
    const { default: sitemap } = await import('../../app/sitemap');
    const entries = await sitemap();
    const teacherUrls = entries.filter((e) => e.url.includes('/teachers/zhang-laoshi'));
    expect(teacherUrls).toHaveLength(2);
    const zhEntry = teacherUrls.find((e) => !e.url.includes('/en-US'));
    const enEntry = teacherUrls.find((e) => e.url.includes('/en-US'));
    expect(zhEntry?.url).toBe('https://example.com/teachers/zhang-laoshi');
    expect(enEntry?.url).toBe('https://example.com/en-US/teachers/zhang-laoshi');
  });
});
