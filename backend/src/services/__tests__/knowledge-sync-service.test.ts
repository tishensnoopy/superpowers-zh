import { describe, it, expect, vi, beforeEach } from 'vitest';
import { serializeCourse, serializeNews, serializeTeacher, serializeCampus, syncWebsiteContent, syncSingleContent, deleteSyncedContent } from '../knowledge-sync-service';

describe('knowledge-sync-service 序列化规则', () => {
  it('课程序列化应包含标题/描述/年龄/价格', () => {
    const course = { title: '幼小衔接全能班', description: '全面培养', ageRange: '5-6岁', price: '3800元' };
    const text = serializeCourse(course);
    expect(text).toContain('幼小衔接全能班');
    expect(text).toContain('全面培养');
    expect(text).toContain('5-6岁');
    expect(text).toContain('3800元');
  });

  it('新闻序列化应包含标题和内容', () => {
    const news = { title: '开学通知', content: '春季班开始报名' };
    const text = serializeNews(news);
    expect(text).toContain('开学通知');
    expect(text).toContain('春季班开始报名');
  });

  it('教师序列化应包含姓名/职称/简介', () => {
    const teacher = { name: '王老师', title: '高级教师', bio: '10年经验' };
    const text = serializeTeacher(teacher);
    expect(text).toContain('王老师');
    expect(text).toContain('高级教师');
    expect(text).toContain('10年经验');
  });

  it('校区序列化应包含名称/地址/电话/描述', () => {
    const campus = { name: '百步亭校区', address: '江岸区', phone: '027-123', description: '500平米' };
    const text = serializeCampus(campus);
    expect(text).toContain('百步亭校区');
    expect(text).toContain('江岸区');
    expect(text).toContain('027-123');
    expect(text).toContain('500平米');
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
      if (uid === 'api::course.course') {
        return { findMany: vi.fn().mockResolvedValue([{ id: 1, documentId: 'doc-1', title: '测试课程', description: '描述', ageRange: '5岁', price: '1000' }]) };
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

    await syncSingleContent(mockStrapi, 'api::course.course', {
      documentId: 'doc1',
      title: 'English Course',
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

    await syncSingleContent(mockStrapi, 'api::course.course', {
      documentId: 'doc2',
      title: '中文课程',
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

    await syncSingleContent(mockStrapi, 'api::course.course', {
      documentId: 'doc1',
      title: '中文课程',
      locale: 'zh-CN',
    });
    await syncSingleContent(mockStrapi, 'api::course.course', {
      documentId: 'doc1',
      title: 'English Course',
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

    await deleteSyncedContent(mockStrapi, 'api::course.course', {
      documentId: 'doc1',
      locale: 'en-US',
    });

    expect(mockFindOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          sourceUrl: 'strapi://api::course.course/doc1?locale=en-US',
        }),
      })
    );
    expect(mockDeleteVectors).toHaveBeenCalledWith(5);
    expect(mockDelete).toHaveBeenCalled();
  });
});
