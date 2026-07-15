import { describe, it, expect, vi, beforeEach } from 'vitest';
import { seedI18n, seedEnForContentType, hasEnVersion, EN_PLACEHOLDERS } from '../seed-i18n';

function makeMockDocs(findManyImpl: (opts: any) => Promise<any[]>, createImpl?: (opts: any) => Promise<any>) {
  return vi.fn().mockReturnValue({
    findMany: vi.fn(findManyImpl),
    create: vi.fn(createImpl || (async () => ({ id: 1 }))),
  });
}

describe('EN_PLACEHOLDERS', () => {
  it('generates product placeholder', () => {
    const result = EN_PLACEHOLDERS.product({ title: '拼音班', description: '学拼音' });
    expect(result.title).toBe('拼音班 (EN)');
    expect(result.description).toContain('English description');
  });

  it('generates faq placeholder', () => {
    const result = EN_PLACEHOLDERS.faq({ question: '什么是幼小衔接？', answer: '过渡期教育', category: 'general', sortOrder: 1, isActive: true });
    expect(result.question).toBe('EN: 什么是幼小衔接？');
    expect(result.answer).toBe('EN: 过渡期教育');
    expect(result.category).toBe('general');
    expect(result.sortOrder).toBe(1);
    expect(result.isActive).toBe(true);
  });

  it('generates page placeholder preserving sections', () => {
    const sections = [{ __component: 'section.hero', title: 'Hero' }];
    const result = EN_PLACEHOLDERS.page({ title: '首页', slug: 'home', isHomepage: true, sections, layout: 'full-width', showNavigation: true, showFooter: true });
    expect(result.title).toBe('首页 (EN)');
    expect(result.slug).toBe('home');
    expect(result.isHomepage).toBe(true);
    expect(result.sections).toBe(sections);
  });
});

describe('hasEnVersion', () => {
  it('returns true when en-US version exists', async () => {
    const docs = {
      findMany: vi.fn().mockResolvedValue([{ id: 1, documentId: 'doc-1', locale: 'en-US' }]),
      create: vi.fn(),
    };
    const result = await hasEnVersion(docs as any, 'doc-1');
    expect(result).toBe(true);
    expect(docs.findMany).toHaveBeenCalledWith({
      locale: 'en-US',
      filters: { documentId: 'doc-1' },
      limit: 1,
    });
  });

  it('returns false when en-US version does not exist', async () => {
    const docs = {
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn(),
    };
    const result = await hasEnVersion(docs as any, 'doc-1');
    expect(result).toBe(false);
  });
});

describe('seedEnForContentType', () => {
  it('creates en-US versions for zh-CN entries that lack en-US', async () => {
    const zhEntries = [
      { documentId: 'doc-1', title: '课程A', slug: 'a' },
      { documentId: 'doc-2', title: '课程B', slug: 'b' },
    ];

    const mockFindMany = vi.fn().mockImplementation((opts: any) => {
      if (opts.locale === 'zh-CN') return Promise.resolve(zhEntries);
      // en-US check: doc-1 has EN, doc-2 does not
      if (opts.filters?.documentId === 'doc-1') return Promise.resolve([{ id: 10 }]);
      return Promise.resolve([]);
    });
    const mockCreate = vi.fn().mockResolvedValue({ id: 20 });

    const strapi = {
      documents: makeMockDocs(mockFindMany, mockCreate),
    } as any;

    const created = await seedEnForContentType(strapi, 'api::product.product', EN_PLACEHOLDERS.product);

    // Only doc-2 should be created (doc-1 already has EN)
    expect(created).toBe(1);
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ title: '课程B (EN)' }),
      documentId: 'doc-2',
      locale: 'en-US',
      status: 'published',
    });
  });

  it('skips all entries when en-US versions already exist (idempotent)', async () => {
    const zhEntries = [
      { documentId: 'doc-1', title: '课程A' },
      { documentId: 'doc-2', title: '课程B' },
    ];

    const mockFindMany = vi.fn().mockImplementation((opts: any) => {
      if (opts.locale === 'zh-CN') return Promise.resolve(zhEntries);
      // Both have EN versions
      return Promise.resolve([{ id: 10 }]);
    });
    const mockCreate = vi.fn();

    const strapi = {
      documents: makeMockDocs(mockFindMany, mockCreate),
    } as any;

    const created = await seedEnForContentType(strapi, 'api::product.product', EN_PLACEHOLDERS.product);

    expect(created).toBe(0);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('handles content types that do not support i18n gracefully', async () => {
    const zhEntries = [{ documentId: 'doc-1', question: '问题', answer: '答案' }];

    const mockFindMany = vi.fn().mockImplementation((opts: any) => {
      if (opts.locale === 'zh-CN') return Promise.resolve(zhEntries);
      return Promise.resolve([]); // no EN version
    });
    const mockCreate = vi.fn().mockRejectedValue(new Error('Content type does not support i18n'));

    const strapi = {
      documents: makeMockDocs(mockFindMany, mockCreate),
    } as any;

    const created = await seedEnForContentType(strapi, 'api::faq-item.faq-item', EN_PLACEHOLDERS.faq);

    // Should not throw, should return 0 created
    expect(created).toBe(0);
  });

  it('handles empty zh-CN content gracefully', async () => {
    const mockFindMany = vi.fn().mockResolvedValue([]);
    const mockCreate = vi.fn();

    const strapi = {
      documents: makeMockDocs(mockFindMany, mockCreate),
    } as any;

    const created = await seedEnForContentType(strapi, 'api::product.product', EN_PLACEHOLDERS.product);

    expect(created).toBe(0);
    expect(mockCreate).not.toHaveBeenCalled();
  });
});

describe('seedI18n', () => {
  it('seeds all content types and returns stats', async () => {
    const stats = await seedI18n({
      documents: vi.fn().mockReturnValue({
        findMany: vi.fn().mockImplementation((opts: any) => {
          if (opts.locale === 'zh-CN') {
            return Promise.resolve([{ documentId: 'd1', title: 'test', name: 'test', question: 'q', answer: 'a', slug: 's', sections: [] }]);
          }
          return Promise.resolve([]); // no EN versions
        }),
        create: vi.fn().mockResolvedValue({ id: 1 }),
      }),
      destroy: vi.fn(),
    } as any);

    // Each of the 6 content types should have 1 creation
    expect(stats.products).toBe(1);
    expect(stats.news).toBe(1);
    expect(stats.campuses).toBe(1);
    expect(stats.teachers).toBe(1);
    expect(stats.faqs).toBe(1);
    expect(stats.pages).toBe(1);
  });

  it('is idempotent across multiple runs', async () => {
    // All content types already have EN versions
    const mockStrapi = {
      documents: vi.fn().mockReturnValue({
        findMany: vi.fn().mockImplementation((opts: any) => {
          if (opts.locale === 'zh-CN') {
            return Promise.resolve([{ documentId: 'd1', title: 'test' }]);
          }
          // EN version always exists
          return Promise.resolve([{ id: 1 }]);
        }),
        create: vi.fn(),
      }),
      destroy: vi.fn(),
    } as any;

    const stats1 = await seedI18n(mockStrapi);
    const stats2 = await seedI18n(mockStrapi);

    expect(stats1.products).toBe(0);
    expect(stats2.products).toBe(0);
  });
});
