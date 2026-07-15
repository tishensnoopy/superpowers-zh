import { describe, it, expect, vi, beforeEach } from 'vitest';
import { serializeProduct, serializeNews, serializeTeacher, serializeCampus, serializeFaq, syncWebsiteContent, syncSingleContent, deleteSyncedContent } from '../knowledge-sync-service';

describe('knowledge-sync-service 序列化规则', () => {
  it('课程序列化应包含名称/简介/教学目标/教学方式/价格', () => {
    const product = {
      name: '幼小衔接全能班',
      shortDescription: '全面培养',
      objectives: [
        { title: '掌握拼音基础' },
        { title: '认识常用汉字' },
      ],
      teachingMethod: '小班教学',
      price: 3800,
    };
    const text = serializeProduct(product);
    expect(text).toContain('幼小衔接全能班');
    expect(text).toContain('全面培养');
    expect(text).toContain('掌握拼音基础');
    expect(text).toContain('认识常用汉字');
    expect(text).toContain('小班教学');
    expect(text).toContain('3800');
  });

  it('课程序列化空值字段应跳过', () => {
    const product = { name: '测试课程' };
    const text = serializeProduct(product);
    expect(text).toContain('课程：测试课程');
    expect(text).not.toContain('简介：');
    expect(text).not.toContain('教学目标：');
    expect(text).not.toContain('价格：');
  });

  it('课程序列化 description fallback 当 shortDescription 不存在', () => {
    const product = { name: '测试', description: '详细描述' };
    const text = serializeProduct(product);
    expect(text).toContain('简介：详细描述');
  });

  it('课程序列化格式为换行分隔', () => {
    const product = { name: 'A', shortDescription: 'B', price: 100 };
    const text = serializeProduct(product);
    expect(text).toContain('\n');
    const lines = text.split('\n');
    expect(lines[0]).toBe('课程：A');
    expect(lines[1]).toBe('简介：B');
  });
});

describe('syncWebsiteContent', () => {
  const mockStrapi: any = {
    documents: vi.fn(),
    db: { query: vi.fn() },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('应同步课程到知识库', async () => {
    mockStrapi.documents.mockImplementation((uid: string) => {
      if (uid === 'api::product.product') {
        return { findMany: vi.fn().mockResolvedValue([{ id: 1, documentId: 'doc-1', name: '测试课程', description: '描述', price: 1000 }]) };
      }
      if (uid === 'api::knowledge-base.knowledge-base') {
        return { create: vi.fn().mockResolvedValue({ id: 1 }) };
      }
      return { findMany: vi.fn().mockResolvedValue([]) };
    });
    mockStrapi.db.query.mockReturnValue({ findOne: vi.fn().mockResolvedValue(null) });

    const result = await syncWebsiteContent(mockStrapi);
    expect(result.synced).toBeGreaterThan(0);
  });
});

describe('syncSingleContent with locale', () => {
  it('writes locale=en-US to knowledge_base when record has locale=en-US', async () => {
    const mockFindOne = vi.fn().mockResolvedValue(null);
    const mockCreate = vi.fn().mockResolvedValue({});
    const mockStrapi = {
      db: { query: vi.fn().mockReturnValue({ findOne: mockFindOne }) },
      documents: vi.fn().mockReturnValue({ create: mockCreate }),
    } as any;

    await syncSingleContent(mockStrapi, 'api::product.product', {
      documentId: 'doc1',
      name: 'English Course',
      description: 'desc',
      locale: 'en-US',
    });

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ locale: 'en-US' }),
      })
    );
  });

  it('writes locale=zh-CN when record has no locale field', async () => {
    const mockFindOne = vi.fn().mockResolvedValue(null);
    const mockCreate = vi.fn().mockResolvedValue({});
    const mockStrapi = {
      db: { query: vi.fn().mockReturnValue({ findOne: mockFindOne }) },
      documents: vi.fn().mockReturnValue({ create: mockCreate }),
    } as any;

    await syncSingleContent(mockStrapi, 'api::product.product', {
      documentId: 'doc2',
      name: '中文课程',
    });

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ locale: 'zh-CN' }),
      })
    );
  });

  it('creates two independent records for same documentId different locales', async () => {
    const mockFindOne = vi.fn().mockResolvedValue(null);
    const mockCreate = vi.fn().mockResolvedValue({});
    const mockStrapi = {
      db: { query: vi.fn().mockReturnValue({ findOne: mockFindOne }) },
      documents: vi.fn().mockReturnValue({ create: mockCreate }),
    } as any;

    await syncSingleContent(mockStrapi, 'api::product.product', {
      documentId: 'doc1',
      name: '中文课程',
      locale: 'zh-CN',
    });
    await syncSingleContent(mockStrapi, 'api::product.product', {
      documentId: 'doc1',
      name: 'English Course',
      locale: 'en-US',
    });

    expect(mockCreate).toHaveBeenCalledTimes(2);
    const firstCall = mockCreate.mock.calls[0][0].data;
    const secondCall = mockCreate.mock.calls[1][0].data;
    expect(firstCall.locale).toBe('zh-CN');
    expect(secondCall.locale).toBe('en-US');
    // sourceUrl should differ by locale
    expect(firstCall.sourceUrl).not.toBe(secondCall.sourceUrl);
  });

  it('deleteSyncedContent only deletes matching documentId + locale', async () => {
    const mockFindOne = vi.fn().mockResolvedValue({ id: 5, documentId: 'kb1' });
    const mockDeleteVectors = vi.fn();
    const mockDelete = vi.fn();
    const mockStrapi = {
      db: { query: vi.fn().mockReturnValue({ findOne: mockFindOne }) },
      documents: vi.fn().mockReturnValue({ delete: mockDelete }),
      service: vi.fn().mockReturnValue({ deleteVectors: mockDeleteVectors }),
    } as any;

    await deleteSyncedContent(mockStrapi, 'api::product.product', {
      documentId: 'doc1',
      locale: 'en-US',
    });

    expect(mockFindOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          sourceUrl: 'strapi://api::product.product/doc1?locale=en-US',
        }),
      })
    );
    expect(mockDeleteVectors).toHaveBeenCalledWith(5);
    expect(mockDelete).toHaveBeenCalled();
  });
});
