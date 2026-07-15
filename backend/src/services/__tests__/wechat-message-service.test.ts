import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sendCustomMessage, truncateContent } from '../wechat-message-service';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Mock token service
vi.mock('../wechat-token-service', () => ({
  getAccessToken: vi.fn().mockResolvedValue('token_abc'),
  resetTokenCache: vi.fn(),
}));

describe('sendCustomMessage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('发送文本客服消息', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ errcode: 0, errmsg: 'ok' }),
    });

    await sendCustomMessage('oAbc123', '你好，欢迎使用');
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('https://api.weixin.qq.com/cgi-bin/message/custom/send'),
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"content":"你好，欢迎使用"'),
      })
    );
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('errcode=0 表示成功，不抛错', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ errcode: 0, errmsg: 'ok' }),
    });
    await expect(sendCustomMessage('user', 'msg')).resolves.not.toThrow();
  });

  it('errcode 非 0 时抛出错误', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ errcode: 45015, errmsg: 'response out of time' }),
    });
    await expect(sendCustomMessage('user', 'msg')).rejects.toThrow('response out of time');
  });

  it('token 失效（40001）时刷新 token 重试一次', async () => {
    const { getAccessToken } = await import('../wechat-token-service');
    const mockedGetAccessToken = vi.mocked(getAccessToken);
    mockedGetAccessToken.mockClear();

    // First attempt: 40001 (invalid token)
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ errcode: 40001, errmsg: 'invalid credential' }),
    });
    // Retry after token refresh: success
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ errcode: 0, errmsg: 'ok' }),
    });

    await sendCustomMessage('user', 'msg');
    expect(mockFetch).toHaveBeenCalledTimes(2);
    // Token fetched at least twice (initial + refresh)
    expect(mockedGetAccessToken.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('重试后仍失败时抛出错误', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ errcode: 40001, errmsg: 'invalid credential' }),
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ errcode: 40001, errmsg: 'still invalid' }),
    });
    await expect(sendCustomMessage('user', 'msg')).rejects.toThrow('still invalid');
  });
});

describe('truncateContent', () => {
  it('短内容不截断', () => {
    expect(truncateContent('你好')).toBe('你好');
  });

  it('超过 2048 字符时截断并加省略号', () => {
    const long = 'A'.repeat(3000);
    const result = truncateContent(long);
    expect(result.length).toBe(2048);
    expect(result.endsWith('…')).toBe(true);
  });
});
