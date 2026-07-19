import { describe, it, expect, vi, beforeEach } from 'vitest';
import { serializeProduct, serializeNews, serializeTeacher, serializeCampus, serializeFaq, syncWebsiteContent, syncSingleContent, deleteSyncedContent, reconcileContent } from '../knowledge-sync-service';

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

  it('教师序列化应包含姓名/职称/教龄/学历/教学特色/成就', () => {
    const teacher = {
      name: '王老师',
      title: '高级教师',
      teachingYears: 10,
      education: '本科',
      teachingFeatures: '寓教于乐',
      achievements: ['市级优秀教师', '教学论文一等奖'],
    };
    const text = serializeTeacher(teacher);
    expect(text).toContain('教师：王老师');
    expect(text).toContain('职称：高级教师');
    expect(text).toContain('教龄：10年');
    expect(text).toContain('学历：本科');
    expect(text).toContain('教学特色：寓教于乐');
    expect(text).toContain('市级优秀教师');
    expect(text).toContain('教学论文一等奖');
  });

  it('教师序列化空值字段应跳过', () => {
    const teacher = { name: '测试教师' };
    const text = serializeTeacher(teacher);
    expect(text).toContain('教师：测试教师');
    expect(text).not.toContain('职称：');
    expect(text).not.toContain('教龄：');
    expect(text).not.toContain('学历：');
  });

  it('校区序列化应包含名称/地址/电话/营业时间/交通', () => {
    const campus = {
      name: '百步亭校区',
      address: '江岸区百步亭花园路',
      phone: '027-12345678',
      businessHours: '周一至周五 8:00-18:00',
      transportation: '地铁3号线百步亭站',
      description: '500平米教学区',
    };
    const text = serializeCampus(campus);
    expect(text).toContain('校区：百步亭校区');
    expect(text).toContain('地址：江岸区百步亭花园路');
    expect(text).toContain('电话：027-12345678');
    expect(text).toContain('营业时间：周一至周五 8:00-18:00');
    expect(text).toContain('交通：地铁3号线百步亭站');
    expect(text).toContain('500平米教学区');
  });

  it('校区序列化空值字段应跳过', () => {
    const campus = { name: '测试校区', address: '测试地址' };
    const text = serializeCampus(campus);
    expect(text).toContain('校区：测试校区');
    expect(text).not.toContain('电话：');
    expect(text).not.toContain('营业时间：');
    expect(text).not.toContain('交通：');
  });

  it('新闻序列化应包含标题/发布日期/摘要/内容', () => {
    const news = {
      title: '开学通知',
      publishedAt: '2026-01-15',
      excerpt: '春季班开始报名',
      content: '<p>详细内容</p>',
    };
    const text = serializeNews(news);
    expect(text).toContain('新闻：开学通知');
    expect(text).toContain('发布日期：2026-01-15');
    expect(text).toContain('摘要：春季班开始报名');
    expect(text).toContain('详细内容');
  });

  it('新闻序列化空值字段应跳过', () => {
    const news = { title: '测试新闻' };
    const text = serializeNews(news);
    expect(text).toContain('新闻：测试新闻');
    expect(text).not.toContain('发布日期：');
    expect(text).not.toContain('摘要：');
  });

  it('新闻序列化 content fallback 当 excerpt 不存在', () => {
    const news = { title: '测试', content: '正文内容' };
    const text = serializeNews(news);
    expect(text).toContain('正文内容');
  });

  it('FAQ序列化应包含问题/答案/分类', () => {
    const faq = {
      question: '什么是幼小衔接？',
      answer: '幼儿园到小学的过渡教育',
      category: '课程相关',
    };
    const text = serializeFaq(faq);
    expect(text).toContain('问题：什么是幼小衔接？');
    expect(text).toContain('答案：幼儿园到小学的过渡教育');
    expect(text).toContain('分类：课程相关');
  });

  it('FAQ序列化空值分类应跳过', () => {
    const faq = { question: '测试问题', answer: '测试答案' };
    const text = serializeFaq(faq);
    expect(text).toContain('问题：测试问题');
    expect(text).toContain('答案：测试答案');
    expect(text).not.toContain('分类：');
  });
});

describe('syncWebsiteContent', () => {
  const mockStrapi: any = {
    documents: vi.fn(),
    db: { query: vi.fn() },
    service: vi.fn(() => ({ deleteVectors: vi.fn() })),
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
    mockStrapi.db.query.mockReturnValue({
      findOne: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
    });

    const result = await syncWebsiteContent(mockStrapi);
    expect(result.synced).toBeGreaterThan(0);
  });

  it('findMany 带 status:published + populate:*（草稿不进 KB，组件字段不丢）', async () => {
    const findManyProduct = vi.fn().mockResolvedValue([]);
    const strapi: any = {
      documents: vi.fn((uid: string) => {
        if (uid === 'api::product.product') return { findMany: findManyProduct };
        if (uid === 'api::knowledge-base.knowledge-base') return { create: vi.fn(), update: vi.fn(), delete: vi.fn() };
        return { findMany: vi.fn().mockResolvedValue([]) };
      }),
      db: {
        query: vi.fn(() => ({
          findOne: vi.fn().mockResolvedValue(null),
          findMany: vi.fn().mockResolvedValue([]),
        })),
      },
      service: vi.fn(() => ({ deleteVectors: vi.fn() })),
    };

    await syncWebsiteContent(strapi);

    expect(findManyProduct).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'published', populate: '*', locale: 'zh-CN' })
    );
    expect(findManyProduct).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'published', populate: '*', locale: 'en-US' })
    );
  });

  it('孤儿回收：KB content-sync 文档不在 published 集合内 → 删文档+清向量', async () => {
    const deleteKb = vi.fn();
    const deleteVectors = vi.fn();
    // 后台只剩 1 门已发布课程；KB 里却有 2 条 content-sync（其中 orphan1 是孤儿）
    const strapi: any = {
      documents: vi.fn((uid: string) => {
        if (uid === 'api::product.product') {
          return { findMany: vi.fn().mockResolvedValue([{ documentId: 'alive1', name: '在售课程' }]) };
        }
        if (uid === 'api::knowledge-base.knowledge-base') {
          return { create: vi.fn().mockResolvedValue({ id: 100 }), update: vi.fn(), delete: deleteKb };
        }
        return { findMany: vi.fn().mockResolvedValue([]) };
      }),
      db: {
        query: vi.fn(() => ({
          findOne: vi.fn().mockResolvedValue(null),
          findMany: vi.fn().mockResolvedValue([
            { id: 1, documentId: 'kb-orphan', sourceType: 'content-sync', sourceUrl: 'strapi://api::campus.campus/gone1?locale=zh-CN' },
            { id: 2, documentId: 'kb-manual', sourceType: 'manual', sourceUrl: null }, // 手工文档绝不回收
          ]),
        })),
      },
      service: vi.fn(() => ({ deleteVectors })),
    };

    const result = await syncWebsiteContent(strapi);

    expect(deleteVectors).toHaveBeenCalledWith(1);
    expect(deleteKb).toHaveBeenCalledTimes(1);
    expect(deleteKb).toHaveBeenCalledWith({ documentId: 'kb-orphan' });
    expect(result.removed).toBe(1);
  });
});

describe('reconcileContent（published 为唯一事实来源）', () => {
  function makeStrapi(opts: { published?: any; existingKb?: any }) {
    const findOnePublished = vi.fn().mockResolvedValue(opts.published ?? null);
    const findOneKb = vi.fn().mockResolvedValue(opts.existingKb ?? null);
    const createKb = vi.fn().mockResolvedValue({ id: 10 });
    const updateKb = vi.fn().mockResolvedValue({});
    const deleteKb = vi.fn().mockResolvedValue({});
    const deleteVectors = vi.fn().mockResolvedValue(true);
    const strapi: any = {
      documents: vi.fn((uid: string) => {
        if (uid === 'api::knowledge-base.knowledge-base') {
          return { create: createKb, update: updateKb, delete: deleteKb };
        }
        return { findOne: findOnePublished };
      }),
      db: { query: vi.fn(() => ({ findOne: findOneKb })) },
      service: vi.fn(() => ({ deleteVectors })),
    };
    return { strapi, findOnePublished, findOneKb, createKb, updateKb, deleteKb, deleteVectors };
  }

  it('已发布内容 → 创建 KB 文档（sourceUrl 含 locale）', async () => {
    const { strapi, createKb } = makeStrapi({
      published: { documentId: 'p1', name: '幼小衔接全能班', price: 3800, locale: 'zh-CN' },
    });
    await reconcileContent(strapi, 'api::product.product', { documentId: 'p1', locale: 'zh-CN' });
    expect(createKb).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          title: '幼小衔接全能班',
          sourceType: 'content-sync',
          sourceUrl: 'strapi://api::product.product/p1?locale=zh-CN',
          locale: 'zh-CN',
          status: 'pending',
        }),
      })
    );
  });

  it('已发布内容 + 已有 KB → 更新并置回 pending（触发重向量化）', async () => {
    const { strapi, updateKb, createKb } = makeStrapi({
      published: { documentId: 'p1', name: '改名后的课程', locale: 'zh-CN' },
      existingKb: { id: 5, documentId: 'kb1' },
    });
    await reconcileContent(strapi, 'api::product.product', { documentId: 'p1', locale: 'zh-CN' });
    expect(updateKb).toHaveBeenCalledWith(
      expect.objectContaining({
        documentId: 'kb1',
        data: expect.objectContaining({ title: '改名后的课程', status: 'pending' }),
      })
    );
    expect(createKb).not.toHaveBeenCalled();
  });

  it('草稿保存（无 published 版本）且 KB 无记录 → 不创建任何文档', async () => {
    const { strapi, createKb, deleteKb } = makeStrapi({ published: null });
    await reconcileContent(strapi, 'api::product.product', { documentId: 'p1', locale: 'zh-CN' });
    expect(createKb).not.toHaveBeenCalled();
    expect(deleteKb).not.toHaveBeenCalled();
  });

  it('取消发布/删除（无 published 版本）且 KB 有记录 → 删 KB 文档并清向量', async () => {
    const { strapi, deleteKb, deleteVectors } = makeStrapi({
      published: null,
      existingKb: { id: 5, documentId: 'kb1' },
    });
    await reconcileContent(strapi, 'api::product.product', { documentId: 'p1', locale: 'zh-CN' });
    expect(deleteVectors).toHaveBeenCalledWith(5);
    expect(deleteKb).toHaveBeenCalledWith({ documentId: 'kb1' });
  });

  it('查询 published 版本带 status+populate（objectives 等组件字段不丢失）', async () => {
    const { strapi, findOnePublished } = makeStrapi({
      published: { documentId: 'p1', name: 'x', locale: 'zh-CN' },
    });
    await reconcileContent(strapi, 'api::product.product', { documentId: 'p1', locale: 'zh-CN' });
    expect(findOnePublished).toHaveBeenCalledWith(
      expect.objectContaining({
        documentId: 'p1',
        locale: 'zh-CN',
        status: 'published',
        populate: '*',
      })
    );
  });

  it('en-US locale → sourceUrl 带 locale=en-US', async () => {
    const { strapi, createKb } = makeStrapi({
      published: { documentId: 'p1', name: 'English Course', locale: 'en-US' },
    });
    await reconcileContent(strapi, 'api::product.product', { documentId: 'p1', locale: 'en-US' });
    expect(createKb).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          sourceUrl: 'strapi://api::product.product/p1?locale=en-US',
          locale: 'en-US',
        }),
      })
    );
  });

  it('未知 UID → 静默返回不报错', async () => {
    const { strapi, createKb } = makeStrapi({ published: { documentId: 'x' } });
    await expect(
      reconcileContent(strapi, 'api::unknown.unknown', { documentId: 'x', locale: 'zh-CN' })
    ).resolves.toBeUndefined();
    expect(createKb).not.toHaveBeenCalled();
  });

  it('序列化用 published 版本数据，不用事件载荷（syncSingleContent 薄封装验证）', async () => {
    const { strapi, createKb } = makeStrapi({
      published: { documentId: 'p1', name: '正式名称', locale: 'zh-CN' },
    });
    await syncSingleContent(strapi, 'api::product.product', {
      documentId: 'p1',
      name: 'DRAFT草稿名',
      locale: 'zh-CN',
    });
    expect(createKb).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ title: '正式名称' }) })
    );
  });

  it('deleteSyncedContent 同样走 reconcile（条目删除 → KB 删除）', async () => {
    const { strapi, deleteKb, deleteVectors } = makeStrapi({
      published: null,
      existingKb: { id: 7, documentId: 'kb9' },
    });
    await deleteSyncedContent(strapi, 'api::product.product', { documentId: 'p1', locale: 'en-US' });
    expect(deleteVectors).toHaveBeenCalledWith(7);
    expect(deleteKb).toHaveBeenCalledWith({ documentId: 'kb9' });
  });
});
