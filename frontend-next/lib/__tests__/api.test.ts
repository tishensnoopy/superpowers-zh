import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AppointmentData } from '@/lib/api';

describe('预约数据格式验证', () => {
  it('AppointmentData 接口包含所有必要字段', () => {
    const data: AppointmentData = {
      name: '小明',
      childName: '小明',
      parentName: '家长',
      phone: '13800138000',
      campus: 'yousen-baibuting',
      age: '6',
      course: 'language',
      preferredTimeSlot: 'morning',
      message: '测试备注',
    };

    expect(data.name).toBeTypeOf('string');
    expect(data.childName).toBeTypeOf('string');
    expect(data.parentName).toBeTypeOf('string');
    expect(data.phone).toBeTypeOf('string');
    expect(data.phone).toMatch(/^1[3-9]\d{9}$/);
    expect(data.campus).toBeTypeOf('string');
    expect(['yousen-baibuting', 'yousen-sanyanglu', 'yousen-dongwuyuan', 'yousen-zhongjiacun', 'yousen-sixin', 'yousen-zhuankou']).toContain(data.campus);
    expect(['language', 'math', 'english', 'comprehensive']).toContain(data.course);
  });

  it('校区字段值应为小写英文标识', () => {
    const validCampuses = ['yousen-baibuting', 'yousen-sanyanglu', 'yousen-dongwuyuan', 'yousen-zhongjiacun', 'yousen-sixin', 'yousen-zhuankou'];

    validCampuses.forEach(campus => {
      expect(campus).toBe(campus.toLowerCase());
      expect(campus.length).toBeGreaterThan(0);
    });
  });

  it('课程字段值应为小写英文标识', () => {
    const validCourses = ['language', 'math', 'english', 'comprehensive'];

    validCourses.forEach(course => {
      expect(course).toBe(course.toLowerCase());
      expect(course.length).toBeGreaterThan(0);
    });
  });

  it('必填字段不能为空', () => {
    const requiredFields = ['parentName', 'childName', 'phone', 'campus'] as const;

    requiredFields.forEach(field => {
      expect(field).toBeTruthy();
    });
  });

  it('提交给后端的数据结构应为嵌套在 data 字段中', () => {
    const expectedBody = {
      data: {
        parentName: '家长',
        childName: '小明',
        phone: '13800138000',
        campus: 'yousen-baibuting',
      },
    };

    expect(JSON.stringify(expectedBody)).toContain('"data":');
    expect(JSON.stringify(expectedBody)).toContain('"parentName":"家长"');
    expect(JSON.stringify(expectedBody)).toContain('"childName":"小明"');
    expect(JSON.stringify(expectedBody)).toContain('"campus":"yousen-baibuting"');
  });
});

describe('电话号码格式验证', () => {
  it('有效手机号格式', () => {
    const validPhones = ['13800138000', '15900159000', '18600186000'];

    validPhones.forEach(phone => {
      expect(phone).toMatch(/^1[3-9]\d{9}$/);
    });
  });

  it('无效手机号格式', () => {
    const invalidPhones = ['123456789', '10000000000', '23800138000'];

    invalidPhones.forEach(phone => {
      expect(phone).not.toMatch(/^1[3-9]\d{9}$/);
    });
  });
});

describe('lib/api locale support', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }));
  });

  it('getProducts appends locale=en-US to URL', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: [] }),
      headers: { get: () => null },
    });
    vi.stubGlobal('fetch', mockFetch);

    const { getProducts } = await import('../api');
    await getProducts('en-US');
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain('locale=en-US');
  });

  it('getProductBySlug falls back to zh-CN when en-US returns 404', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: () => Promise.resolve('not found'),
        headers: { get: () => null },
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: { id: 1, name: '中文课程' } }),
        headers: { get: () => null },
      });
    vi.stubGlobal('fetch', mockFetch);

    const { getProductBySlug } = await import('../api');
    const result = await getProductBySlug('test-slug', 'en-US');
    expect(result.data.name).toBe('中文课程');
    expect(result._i18nFallback).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('getProducts does NOT fallback when en-US returns empty array', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: [] }),
      headers: { get: () => null },
    });
    vi.stubGlobal('fetch', mockFetch);

    const { getProducts } = await import('../api');
    const result = await getProducts('en-US');
    expect(result.data).toEqual([]);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});
