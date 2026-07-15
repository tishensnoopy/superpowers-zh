import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useWechatShare } from '@/hooks/use-wechat-share';

// Mock fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Mock navigator.userAgent
const mockUserAgent = vi.fn();
Object.defineProperty(navigator, 'userAgent', {
  get: () => mockUserAgent(),
  configurable: true,
});

// Partially mock @/lib/wechat — keep isWechatBrowser and getJssdkConfig real
// (they read navigator.userAgent / fetch which are mocked above), but stub
// loadWechatJssdk since jsdom cannot actually load external scripts.
vi.mock('@/lib/wechat', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/wechat')>();
  return {
    ...actual,
    loadWechatJssdk: vi.fn().mockResolvedValue(undefined),
  };
});

describe('useWechatShare', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUserAgent.mockReturnValue('Mozilla/5.0 (Windows NT 10.0)');
  });

  it('非微信环境不加载 JSSDK', () => {
    mockUserAgent.mockReturnValue('Mozilla/5.0 (Windows NT 10.0)');
    const { result } = renderHook(() =>
      useWechatShare({
        title: 'T',
        desc: 'D',
        link: 'https://example.com',
        imgUrl: 'https://example.com/img.jpg',
      })
    );
    expect(result.current.ready).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('微信环境调用后端获取签名配置', async () => {
    mockUserAgent.mockReturnValue(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 MicroMessenger/8.0'
    );
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        appId: 'wx_test',
        timestamp: 123,
        nonceStr: 'abc',
        signature: 'sig',
      }),
    });

    renderHook(() =>
      useWechatShare({
        title: 'T',
        desc: 'D',
        link: 'https://example.com',
        imgUrl: 'https://example.com/img.jpg',
      })
    );

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/wechat/jssdk?url=')
      );
    });
  });

  it('空 shareData 不触发加载', () => {
    mockUserAgent.mockReturnValue('MicroMessenger/8.0');
    const { result } = renderHook(() => useWechatShare(null as any));
    expect(result.current.ready).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('后端返回错误时不崩溃', async () => {
    mockUserAgent.mockReturnValue('MicroMessenger/8.0');
    mockFetch.mockRejectedValueOnce(new Error('network error'));

    const { result } = renderHook(() =>
      useWechatShare({
        title: 'T',
        desc: 'D',
        link: 'https://example.com',
        imgUrl: '',
      })
    );

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });
    expect(result.current.ready).toBe(false);
  });
});
