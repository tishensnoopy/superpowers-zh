import { describe, it, expect, vi, beforeEach } from 'vitest';
import { verify, handleMessage, getJssdkConfig } from '../wechat';
import * as crypto from 'crypto';

// Mock wechat service
vi.mock('../../services/wechat', () => ({
  verifySignature: vi.fn((sig: string, ts: string, nonce: string, token: string) => {
    const sorted = [token, ts, nonce].sort().join('');
    return sig === crypto.createHash('sha1').update(sorted).digest('hex');
  }),
  parseXml: vi.fn(async (xml: string) => {
    // Simple mock for test
    if (xml.includes('text')) {
      return { ToUserName: 'gh_123', FromUserName: 'oAbc123', MsgType: 'text', Content: '你好' };
    }
    return { ToUserName: 'gh_123', FromUserName: 'oAbc123', MsgType: 'image' };
  }),
  buildTextXml: vi.fn((toUser: string, fromUser: string, content: string) =>
    `<xml><ToUserName>${toUser}</ToUserName><Content>${content}</Content></xml>`
  ),
  handleIncomingMessage: vi.fn(async (_strapi: any, _msg: any) => ({
    passiveReply: 'AI回复',
    asyncFollowUp: false,
  })),
  getJssdkConfig: vi.fn(async (_url: string) => ({
    appId: 'wx_test', timestamp: 123, nonceStr: 'abc', signature: 'sig',
  })),
}));

describe('wechat controller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.WECHAT_TOKEN = 'mytesttoken';
    process.env.WECHAT_APP_ID = 'wx_test';
  });

  describe('verify (GET /wechat/webhook)', () => {
    it('正确签名返回 echostr', async () => {
      const timestamp = '1609459200';
      const nonce = 'abc123';
      const sorted = ['mytesttoken', timestamp, nonce].sort().join('');
      const signature = crypto.createHash('sha1').update(sorted).digest('hex');

      const ctx: any = {
        query: { signature, timestamp, nonce, echostr: 'echo123' },
      };

      await verify(ctx);
      expect(ctx.body).toBe('echo123');
    });

    it('错误签名返回 401', async () => {
      const ctx: any = {
        query: { signature: 'wrong', timestamp: '1609459200', nonce: 'abc', echostr: 'echo' },
        throw: (code: number, msg: string) => { const e: any = new Error(msg); e.status = code; throw e; },
      };

      await expect(verify(ctx)).rejects.toThrow();
    });

    it('缺少 echostr 返回 400', async () => {
      const ctx: any = {
        query: { signature: 'x', timestamp: 'x', nonce: 'x' },
        throw: (code: number, msg: string) => { const e: any = new Error(msg); e.status = code; throw e; },
      };
      await expect(verify(ctx)).rejects.toThrow();
    });
  });

  describe('handleMessage (POST /wechat/webhook)', () => {
    it('文本消息返回被动回复 XML', async () => {
      const ctx: any = {
        request: { body: '<xml><MsgType>text</MsgType></xml>' },
        strapi: {},
      };

      await handleMessage(ctx);
      expect(ctx.body).toContain('AI回复');
    });

    it('空 body 返回空响应', async () => {
      const ctx: any = {
        request: { body: '' },
        strapi: {},
      };

      await handleMessage(ctx);
      expect(ctx.body).toBe('');
    });
  });

  describe('getJssdkConfig (GET /wechat/jssdk)', () => {
    it('返回签名配置', async () => {
      const ctx: any = {
        query: { url: 'https://example.com/page' },
      };

      await getJssdkConfig(ctx);
      expect(ctx.body.appId).toBe('wx_test');
      expect(ctx.body.signature).toBeDefined();
    });

    it('缺少 url 参数返回 400', async () => {
      const ctx: any = {
        query: {},
        throw: (code: number, msg: string) => { const e: any = new Error(msg); e.status = code; throw e; },
      };

      await expect(getJssdkConfig(ctx)).rejects.toThrow();
    });
  });
});
