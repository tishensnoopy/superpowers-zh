import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getAccessToken, getJsapiTicket, resetTokenCache } from '../wechat-token-service';

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('wechat-token-service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetTokenCache();
    process.env.WECHAT_APP_ID = 'test_app_id';
    process.env.WECHAT_APP_SECRET = 'test_app_secret';
  });

  it('getAccessToken 首次调用获取新 token', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ access_token: 'token_abc', expires_in: 7200 }),
    });

    const token = await getAccessToken();
    expect(token).toBe('token_abc');
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('https://api.weixin.qq.com/cgi-bin/token')
    );
  });

  it('getAccessToken 缓存有效时不重复请求', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ access_token: 'token_abc', expires_in: 7200 }),
    });

    await getAccessToken();
    await getAccessToken(); // cached
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('getAccessToken 缓存过期后重新获取', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ access_token: 'token_1', expires_in: 1 }),
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ access_token: 'token_2', expires_in: 7200 }),
    });

    const t1 = await getAccessToken();
    expect(t1).toBe('token_1');
    // Wait for cache to expire (expires_in=1 second, with 5min buffer → immediately expired)
    await new Promise((r) => setTimeout(r, 1100));
    const t2 = await getAccessToken();
    expect(t2).toBe('token_2');
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('getAccessToken 微信 API 返回错误时抛出', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ errcode: 40013, errmsg: 'invalid appid' }),
    });

    await expect(getAccessToken()).rejects.toThrow('invalid appid');
  });

  it('getJsapiTicket 首次调用获取新 ticket', async () => {
    // First call: get access_token
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ access_token: 'token_abc', expires_in: 7200 }),
    });
    // Second call: get jsapi_ticket
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ticket: 'ticket_xyz', expires_in: 7200 }),
    });

    const ticket = await getJsapiTicket();
    expect(ticket).toBe('ticket_xyz');
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('getJsapiTicket 缓存有效时不重复请求', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ access_token: 'token_abc', expires_in: 7200 }),
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ticket: 'ticket_xyz', expires_in: 7200 }),
    });

    await getJsapiTicket();
    await getJsapiTicket(); // cached
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('缺少 WECHAT_APP_ID 时抛出配置错误', async () => {
    delete process.env.WECHAT_APP_ID;
    await expect(getAccessToken()).rejects.toThrow('WECHAT_APP_ID');
  });
});
