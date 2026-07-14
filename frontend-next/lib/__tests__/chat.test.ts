import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { startChat, sendMessage, transferToHuman, getChatHistory, type ChatMessageData, type ChatResponse } from '@/lib/chat';

describe('chat API 客户端', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('startChat', () => {
    it('创建会话并返回 sessionId', async () => {
      const mockResponse = {
        sessionId: 'sess-123',
        visitorId: 'vis-456',
      };
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await startChat({ sourcePage: '/about' });

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/chat/start'),
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sourcePage: '/about' }),
        })
      );
      expect(result.sessionId).toBe('sess-123');
      expect(result.visitorId).toBe('vis-456');
    });

    it('不带 sourcePage 也能创建会话', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({ sessionId: 'sess-789', visitorId: 'vis-000' }),
      } as Response);

      const result = await startChat();
      expect(result.sessionId).toBe('sess-789');
    });

    it('请求失败时抛出错误', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      } as Response);

      await expect(startChat()).rejects.toThrow();
    });
  });

  describe('sendMessage', () => {
    it('发送消息并返回 JSON 回复', async () => {
      const mockResponse: ChatResponse = {
        type: 'answer',
        content: '您好！我是佑森小课堂的AI助手。',
        retrievedDocs: 3,
      };
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await sendMessage('sess-123', '你好');

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/chat/message'),
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId: 'sess-123', message: '你好' }),
        })
      );
      expect(result.type).toBe('answer');
      expect(result.content).toBe('您好！我是佑森小课堂的AI助手。');
      expect(result.retrievedDocs).toBe(3);
    });

    it('转人工响应正确返回', async () => {
      const mockResponse: ChatResponse = {
        type: 'transfer',
        content: '好的，正在为您转接人工客服，请稍候...',
      };
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await sendMessage('sess-123', '转人工');

      expect(result.type).toBe('transfer');
      expect(result.content).toContain('转接人工客服');
    });

    it('请求失败时抛出错误', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
      } as Response);

      await expect(sendMessage('sess-123', 'test')).rejects.toThrow();
    });
  });

  describe('transferToHuman', () => {
    it('转人工并返回成功状态', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, sessionId: 'sess-123', status: 'transferred' }),
      } as Response);

      const result = await transferToHuman('sess-123');

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/chat/transfer'),
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId: 'sess-123' }),
        })
      );
      expect(result.success).toBe(true);
      expect(result.status).toBe('transferred');
    });

    it('请求失败时抛出错误', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 500,
      } as Response);

      await expect(transferToHuman('sess-123')).rejects.toThrow();
    });
  });

  describe('getChatHistory', () => {
    it('获取历史消息列表', async () => {
      const mockMessages: ChatMessageData[] = [
        { role: 'user', content: '你好', timestamp: '2026-07-14T10:00:00Z' },
        { role: 'assistant', content: '您好！', timestamp: '2026-07-14T10:00:01Z' },
      ];
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({ messages: mockMessages }),
      } as Response);

      const result = await getChatHistory('sess-123');

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/chat/history/sess-123'),
        expect.objectContaining({ method: 'GET' })
      );
      expect(result.messages).toHaveLength(2);
      expect(result.messages[0].role).toBe('user');
    });

    it('请求失败时抛出错误', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 404,
      } as Response);

      await expect(getChatHistory('sess-999')).rejects.toThrow();
    });
  });
});
