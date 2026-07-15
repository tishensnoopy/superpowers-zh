# 微信集成（5C）实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 实现微信公众号客服消息接入（复用现有 AI 客服）+ JSSDK 分享签名后端 + 前端分享 hook

**架构：** 新建 `backend/src/api/wechat` API（webhook + JSSDK 端点），`backend/src/services/wechat-token-service.ts` 和 `wechat-message-service.ts` 处理微信 API 调用与 token 缓存。WeChat service 复用现有 chat controller 的 RAG 逻辑模式（session 用 `wechat:${openid}` 作为 sessionId）。前端 `frontend-next/hooks/use-wechat-share.ts` 加载 JSSDK 并设置分享卡片。

**技术栈：** TypeScript, Vitest, Strapi v5, Node.js crypto（SHA1）, 微信公众平台 API

---

## 文件结构

| 文件 | 职责 |
|------|------|
| 创建 `backend/src/api/wechat/routes/wechat.ts` | 路由定义（3 个 public 端点） |
| 创建 `backend/src/api/wechat/controllers/wechat.ts` | 控制器：verify + handleMessage + getJssdkConfig |
| 创建 `backend/src/api/wechat/services/wechat.ts` | WeChat service：签名验证 + XML 解析/构造 + 消息处理 + JSSDK 签名 |
| 创建 `backend/src/services/wechat-token-service.ts` | access_token + jsapi_ticket 缓存与刷新 |
| 创建 `backend/src/services/wechat-message-service.ts` | 客服消息发送 + token 失效重试 |
| 创建 `frontend-next/lib/wechat.ts` | JSSDK 加载器 + 签名配置获取 |
| 创建 `frontend-next/hooks/use-wechat-share.ts` | React hook：初始化 wx.config + 设置分享数据 |

测试文件一一对应 `__tests__/` 目录。

---

## 任务 1：WeChat Service 核心工具函数（签名验证 + XML 解析/构造）

**文件：**
- 创建：`backend/src/api/wechat/services/wechat.ts`
- 测试：`backend/src/api/wechat/services/__tests__/wechat.test.ts`

**背景：** 微信 webhook 用 SHA1 签名校验，消息体是 XML。这些是纯函数，不依赖网络/数据库，最适合先 TDD。

- [ ] **步骤 1：编写失败的测试**

创建文件 `backend/src/api/wechat/services/__tests__/wechat.test.ts`：

```typescript
import { describe, it, expect } from 'vitest';
import { verifySignature, parseXml, buildTextXml } from '../wechat';

describe('verifySignature', () => {
  it('正确签名返回 true', () => {
    const token = 'mytesttoken';
    const timestamp = '1609459200';
    const nonce = 'abc123';
    // SHA1(sort([token, timestamp, nonce]))
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
```

- [ ] **步骤 2：运行测试验证失败**

运行：`cd backend && npx vitest run src/api/wechat/services/__tests__/wechat.test.ts`
预期：FAIL，报错 `Cannot find module '../wechat'`

- [ ] **步骤 3：编写最少实现代码**

创建文件 `backend/src/api/wechat/services/wechat.ts`：

```typescript
/**
 * WeChat service: signature verification, XML parsing/building, message
 * handling, and JSSDK signature generation.
 *
 * XML parsing uses Node's built-in string operations (regex-based CDATA
 * extraction) to avoid adding an XML parser dependency. The WeChat message
 * XML format is simple and well-documented, making regex reliable here.
 */
import * as crypto from 'crypto';

export interface WechatMessage {
  ToUserName: string;
  FromUserName: string; // openid of the sender
  CreateTime?: string;
  MsgType: string;
  Content?: string;
  MsgId?: string;
  PicUrl?: string;
  [key: string]: string | undefined;
}

/**
 * Verify WeChat webhook signature.
 * Algorithm: SHA1(sort([token, timestamp, nonce]).join(''))
 */
export function verifySignature(
  signature: string,
  timestamp: string,
  nonce: string,
  token: string
): boolean {
  if (!signature) return false;
  const sorted = [token, timestamp, nonce].sort().join('');
  const expected = crypto.createHash('sha1').update(sorted).digest('hex');
  return signature === expected;
}

/**
 * Parse WeChat XML message body.
 * Extracts CDATA-wrapped values from <xml>...</xml> structure.
 */
export async function parseXml(xmlString: string): Promise<WechatMessage> {
  const result: WechatMessage = {} as WechatMessage;
  // Match <TagName><![CDATA[value]]></TagName> or <TagName>value</TagName>
  const regex = /<(\w+)>(?:<!\[CDATA\[([\s\S]*?)\]\]>|([^<]*))<\/\1>/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(xmlString)) !== null) {
    const key = match[1];
    const value = match[2] !== undefined ? match[2] : match[3];
    result[key] = value;
  }
  return result;
}

/**
 * Build a text-type passive reply XML.
 * @param toUser - openid of the recipient (the user who sent the message)
 * @param fromUser - the official account username
 * @param content - reply text content
 */
export function buildTextXml(toUser: string, fromUser: string, content: string): string {
  const escapeXml = (s: string) =>
    s.replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  const timestamp = Math.floor(Date.now() / 1000);
  return `<xml>
  <ToUserName><![CDATA[${toUser}]]></ToUserName>
  <FromUserName><![CDATA[${fromUser}]]></FromUserName>
  <CreateTime>${timestamp}</CreateTime>
  <MsgType><![CDATA[text]]></MsgType>
  <Content><![CDATA[${escapeXml(content)}]]></Content>
</xml>`;
}
```

- [ ] **步骤 4：运行测试验证通过**

运行：`cd backend && npx vitest run src/api/wechat/services/__tests__/wechat.test.ts`
预期：PASS（8 tests）

- [ ] **步骤 5：Commit**

```bash
cd backend && git add src/api/wechat/services/wechat.ts src/api/wechat/services/__tests__/wechat.test.ts
git commit -m "feat(wechat): add signature verification + XML parse/build utilities

- verifySignature: SHA1(sort([token,timestamp,nonce]))
- parseXml: CDATA-aware regex extraction of WeChat message fields
- buildTextXml: construct passive reply XML with XSS escaping"
```

---

## 任务 2：Token 服务（access_token + jsapi_ticket 缓存）

**文件：**
- 创建：`backend/src/services/wechat-token-service.ts`
- 测试：`backend/src/services/__tests__/wechat-token-service.test.ts`

**背景：** 微信 access_token 有效期 2 小时，jsapi_ticket 同样 2 小时。需内存缓存 + 过期自动刷新。无凭证时通过环境变量读取配置，调用微信 API 用 fetch（Node 18+ 内置）。

- [ ] **步骤 1：编写失败的测试**

创建文件 `backend/src/services/__tests__/wechat-token-service.test.ts`：

```typescript
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
      expect.stringContaining('https://api.weixin.qq.com/cgi-bin/token'),
      expect.any(Object)
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
```

- [ ] **步骤 2：运行测试验证失败**

运行：`cd backend && npx vitest run src/services/__tests__/wechat-token-service.test.ts`
预期：FAIL，报错 `Cannot find module '../wechat-token-service'`

- [ ] **步骤 3：编写最少实现代码**

创建文件 `backend/src/services/wechat-token-service.ts`：

```typescript
/**
 * WeChat access_token and jsapi_ticket cache service.
 *
 * Both tokens are valid for 2 hours (7200s). We cache them in memory with a
 * 5-minute safety buffer (refresh when < 5 min remaining). No Redis — the
 * single-server Docker Compose deployment means in-memory cache is sufficient.
 */
import * as crypto from 'crypto';

interface TokenCache {
  value: string;
  expiresAt: number; // Unix timestamp in ms
}

let accessTokenCache: TokenCache | null = null;
let jsapiTicketCache: TokenCache | null = null;

const SAFETY_BUFFER_MS = 5 * 60 * 1000; // 5 minutes

function getConfig(): { appId: string; appSecret: string } {
  const appId = process.env.WECHAT_APP_ID;
  const appSecret = process.env.WECHAT_APP_SECRET;
  if (!appId) {
    throw new Error('WECHAT_APP_ID is not configured');
  }
  if (!appSecret) {
    throw new Error('WECHAT_APP_SECRET is not configured');
  }
  return { appId, appSecret };
}

export function resetTokenCache(): void {
  accessTokenCache = null;
  jsapiTicketCache = null;
}

export async function getAccessToken(): Promise<string> {
  const now = Date.now();
  if (accessTokenCache && accessTokenCache.expiresAt > now + SAFETY_BUFFER_MS) {
    return accessTokenCache.value;
  }

  const { appId, appSecret } = getConfig();
  const url = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${appId}&secret=${appSecret}`;
  const res = await fetch(url);
  const data = await res.json() as any;

  if (data.errcode) {
    throw new Error(`WeChat token error: ${data.errmsg} (code ${data.errcode})`);
  }

  accessTokenCache = {
    value: data.access_token,
    expiresAt: now + (data.expires_in || 7200) * 1000,
  };
  return accessTokenCache.value;
}

export async function getJsapiTicket(): Promise<string> {
  const now = Date.now();
  if (jsapiTicketCache && jsapiTicketCache.expiresAt > now + SAFETY_BUFFER_MS) {
    return jsapiTicketCache.value;
  }

  const token = await getAccessToken();
  const url = `https://api.weixin.qq.com/cgi-bin/ticket/getticket?type=jsapi&access_token=${token}`;
  const res = await fetch(url);
  const data = await res.json() as any;

  if (data.errcode) {
    throw new Error(`WeChat ticket error: ${data.errmsg} (code ${data.errcode})`);
  }

  jsapiTicketCache = {
    value: data.ticket,
    expiresAt: now + (data.expires_in || 7200) * 1000,
  };
  return jsapiTicketCache.value;
}

/**
 * Generate JSSDK signature for wx.config.
 * Algorithm: SHA1(jsapi_ticket=xxx&noncestr=xxx&timestamp=xxx&url=xxx)
 */
export function generateJssdkSignature(
  jsapiTicket: string,
  nonceStr: string,
  timestamp: number,
  url: string
): string {
  const str = `jsapi_ticket=${jsapiTicket}&noncestr=${nonceStr}&timestamp=${timestamp}&url=${url}`;
  return crypto.createHash('sha1').update(str).digest('hex');
}
```

- [ ] **步骤 4：运行测试验证通过**

运行：`cd backend && npx vitest run src/services/__tests__/wechat-token-service.test.ts`
预期：PASS（7 tests）

- [ ] **步骤 5：Commit**

```bash
cd backend && git add src/services/wechat-token-service.ts src/services/__tests__/wechat-token-service.test.ts
git commit -m "feat(wechat): add token service with access_token + jsapi_ticket caching

- In-memory cache with 5-min safety buffer (refresh before expiry)
- getAccessToken: fetches from WeChat API, caches 2h
- getJsapiTicket: depends on access_token, caches separately
- generateJssdkSignature: SHA1(ticket+nonce+timestamp+url)
- resetTokenCache for testing
- Throws on missing WECHAT_APP_ID/APP_SECRET"
```

---

## 任务 3：消息发送服务（客服消息 + token 失效重试）

**文件：**
- 创建：`backend/src/services/wechat-message-service.ts`
- 测试：`backend/src/services/__tests__/wechat-message-service.test.ts`

- [ ] **步骤 1：编写失败的测试**

创建文件 `backend/src/services/__tests__/wechat-message-service.test.ts`：

```typescript
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
```

- [ ] **步骤 2：运行测试验证失败**

运行：`cd backend && npx vitest run src/services/__tests__/wechat-message-service.test.ts`
预期：FAIL，报错 `Cannot find module '../wechat-message-service'`

- [ ] **步骤 3：编写最少实现代码**

创建文件 `backend/src/services/wechat-message-service.ts`：

```typescript
/**
 * WeChat customer service message sender.
 *
 * Sends messages via the WeChat客服消息 API within the 48h interaction window.
 * Automatically retries once on token expiry (errcode 40001/42001).
 */
import { getAccessToken, resetTokenCache } from './wechat-token-service';

const WECHAT_API_BASE = 'https://api.weixin.qq.com/cgi-bin';
const MAX_CONTENT_LENGTH = 2048;

/**
 * Truncate content to WeChat's 2048-char limit with ellipsis.
 */
export function truncateContent(content: string): string {
  if (content.length <= MAX_CONTENT_LENGTH) {
    return content;
  }
  return content.slice(0, MAX_CONTENT_LENGTH - 1) + '…';
}

/**
 * Send a text customer service message to a WeChat user.
 * @param openid - recipient's openid
 * @param content - message text (truncated to 2048 chars)
 * @throws on non-zero errcode after retry
 */
export async function sendCustomMessage(openid: string, content: string): Promise<void> {
  const truncated = truncateContent(content);
  const body = JSON.stringify({
    touser: openid,
    msgtype: 'text',
    text: { content: truncated },
  });

  const result = await doSend(body);

  // Token expired — refresh and retry once
  if (result.errcode === 40001 || result.errcode === 42001) {
    resetTokenCache();
    const retryResult = await doSend(body);
    if (retryResult.errcode && retryResult.errcode !== 0) {
      throw new Error(`WeChat send failed: ${retryResult.errmsg} (code ${retryResult.errcode})`);
    }
    return;
  }

  if (result.errcode && result.errcode !== 0) {
    throw new Error(`WeChat send failed: ${result.errmsg} (code ${result.errcode})`);
  }
}

async function doSend(body: string): Promise<{ errcode: number; errmsg: string }> {
  const token = await getAccessToken();
  const url = `${WECHAT_API_BASE}/message/custom/send?access_token=${token}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });
  return res.json() as Promise<{ errcode: number; errmsg: string }>;
}
```

- [ ] **步骤 4：运行测试验证通过**

运行：`cd backend && npx vitest run src/services/__tests__/wechat-message-service.test.ts`
预期：PASS（6 tests）

- [ ] **步骤 5：Commit**

```bash
cd backend && git add src/services/wechat-message-service.ts src/services/__tests__/wechat-message-service.test.ts
git commit -m "feat(wechat): add customer service message sender with retry

- sendCustomMessage: POST to WeChat客服消息 API
- truncateContent: enforce 2048-char limit with ellipsis
- Auto-retry once on 40001/42001 (token expired) after cache reset
- Throws on non-zero errcode after retry"
```

---

## 任务 4：WeChat Service 消息处理逻辑 + JSSDK 签名

**文件：**
- 修改：`backend/src/api/wechat/services/wechat.ts`（追加 handleIncomingMessage + getJssdkConfig）
- 修改：`backend/src/api/wechat/services/__tests__/wechat.test.ts`（追加测试）

**背景：** handleIncomingMessage 是核心逻辑——接收 WechatMessage，映射到 sessionId，复用 chat controller 的 RAG 逻辑模式（startSession + sendMessage），4 秒超时 race。getJssdkConfig 调用 token service 生成签名。

- [ ] **步骤 1：编写失败的测试**

在 `backend/src/api/wechat/services/__tests__/wechat.test.ts` 末尾追加（import 块也需要更新）：

更新 import 行为：
```typescript
import { verifySignature, parseXml, buildTextXml, handleIncomingMessage, getJssdkConfig } from '../wechat';
```

追加测试：
```typescript
import { vi } from 'vitest';

// Mock token service
vi.mock('../../../services/wechat-token-service', () => ({
  getAccessToken: vi.fn().mockResolvedValue('token_abc'),
  getJsapiTicket: vi.fn().mockResolvedValue('ticket_xyz'),
  generateJssdkSignature: vi.fn().mockReturnValue('mock_signature'),
  resetTokenCache: vi.fn(),
}));

// Mock message service
vi.mock('../../../services/wechat-message-service', () => ({
  sendCustomMessage: vi.fn().mockResolvedValue(undefined),
}));

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

  // Intercept require() for llm-service + rag-service (same pattern as chat.test.ts)
  let originalRequire: any;
  beforeEach(() => {
    originalRequire = (require as any);
  });

  it('文本消息返回 AI 回复（快响应 < 4s）', async () => {
    const mockStrapi = buildMockStrapi({ sessionExists: false, aiResponse: '你好，欢迎咨询', aiDelay: 10 });
    const msg: any = {
      ToUserName: 'gh_123',
      FromUserName: 'oAbc123',
      MsgType: 'text',
      Content: '你好',
    };

    // Mock require for llm-service + rag-service
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

  it('AI 响应 ≥ 4s 时返回"正在查询"并标记异步跟进', async () => {
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
      expect(result.followUpContent).toBe('慢回复');
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
```

- [ ] **步骤 2：运行测试验证失败**

运行：`cd backend && npx vitest run src/api/wechat/services/__tests__/wechat.test.ts`
预期：FAIL，报错 `handleIncomingMessage is not a function` 或 `getJssdkConfig is not a function`

- [ ] **步骤 3：编写最少实现代码**

在 `backend/src/api/wechat/services/wechat.ts` 末尾追加：

```typescript
import { getJsapiTicket, generateJssdkSignature } from '../../../services/wechat-token-service';
import { sendCustomMessage } from '../../../services/wechat-message-service';

const PASSIVE_TIMEOUT_MS = 4000;
const QUERYING_REPLY = '正在为您查询，请稍候…';
const UNSUPPORTED_REPLY = '暂不支持此消息类型，请发送文字消息。';
const TRANSFER_REPLY = '好的，正在为您转接人工客服，请稍候…';
const GUIDANCE_REPLY = '这个问题我需要转给人工客服为您解答。您也可以先留下联系方式，我们的顾问会尽快联系您。';

export interface HandleResult {
  passiveReply: string;
  asyncFollowUp: boolean;
  followUpContent?: string;
  openid?: string;
}

/**
 * Handle an incoming WeChat message.
 *
 * Reuses the existing chat controller's RAG logic pattern:
 * 1. Map openid → sessionId (`wechat:${openid}`)
 * 2. If no session exists, create one (like startSession)
 * 3. Run detectIntent + retrieve + generateAnswer (like sendMessage)
 * 4. 4-second timeout race: if AI is slow, return "querying" passive reply
 *    and mark for async customer service message follow-up
 */
export async function handleIncomingMessage(
  strapi: any,
  message: WechatMessage
): Promise<HandleResult> {
  const openid = message.FromUserName;
  const userContent = message.Content || '';

  // Only handle text messages
  if (message.MsgType !== 'text') {
    return { passiveReply: UNSUPPORTED_REPLY, asyncFollowUp: false };
  }

  const sessionId = `wechat:${openid}`;

  // Find or create session
  let sessions = await strapi.documents('api::chat-session.chat-session').findMany({
    filters: { sessionId },
    limit: 1,
  });
  let session = sessions && sessions.length > 0 ? sessions[0] : null;

  if (!session) {
    await strapi.documents('api::chat-session.chat-session').create({
      data: {
        sessionId,
        visitorId: `wx_${openid}`,
        visitorName: null,
        visitorPhone: null,
        sourcePage: 'wechat',
        status: 'active',
        locale: 'zh-CN',
      },
    });
    sessions = await strapi.documents('api::chat-session.chat-session').findMany({
      filters: { sessionId },
      limit: 1,
    });
    session = sessions && sessions.length > 0 ? sessions[0] : null;
  }

  if (!session) {
    return { passiveReply: '系统繁忙，请稍后再试。', asyncFollowUp: false };
  }

  // Already transferred
  if (session.status === 'transferred') {
    return { passiveReply: TRANSFER_REPLY, asyncFollowUp: false };
  }

  // 10-round threshold
  if ((session.messageCount ?? 0) >= 10) {
    return {
      passiveReply: '您今天已经咨询了很多问题，建议您预约一次免费试听课，我们的顾问会为您详细解答。',
      asyncFollowUp: false,
    };
  }

  // Persist user message
  await strapi.documents('api::chat-message.chat-message').create({
    data: { session: session.documentId, role: 'user', content: userContent },
  });

  // Intent detection
  const { detectIntent } = require('../../../services/llm-service') as {
    detectIntent: (message: string) => Promise<{ shouldTransfer: boolean }>;
  };
  const intent = await detectIntent(userContent);
  if (intent?.shouldTransfer) {
    await strapi.db.query('api::chat-session.chat-session').update({
      where: { id: session.id },
      data: { status: 'transferred', transferredAt: new Date().toISOString() },
    });
    return { passiveReply: TRANSFER_REPLY, asyncFollowUp: false };
  }

  // Gather history
  const history = await strapi.db.query('api::chat-message.chat-message').findMany({
    where: { session: session.id },
    orderBy: { createdAt: 'asc' },
    limit: 10,
  });

  // RAG retrieve
  const { retrieve, generateAnswer } = require('../../../services/rag-service') as {
    retrieve: (query: string, topK: number, locale?: 'zh-CN' | 'en-US') => Promise<{ docs: any[]; isRelevant: boolean; usedFallback: boolean }>;
    generateAnswer: (query: string, docs: any[], history: any[], locale?: 'zh-CN' | 'en-US', usedFallback?: boolean) => Promise<string>;
  };

  const { docs, isRelevant, usedFallback } = await retrieve(userContent, 5, 'zh-CN');

  // Guidance mode: no relevant content
  if (!isRelevant) {
    await strapi.db.query('api::chat-session.chat-session').update({
      where: { id: session.id },
      data: { status: 'transferred' },
    });
    return { passiveReply: GUIDANCE_REPLY, asyncFollowUp: false };
  }

  // 4-second timeout race
  const aiPromise = generateAnswer(
    userContent,
    docs,
    (history || []).map((h: any) => ({ role: h.role, content: h.content })),
    'zh-CN',
    usedFallback
  );

  const timeoutPromise = new Promise<'__TIMEOUT__'>((resolve) =>
    setTimeout(() => resolve('__TIMEOUT__'), PASSIVE_TIMEOUT_MS)
  );

  const raceResult = await Promise.race([aiPromise, timeoutPromise]);

  if (raceResult === '__TIMEOUT__') {
    // AI is slow — return "querying" passive reply, mark for async follow-up
    // Continue waiting for the actual answer in the background
    aiPromise
      .then(async (answer) => {
        // Persist assistant message
        await strapi.documents('api::chat-message.chat-message').create({
          data: {
            session: session.documentId,
            role: 'assistant',
            content: answer,
            retrievedDocs: docs && docs.length > 0
              ? docs.map((d: any) => ({ id: d.id, text: d.chunk_text ? d.chunk_text.slice(0, 200) : '' }))
              : null,
          },
        });
        await strapi.db.query('api::chat-session.chat-session').update({
          where: { id: session.id },
          data: { messageCount: (session.messageCount ?? 0) + 1 },
        });
        // Send via customer service message
        await sendCustomMessage(openid, answer);
      })
      .catch((err) => {
        console.error(`[wechat] Async follow-up failed for ${openid}:`, err instanceof Error ? err.message : err);
      });

    return {
      passiveReply: QUERYING_REPLY,
      asyncFollowUp: true,
      followUpContent: undefined, // will be sent async
      openid,
    };
  }

  // Fast response — persist + return as passive reply
  const answer = raceResult;
  await strapi.documents('api::chat-message.chat-message').create({
    data: {
      session: session.documentId,
      role: 'assistant',
      content: answer,
      retrievedDocs: docs && docs.length > 0
        ? docs.map((d: any) => ({ id: d.id, text: d.chunk_text ? d.chunk_text.slice(0, 200) : '' }))
        : null,
    },
  });
  await strapi.db.query('api::chat-session.chat-session').update({
    where: { id: session.id },
    data: { messageCount: (session.messageCount ?? 0) + 1 },
  });

  return { passiveReply: answer, asyncFollowUp: false, openid };
}

/**
 * Generate JSSDK config for wx.config.
 */
export async function getJssdkConfig(url: string): Promise<{
  appId: string;
  timestamp: number;
  nonceStr: string;
  signature: string;
}> {
  const ticket = await getJsapiTicket();
  const nonceStr = Math.random().toString(36).slice(2, 18);
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = generateJssdkSignature(ticket, nonceStr, timestamp, url);
  return {
    appId: process.env.WECHAT_APP_ID || '',
    timestamp,
    nonceStr,
    signature,
  };
}
```

- [ ] **步骤 4：运行测试验证通过**

运行：`cd backend && npx vitest run src/api/wechat/services/__tests__/wechat.test.ts`
预期：PASS（全部 tests）

- [ ] **步骤 5：Commit**

```bash
cd backend && git add src/api/wechat/services/wechat.ts src/api/wechat/services/__tests__/wechat.test.ts
git commit -m "feat(wechat): add message handler with 4s timeout + JSSDK config

- handleIncomingMessage: openid -> wechat:openid session mapping
  - Reuses chat controller RAG pattern (detectIntent + retrieve + generateAnswer)
  - 4s timeout race: slow AI -> passive 'querying' + async customer service msg
  - Non-text -> unsupported reply
  - Transfer signal -> human handoff reply
  - isRelevant=false -> guidance reply
  - 10-round threshold -> trial class guidance
- getJssdkConfig: returns appId + timestamp + nonceStr + signature"
```

---

## 任务 5：路由 + 控制器

**文件：**
- 创建：`backend/src/api/wechat/routes/wechat.ts`
- 创建：`backend/src/api/wechat/controllers/wechat.ts`
- 测试：`backend/src/api/wechat/controllers/__tests__/wechat.test.ts`

- [ ] **步骤 1：编写失败的测试**

创建文件 `backend/src/api/wechat/controllers/__tests__/wechat.test.ts`：

```typescript
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
```

- [ ] **步骤 2：运行测试验证失败**

运行：`cd backend && npx vitest run src/api/wechat/controllers/__tests__/wechat.test.ts`
预期：FAIL，报错 `Cannot find module '../wechat'`

- [ ] **步骤 3：编写最少实现代码**

创建文件 `backend/src/api/wechat/routes/wechat.ts`：

```typescript
/**
 * WeChat public routes — all auth: false because:
 * - /webhook is called by WeChat servers (validated via signature, not Strapi auth)
 * - /jssdk is called by the browser to get share signature config
 */
export default {
  routes: [
    {
      method: 'GET',
      path: '/wechat/webhook',
      handler: 'wechat.verify',
      config: { auth: false },
    },
    {
      method: 'POST',
      path: '/wechat/webhook',
      handler: 'wechat.handleMessage',
      config: { auth: false },
    },
    {
      method: 'GET',
      path: '/wechat/jssdk',
      handler: 'wechat.getJssdkConfig',
      config: { auth: false },
    },
  ],
};
```

创建文件 `backend/src/api/wechat/controllers/wechat.ts`：

```typescript
/**
 * WeChat webhook + JSSDK controller.
 *
 * Endpoints (see routes/wechat.ts):
 *   GET  /wechat/webhook  - verify (signature check, return echostr)
 *   POST /wechat/webhook  - handleMessage (parse XML, process, return passive reply)
 *   GET  /wechat/jssdk    - getJssdkConfig (return signature for wx.config)
 */
import {
  verifySignature,
  parseXml,
  buildTextXml,
  handleIncomingMessage,
  getJssdkConfig as fetchJssdkConfig,
} from '../services/wechat';

export default {
  /**
   * GET /wechat/webhook — WeChat server verification.
   * WeChat sends signature, timestamp, nonce, echostr.
   * If signature matches SHA1(sort([token, timestamp, nonce])), return echostr.
   */
  async verify(ctx: any) {
    const { signature, timestamp, nonce, echostr } = ctx.query || {};
    if (!echostr) {
      ctx.throw(400, 'echostr is required');
    }
    const token = process.env.WECHAT_TOKEN || '';
    if (!verifySignature(signature, timestamp, nonce, token)) {
      ctx.throw(401, 'Invalid signature');
    }
    ctx.body = echostr;
  },

  /**
   * POST /wechat/webhook — Receive WeChat message (XML body).
   * Parse XML, process message, return passive reply XML.
   */
  async handleMessage(ctx: any) {
    const rawBody = ctx.request.body;
    if (!rawBody) {
      ctx.body = '';
      return;
    }

    try {
      const message = await parseXml(typeof rawBody === 'string' ? rawBody : rawBody.toString());
      const result = await handleIncomingMessage(ctx.strapi || strapi, message);

      // Build passive reply XML (ToUserName = user openid, FromUserName = official account)
      ctx.type = 'application/xml';
      ctx.body = buildTextXml(message.FromUserName, message.ToUserName, result.passiveReply);
    } catch (err) {
      console.error('[wechat] handleMessage error:', err instanceof Error ? err.message : err);
      // Return empty 200 to prevent WeChat from retrying
      ctx.body = '';
    }
  },

  /**
   * GET /wechat/jssdk?url=xxx — Return JSSDK signature config for wx.config.
   */
  async getJssdkConfig(ctx: any) {
    const { url } = ctx.query || {};
    if (!url) {
      ctx.throw(400, 'url parameter is required');
    }
    const config = await fetchJssdkConfig(url);
    ctx.body = config;
  },
};
```

- [ ] **步骤 4：运行测试验证通过**

运行：`cd backend && npx vitest run src/api/wechat/controllers/__tests__/wechat.test.ts`
预期：PASS（全部 tests）

- [ ] **步骤 5：Commit**

```bash
cd backend && git add src/api/wechat/routes/wechat.ts src/api/wechat/controllers/wechat.ts src/api/wechat/controllers/__tests__/wechat.test.ts
git commit -m "feat(wechat): add webhook + JSSDK controller and routes

- GET /wechat/webhook: signature verification, return echostr
- POST /wechat/webhook: parse XML, handleIncomingMessage, return passive reply XML
- GET /wechat/jssdk?url=xxx: return JSSDK signature config
- All routes auth: false (webhook verified by signature, jssdk public)
- Error handling: empty 200 on parse failure to prevent WeChat retries"
```

---

## 任务 6：前端 JSSDK 分享 Hook

**文件：**
- 创建：`frontend-next/lib/wechat.ts`
- 创建：`frontend-next/hooks/use-wechat-share.ts`
- 测试：`frontend-next/hooks/__tests__/use-wechat-share.test.ts`

- [ ] **步骤 1：编写失败的测试**

创建文件 `frontend-next/hooks/__tests__/use-wechat-share.test.ts`：

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useWechatShare } from '../use-wechat-share';

// Mock fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Mock navigator.userAgent
const mockUserAgent = vi.fn();
Object.defineProperty(navigator, 'userAgent', {
  get: () => mockUserAgent(),
  configurable: true,
});

describe('useWechatShare', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUserAgent.mockReturnValue('Mozilla/5.0 (Windows NT 10.0)');
  });

  it('非微信环境不加载 JSSDK', () => {
    mockUserAgent.mockReturnValue('Mozilla/5.0 (Windows NT 10.0)');
    const { result } = renderHook(() =>
      useWechatShare({ title: 'T', desc: 'D', link: 'https://example.com', imgUrl: 'https://example.com/img.jpg' })
    );
    expect(result.current.ready).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('微信环境调用后端获取签名配置', async () => {
    mockUserAgent.mockReturnValue('Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 MicroMessenger/8.0');
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ appId: 'wx_test', timestamp: 123, nonceStr: 'abc', signature: 'sig' }),
    });

    const { result, waitForNextUpdate } = renderHook(() =>
      useWechatShare({ title: 'T', desc: 'D', link: 'https://example.com', imgUrl: 'https://example.com/img.jpg' })
    );

    await waitForNextUpdate();
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/wechat/jssdk?url=')
    );
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

    const { result, waitForNextUpdate } = renderHook(() =>
      useWechatShare({ title: 'T', desc: 'D', link: 'https://example.com', imgUrl: '' })
    );

    try {
      await waitForNextUpdate();
    } catch {
      // hook should not throw
    }
    expect(result.current.ready).toBe(false);
  });
});
```

- [ ] **步骤 2：运行测试验证失败**

运行：`cd frontend-next && npx vitest run hooks/__tests__/use-wechat-share.test.ts`
预期：FAIL，报错 `Cannot find module '../use-wechat-share'`

- [ ] **步骤 3：编写最少实现代码**

创建文件 `frontend-next/lib/wechat.ts`：

```typescript
/**
 * WeChat JSSDK loader and config helper.
 *
 * Dynamically loads the WeChat JSSDK script only when needed (inside WeChat
 * browser). The script URL is the official WeChat JSSDK 1.6.0.
 */

const JSSDK_URL = 'https://res.wx.qq.com/open/js/jweixin-1.6.0.js';
let scriptLoaded: Promise<void> | null = null;

/**
 * Load WeChat JSSDK script. Idempotent — only loads once.
 */
export function loadWechatJssdk(): Promise<void> {
  if (scriptLoaded) return scriptLoaded;
  scriptLoaded = new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('SSR environment'));
      return;
    }
    const script = document.createElement('script');
    script.src = JSSDK_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load WeChat JSSDK'));
    document.head.appendChild(script);
  });
  return scriptLoaded;
}

/**
 * Check if the current browser is WeChat.
 */
export function isWechatBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /MicroMessenger/i.test(navigator.userAgent);
}

interface JssdkConfig {
  appId: string;
  timestamp: number;
  nonceStr: string;
  signature: string;
}

/**
 * Fetch JSSDK signature config from backend.
 */
export async function getJssdkConfig(url: string): Promise<JssdkConfig> {
  const apiUrl = process.env.NEXT_PUBLIC_STRAPI_API_URL || 'http://localhost:1337';
  const res = await fetch(`${apiUrl}/api/wechat/jssdk?url=${encodeURIComponent(url)}`);
  if (!res.ok) {
    throw new Error(`JSSDK config fetch failed: ${res.status}`);
  }
  return res.json();
}
```

创建文件 `frontend-next/hooks/use-wechat-share.ts`：

```typescript
'use client';

import { useState, useEffect } from 'react';
import { loadWechatJssdk, isWechatBrowser, getJssdkConfig } from '../lib/wechat';

export interface ShareData {
  title: string;
  desc: string;
  link: string;
  imgUrl: string;
}

/**
 * Initialize WeChat JSSDK sharing for the current page.
 *
 * Behavior:
 * - Non-WeChat browser: no-op (ready=false)
 * - WeChat browser: loads JSSDK, fetches signature, calls wx.config + wx.ready
 * - Errors are silently swallowed (share just won't work, page still functions)
 */
export function useWechatShare(shareData: ShareData | null): { ready: boolean } {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!shareData) return;
    if (!isWechatBrowser()) return;

    let cancelled = false;

    async function init() {
      try {
        await loadWechatJssdk();
        const url = window.location.href.split('#')[0];
        const config = await getJssdkConfig(url);
        if (cancelled) return;

        const wx = (window as any).wx;
        if (!wx) return;

        wx.config({
          debug: false,
          appId: config.appId,
          timestamp: config.timestamp,
          nonceStr: config.nonceStr,
          signature: config.signature,
          jsApiList: ['updateAppMessageShareData', 'updateTimelineShareData'],
        });

        wx.ready(() => {
          if (cancelled) return;
          wx.updateAppMessageShareData({
            title: shareData.title,
            desc: shareData.desc,
            link: shareData.link,
            imgUrl: shareData.imgUrl,
          });
          wx.updateTimelineShareData({
            title: shareData.title,
            link: shareData.link,
            imgUrl: shareData.imgUrl,
          });
          setReady(true);
        });

        wx.error((err: any) => {
          console.warn('[wechat-share] wx.config error:', err?.errMsg);
        });
      } catch (err) {
        // Silently fail — sharing won't work but page is still functional
        console.warn('[wechat-share] init failed:', err instanceof Error ? err.message : err);
      }
    }

    init();
    return () => { cancelled = true; };
  }, [shareData?.title, shareData?.desc, shareData?.link, shareData?.imgUrl]);

  return { ready };
}
```

- [ ] **步骤 4：运行测试验证通过**

运行：`cd frontend-next && npx vitest run hooks/__tests__/use-wechat-share.test.ts`
预期：PASS（4 tests）

- [ ] **步骤 5：Commit**

```bash
cd /home/tishensnoopy/project/superpowers-zh && git add frontend-next/lib/wechat.ts frontend-next/hooks/use-wechat-share.ts frontend-next/hooks/__tests__/use-wechat-share.test.ts
git commit -m "feat(wechat): add frontend JSSDK share hook

- lib/wechat.ts: JSSDK script loader + isWechatBrowser + getJssdkConfig
- hooks/use-wechat-share.ts: React hook for wx.config + share data
  - Non-WeChat browser: no-op (ready=false)
  - WeChat browser: load JSSDK, fetch signature, set share cards
  - Silent failure on errors (page still functional)
  - 'use client' directive for Next.js App Router"
```

---

## 任务 7：.env.example 更新 + 全量测试验证

**文件：**
- 修改：`backend/.env.example`（或创建）

- [ ] **步骤 1：检查并更新 .env.example**

在 `backend/.env.example` 末尾追加（如果文件不存在则创建）：

```bash
# WeChat Official Account (公众号)
# Leave placeholder values until real credentials are obtained
WECHAT_APP_ID=your_app_id
WECHAT_APP_SECRET=your_app_secret
WECHAT_TOKEN=your_webhook_verification_token
```

- [ ] **步骤 2：运行后端全量测试**

运行：`cd backend && npx vitest run`
预期：所有测试 PASS

- [ ] **步骤 3：运行前端全量测试**

运行：`cd frontend-next && npx vitest run`
预期：所有测试 PASS

- [ ] **步骤 4：Commit**

```bash
cd /home/tishensnoopy/project/superpowers-zh && git add backend/.env.example
git commit -m "chore(wechat): add WeChat env vars to .env.example

- WECHAT_APP_ID, WECHAT_APP_SECRET, WECHAT_TOKEN
- Placeholder values until real credentials are obtained"
```
