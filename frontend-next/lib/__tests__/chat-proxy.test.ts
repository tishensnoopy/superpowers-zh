import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getBackendUrl, proxyJsonRequest, proxySSERequest } from '@/lib/chat-proxy';

describe('chat-proxy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getBackendUrl', () => {
    it('优先使用 STRAPI_API_URL_SSR', () => {
      vi.stubEnv('STRAPI_API_URL_SSR', 'http://backend:1337');
      vi.stubEnv('NEXT_PUBLIC_STRAPI_API_URL', 'http://localhost:1337');
      expect(getBackendUrl()).toBe('http://backend:1337');
    });

    it('回退到 NEXT_PUBLIC_STRAPI_API_URL', () => {
      vi.stubEnv('STRAPI_API_URL_SSR', '');
      vi.stubEnv('NEXT_PUBLIC_STRAPI_API_URL', 'http://localhost:1337');
      expect(getBackendUrl()).toBe('http://localhost:1337');
    });

    it('最终回退到默认 URL', () => {
      vi.stubEnv('STRAPI_API_URL_SSR', '');
      vi.stubEnv('NEXT_PUBLIC_STRAPI_API_URL', '');
      expect(getBackendUrl()).toBe('http://localhost:1337');
    });
  });

  describe('proxyJsonRequest', () => {
    it('POST 请求代理到后端并返回 JSON', async () => {
      const mockData = { sessionId: 'test-123', visitorId: 'vis-456' };
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockData,
      } as Response);

      const response = await proxyJsonRequest('/api/chat/start', { sourcePage: '/' });

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/chat/start'),
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sourcePage: '/' }),
        })
      );
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.sessionId).toBe('test-123');
    });

    it('GET 请求不发送 body', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ messages: [] }),
      } as Response);

      await proxyJsonRequest('/api/chat/history/sess-123', null, 'GET');

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/chat/history/sess-123'),
        expect.objectContaining({
          method: 'GET',
          body: undefined,
        })
      );
    });
  });

  describe('proxySSERequest', () => {
    it('成功代理 SSE 流', async () => {
      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('data: {"token":"你好"}\n\n'));
          controller.close();
        },
      });

      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        body: mockStream,
      } as Response);

      const response = await proxySSERequest('/api/chat/message', {
        sessionId: 'sess-123',
        message: '你好',
      });

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('text/event-stream');
      expect(response.headers.get('Cache-Control')).toBe('no-cache');
      expect(response.body).toBeDefined();
    });

    it('后端错误时返回错误 JSON', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error',
        body: null,
      } as Response);

      const response = await proxySSERequest('/api/chat/message', {
        sessionId: 'sess-123',
        message: 'test',
      });

      expect(response.status).toBe(500);
      expect(response.headers.get('Content-Type')).toBe('application/json');
      const data = await response.json();
      expect(data.error).toContain('500');
    });

    it('后端返回空 body 时返回错误', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        body: null,
        text: async () => '',
      } as Response);

      const response = await proxySSERequest('/api/chat/message', {
        sessionId: 'sess-123',
        message: 'test',
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.error).toBeDefined();
    });
  });
});
