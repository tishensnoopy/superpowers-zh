import { describe, it, expect, vi, beforeEach } from 'vitest';
import { verifySignature, parseXml, buildTextXml, handleIncomingMessage, getJssdkConfig } from '../wechat';

// Mock token service
vi.mock('../../../../services/wechat-token-service', () => ({
  getAccessToken: vi.fn().mockResolvedValue('token_abc'),
  getJsapiTicket: vi.fn().mockResolvedValue('ticket_xyz'),
  generateJssdkSignature: vi.fn().mockReturnValue('mock_signature'),
  resetTokenCache: vi.fn(),
}));

// Mock message service
vi.mock('../../../../services/wechat-message-service', () => ({
  sendCustomMessage: vi.fn().mockResolvedValue(undefined),
}));

describe('verifySignature', () => {
  it('正确签名返回 true', () => {
    const token = 'mytesttoken';
    const timestamp = '1609459200';
    const nonce = 'abc123';
    const sorted = [token, timestamp, nonce].sort().join('');
    const crypto = require('crypto');
    const expected = crypto.createHash('sha1').update(sorted).digest('hex');
    expect(verifySignature(expected, timestamp, nonce, token)).toBe(true);
  });

  it('错误签名返回 false', () => {
    expect(verifySignature('wrong', '1609459200', 'abc123', 'mytesttoken')).toBe(false);
  });

  it('空签名返回 false', () => {
    expect(verifySignature('', '1609459200', 'abc123', 'mytesttoken')).toBe(false);
  });
});

describe('parseXml', () => {
  it('解析文本消息 XML', async () => {
    const xml = `<xml>
      <ToUserName><![CDATA[gh_123]]></ToUserName>
      <FromUserName><![CDATA[oAbc123]]></FromUserName>
      <CreateTime>1609459200</CreateTime>
      <MsgType><![CDATA[text]]></MsgType>
      <Content><![CDATA[你好]]></Content>
      <MsgId>1234567890</MsgId>
    </xml>`;
    const msg = await parseXml(xml);
    expect(msg.ToUserName).toBe('gh_123');
    expect(msg.FromUserName).toBe('oAbc123');
    expect(msg.MsgType).toBe('text');
    expect(msg.Content).toBe('你好');
    expect(msg.MsgId).toBe('1234567890');
  });

  it('解析图片消息 XML（MsgType=image 无 Content）', async () => {
    const xml = `<xml>
      <ToUserName><![CDATA[gh_123]]></ToUserName>
      <FromUserName><![CDATA[oAbc123]]></FromUserName>
      <CreateTime>1609459200</CreateTime>
      <MsgType><![CDATA[image]]></MsgType>
      <PicUrl><![CDATA[http://example.com/img.jpg]]></PicUrl>
      <MsgId>1234567890</MsgId>
    </xml>`;
    const msg = await parseXml(xml);
    expect(msg.MsgType).toBe('image');
    expect(msg.Content).toBeUndefined();
  });

  it('空 XML 返回空对象', async () => {
    const msg = await parseXml('<xml></xml>');
    expect(msg).toBeDefined();
  });
});

describe('buildTextXml', () => {
  it('构造文本回复 XML', () => {
    const xml = buildTextXml('oAbc123', 'gh_123', '你好，欢迎');
    expect(xml).toContain('<ToUserName><![CDATA[oAbc123]]></ToUserName>');
    expect(xml).toContain('<FromUserName><![CDATA[gh_123]]></FromUserName>');
    expect(xml).toContain('<MsgType><![CDATA[text]]></MsgType>');
    expect(xml).toContain('<Content><![CDATA[你好，欢迎]]></Content>');
  });

  it('XML 中转义特殊字符', () => {
    const xml = buildTextXml('user', 'app', '<script>alert(1)</script>');
    expect(xml).not.toContain('<script>');
    expect(xml).toContain('&lt;script&gt;');
  });
});

describe('handleIncomingMessage', () => {
  function buildMockStrapi(options?: {
    sessionExists?: boolean;
    chatStatus?: string;
    aiResponse?: string;
    aiDelay?: number;
    shouldTransfer?: boolean;
    isRelevant?: boolean;
  }) {
    const sessionExists = options?.sessionExists ?? false;
    const aiResponse = options?.aiResponse ?? '这是AI回复';
    const aiDelay = options?.aiDelay ?? 100;
    const shouldTransfer = options?.shouldTransfer ?? false;
    const isRelevant = options?.isRelevant ?? true;

    const sessionRow = sessionExists
      ? { id: 1, documentId: 'doc-1', sessionId: 'wechat:oAbc123', status: options?.chatStatus || 'active', messageCount: 0, locale: 'zh-CN' }
      : null;

    const mockFindMany = vi.fn().mockResolvedValue(sessionRow ? [sessionRow] : []);

    return {
      documents: vi.fn((uid: string) => {
        if (uid === 'api::chat-session.chat-session') {
          return {
            findMany: mockFindMany,
            create: vi.fn().mockResolvedValue({ id: 2, documentId: 'doc-2' }),
          };
        }
        if (uid === 'api::chat-message.chat-message') {
          return {
            create: vi.fn().mockResolvedValue({ id: 1, documentId: 'msg-1' }),
            findMany: vi.fn().mockResolvedValue([]),
          };
        }
        throw new Error(`unexpected uid: ${uid}`);
      }),
      db: {
        query: vi.fn((uid: string) => {
          if (uid === 'api::chat-session.chat-session') {
            return { update: vi.fn().mockResolvedValue({}) };
          }
          if (uid === 'api::chat-message.chat-message') {
            return { findMany: vi.fn().mockResolvedValue([]) };
          }
          throw new Error(`unexpected db.query uid: ${uid}`);
        }),
      },
      __aiResponse: aiResponse,
      __aiDelay: aiDelay,
      __shouldTransfer: shouldTransfer,
      __isRelevant: isRelevant,
    };
  }

  it('文本消息返回 AI 回复（快响应 < 4s）', async () => {
    const mockStrapi = buildMockStrapi({ sessionExists: false, aiResponse: '你好，欢迎咨询', aiDelay: 10 });
    const msg: any = {
      ToUserName: 'gh_123',
      FromUserName: 'oAbc123',
      MsgType: 'text',
      Content: '你好',
    };

    const Module = require('module');
    const originalLoad = Module._load;
    Module._load = function (request: string) {
      if (request.endsWith('llm-service')) {
        return { detectIntent: async () => ({ shouldTransfer: false }) };
      }
      if (request.endsWith('rag-service')) {
        return {
          retrieve: async () => ({ docs: [{ id: 1, chunk_text: '内容' }], isRelevant: mockStrapi.__isRelevant, usedFallback: false }),
          generateAnswer: async () => {
            await new Promise((r) => setTimeout(r, mockStrapi.__aiDelay));
            return mockStrapi.__aiResponse;
          },
        };
      }
      return originalLoad.apply(this, arguments);
    };

    try {
      const result = await handleIncomingMessage(mockStrapi, msg);
      expect(result.passiveReply).toBe('你好，欢迎咨询');
      expect(result.asyncFollowUp).toBe(false);
    } finally {
      Module._load = originalLoad;
    }
  });

  it('非文本消息回复"暂不支持此消息类型"', async () => {
    const msg: any = {
      ToUserName: 'gh_123',
      FromUserName: 'oAbc123',
      MsgType: 'image',
    };
    const result = await handleIncomingMessage({} as any, msg);
    expect(result.passiveReply).toContain('暂不支持');
    expect(result.asyncFollowUp).toBe(false);
  });

  it('转人工信号返回"已转接人工客服"', async () => {
    const mockStrapi = buildMockStrapi({ sessionExists: false, shouldTransfer: true });
    const msg: any = {
      ToUserName: 'gh_123',
      FromUserName: 'oAbc123',
      MsgType: 'text',
      Content: '我要找人工',
    };

    const Module = require('module');
    const originalLoad = Module._load;
    Module._load = function (request: string) {
      if (request.endsWith('llm-service')) {
        return { detectIntent: async () => ({ shouldTransfer: true }) };
      }
      if (request.endsWith('rag-service')) {
        return {
          retrieve: async () => ({ docs: [], isRelevant: true, usedFallback: false }),
          generateAnswer: async () => 'unused',
        };
      }
      return originalLoad.apply(this, arguments);
    };

    try {
      const result = await handleIncomingMessage(mockStrapi, msg);
      expect(result.passiveReply).toContain('转接人工');
      expect(result.asyncFollowUp).toBe(false);
    } finally {
      Module._load = originalLoad;
    }
  });

  it('AI 响应 >= 4s 时返回"正在查询"并标记异步跟进', async () => {
    const mockStrapi = buildMockStrapi({ sessionExists: false, aiResponse: '慢回复', aiDelay: 4100 });
    const msg: any = {
      ToUserName: 'gh_123',
      FromUserName: 'oAbc123',
      MsgType: 'text',
      Content: '复杂问题',
    };

    const Module = require('module');
    const originalLoad = Module._load;
    Module._load = function (request: string) {
      if (request.endsWith('llm-service')) {
        return { detectIntent: async () => ({ shouldTransfer: false }) };
      }
      if (request.endsWith('rag-service')) {
        return {
          retrieve: async () => ({ docs: [{ id: 1, chunk_text: '内容' }], isRelevant: true, usedFallback: false }),
          generateAnswer: async () => {
            await new Promise((r) => setTimeout(r, 4100));
            return '慢回复';
          },
        };
      }
      return originalLoad.apply(this, arguments);
    };

    try {
      const result = await handleIncomingMessage(mockStrapi, msg);
      expect(result.passiveReply).toContain('正在');
      expect(result.asyncFollowUp).toBe(true);
      expect(result.openid).toBe('oAbc123');
    } finally {
      Module._load = originalLoad;
    }
  }, 10000);

  it('知识库无相关内容（isRelevant=false）返回引导留资', async () => {
    const mockStrapi = buildMockStrapi({ sessionExists: false, isRelevant: false });
    const msg: any = {
      ToUserName: 'gh_123',
      FromUserName: 'oAbc123',
      MsgType: 'text',
      Content: '无关问题',
    };

    const Module = require('module');
    const originalLoad = Module._load;
    Module._load = function (request: string) {
      if (request.endsWith('llm-service')) {
        return { detectIntent: async () => ({ shouldTransfer: false }) };
      }
      if (request.endsWith('rag-service')) {
        return {
          retrieve: async () => ({ docs: [], isRelevant: false, usedFallback: false }),
          generateAnswer: async () => 'unused',
        };
      }
      return originalLoad.apply(this, arguments);
    };

    try {
      const result = await handleIncomingMessage(mockStrapi, msg);
      expect(result.passiveReply).toContain('转给人工');
      expect(result.asyncFollowUp).toBe(false);
    } finally {
      Module._load = originalLoad;
    }
  });
});

describe('getJssdkConfig', () => {
  it('返回 appId + timestamp + nonceStr + signature', async () => {
    process.env.WECHAT_APP_ID = 'wx_test';
    const config = await getJssdkConfig('https://example.com/page');
    expect(config.appId).toBe('wx_test');
    expect(config.timestamp).toBeDefined();
    expect(config.nonceStr).toBeDefined();
    expect(config.signature).toBeDefined();
  });
});
