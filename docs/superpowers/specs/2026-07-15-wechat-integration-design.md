# 微信集成（5C）设计规格

> **日期：** 2026-07-15
> **状态：** 已确认（用户预授权自主执行）
> **范围：** 公众号客服消息 + JSSDK 分享

## 1. 背景与目标

### 1.1 业务背景

佑森小课堂是一家武汉的幼小衔接教育机构，拥有 6 个校区。网站已具备 AI 客服系统（RAG 架构 + pgvector + BullMQ），现需将 AI 客服能力延伸到微信公众号，并支持微信内分享自定义卡片。

### 1.2 目标

1. **公众号客服消息**：用户在微信公众号对话，由现有 AI 客服自动回复（复用 RAG + 知识库 + 转人工机制）
2. **JSSDK 分享**：课程/新闻/校区页面在微信内分享时显示自定义标题、描述和封面图

### 1.3 非目标（YAGNI）

- 微信登录（OAuth 网页授权）— 用户未选择
- 微信支付 — 用户未选择
- 小程序 — 用户未选择
- 微信开放平台（UnionID 跨应用）— 单一公众号场景不需要
- 加密模式消息（EncodingAESKey）— 初期使用明文模式，后续可加

### 1.4 约束

- **无微信开发者凭证**：AppID/AppSecret 暂无，代码+配置+测试先做好，凭证后续填入 `.env`
- **不引入第三方微信 SDK**：自行实现 XML 解析 + API 调用（符合项目零依赖原则，仅用已有 axios/node-fetch）
- **TDD 开发流程**：每个功能先写测试再实现
- **复用现有基础设施**：现有 chat 服务、RAG、session 管理直接复用，不重复造轮子

## 2. 架构

### 2.1 整体架构

```
微信用户 → 微信公众平台 → [POST /api/wechat/webhook] → WeChat Service
                                                              ↓
                                                    解析 XML，提取 openid + Content
                                                              ↓
                                                    sessionId = `wechat:${openid}`
                                                              ↓
                                          复用现有 chat service sendMessage 逻辑
                                                              ↓
                                                    RAG 生成回复
                                                              ↓
                                              [POST 微信客服消息 API] → 微信用户
```

```
浏览器 → [GET /api/wechat/jssdk?url=xxx] → WeChat Service
                                              ↓
                                    获取 jsapi_ticket（缓存）
                                              ↓
                                    生成签名（SHA1）
                                              ↓
                                    返回 { appId, timestamp, nonceStr, signature }
                                              ↓
浏览器 ← wx.config(...) → wx.ready → wx.updateAppMessageShareData(...)
```

### 2.2 方案选择

**方案 A（推荐，已选）：复用现有 chat 服务**
- openid 映射为 `wechat:${openid}` 作为 sessionId
- 直接调用现有 chat service 的内部逻辑（RAG + 防滥用 + 转人工）
- 优点：最大化复用，行为一致，无需改动现有 chat 服务
- 缺点：需暴露 chat service 的内部方法供 wechat service 调用

**方案 B：独立 WeChat handler 直接调 RAG** — 拒绝
- 重复 session 管理和防滥用逻辑，行为不一致

**方案 C：传输层适配器** — 过度设计
- 对当前规模不必要的抽象

### 2.3 消息回复策略

微信公众号消息有两条回复通道：

1. **被动回复（5 秒超时）**：直接在 webhook HTTP 响应中返回 XML
2. **客服消息（48 小时窗口）**：用户交互后 48 小时内可主动发送

**策略：混合模式**
- AI 响应 < 4 秒：直接被动回复
- AI 响应 ≥ 4 秒：先被动回复"正在为您查询…"，再通过客服消息 API 发送实际答案
- 转人工：被动回复"已为您转接人工客服，请稍候"，客服消息不触发

## 3. 组件设计

### 3.1 后端组件

#### 3.1.1 API 路由 (`backend/src/api/wechat/routes/wechat.ts`)

| 方法 | 路径 | 认证 | 用途 |
|------|------|------|------|
| GET | `/wechat/webhook` | false | 微信签名验证（公众号配置服务器时调用） |
| POST | `/wechat/webhook` | false | 接收微信消息推送（XML 格式） |
| GET | `/wechat/jssdk` | false | 获取 JSSDK 签名（query: `url`） |

#### 3.1.2 控制器 (`backend/src/api/wechat/controllers/wechat.ts`)

- `verify(ctx)`: GET 处理，验证 signature + 返回 echostr
- `handleMessage(ctx)`: POST 处理，解析 XML → 调用 service → 返回被动回复 XML
- `getJssdkConfig(ctx)`: GET 处理，返回 JSSDK 签名

#### 3.1.3 WeChat 服务 (`backend/src/api/wechat/services/wechat.ts`)

核心职责：
- `verifySignature(signature, timestamp, nonce, token)`: boolean — SHA1 签名校验
- `parseXml(xmlString)`: Promise<WechatMessage> — 解析微信 XML 消息
- `buildTextXml(toUser, fromUser, content)`: string — 构造被动回复 XML
- `handleIncomingMessage(strapi, message)`: Promise<string> — 处理消息，返回被动回复内容
- `getJssdkSignature(url)`: Promise<JssdkConfig> — 生成 JSSDK 签名

#### 3.1.4 Token 服务 (`backend/src/services/wechat-token-service.ts`)

- `getAccessToken()`: Promise<string> — 获取/缓存 access_token（2 小时有效期）
- `getJsapiTicket()`: Promise<string> — 获取/缓存 jsapi_ticket（2 小时有效期）
- 缓存策略：内存缓存 + 过期时间戳；token 失效时自动刷新
- 刷新逻辑：调用微信 API `https://api.weixin.qq.com/cgi-bin/token` 和 `https://api.weixin.qq.com/cgi-bin/ticket/getticket`

#### 3.1.5 消息发送服务 (`backend/src/services/wechat-message-service.ts`)

- `sendCustomMessage(openid, content)`: Promise<void> — 发送客服消息
- 调用微信 API `https://api.weixin.qq.com/cgi-bin/message/custom/send`
- 自动重试：40001/42001（token 失效）时刷新 token 重试一次

### 3.2 前端组件（JSSDK 分享）

#### 3.2.1 JSSDK 加载器 (`frontend-next/lib/wechat.ts`)

- `loadWechatJssdk()`: 动态加载 `https://res.wx.qq.com/open/js/jweixin-1.6.0.js`
- `getJssdkConfig(url)`: 调用后端 `/api/wechat/jssdk?url=xxx` 获取签名配置

#### 3.2.2 分享 Hook (`frontend-next/hooks/use-wechat-share.ts`)

```typescript
interface ShareData {
  title: string;
  desc: string;
  link: string;
  imgUrl: string;
}
```
- 在页面挂载时初始化 `wx.config`
- `wx.ready` 后设置 `updateAppMessageShareData` 和 `updateTimelineShareData`
- 容错：非微信环境跳过（检测 `navigator.userAgent` 包含 `MicroMessenger`）

### 3.3 配置（`.env`）

```bash
# 微信公众号配置（暂无凭证，占位）
WECHAT_APP_ID=your_app_id
WECHAT_APP_SECRET=your_app_secret
WECHAT_TOKEN=your_webhook_token
# WECHAT_ENCODING_AES_KEY=（可选，加密模式）
```

## 4. 数据流

### 4.1 公众号消息处理流程

1. 微信平台 GET `/api/wechat/webhook?signature=xxx&timestamp=xxx&nonce=xxx&echostr=xxx`
2. 服务端验证 signature = SHA1(sort(token, timestamp, nonce))
3. 验证通过返回 echostr（明文）

4. 用户发消息 → 微信平台 POST `/api/wechat/webhook`（body: XML）
5. 解析 XML → `{ ToUserName, FromUserName (openid), MsgType, Content, MsgId }`
6. 过滤：仅处理 `MsgType=text`，其他类型回复"暂不支持此消息类型"
7. sessionId = `wechat:${openid}`
8. 调用现有 chat service 内部逻辑（startSession 如不存在 + sendMessage）
9. 设置 4 秒超时 race：
   - 超时：被动回复"正在为您查询…"，异步发送客服消息
   - 未超时：被动回复 AI 答案
10. 检测转人工信号：被动回复"已转接人工客服"

### 4.2 JSSDK 签名流程

1. 前端获取当前页面 URL（不含 hash）
2. GET `/api/wechat/jssdk?url=<encoded_url>`
3. 后端获取 jsapi_ticket（缓存）
4. 计算签名：`SHA1(jsapi_ticket=xxx&noncestr=xxx&timestamp=xxx&url=xxx)`
5. 返回 `{ appId, timestamp, nonceStr, signature }`
6. 前端 `wx.config({ ...signature, jsApiList: ['updateAppMessageShareData', 'updateTimelineShareData'] })`
7. `wx.ready(() => wx.updateAppMessageShareData(shareData))`

## 5. 错误处理

- **签名验证失败**：返回 401，不处理消息
- **XML 解析失败**：返回 200 + 空响应（避免微信重试）
- **AI 服务超时**：被动回复"正在为您查询…"，异步重试
- **客服消息发送失败**：记录日志，不重试（避免死循环）
- **Token 刷新失败**：记录日志，返回错误响应
- **非微信环境调用 JSSDK**：前端静默跳过，不报错

## 6. 测试策略

### 6.1 单元测试（vitest）

- **wechat service**: 签名验证、XML 解析、XML 构造、消息处理逻辑
- **wechat-token-service**: token 缓存、过期刷新、错误处理
- **wechat-message-service**: 客服消息发送、token 失效重试
- **JSSDK 签名**: 签名计算正确性

### 6.2 集成测试

- webhook GET 验证（正确/错误签名）
- webhook POST 消息处理（mock chat service + RAG）
- JSSDK 端点（mock token service）

### 6.3 已知限制

- 无微信凭证，无法做真实接口联调
- 客服消息 API 和 token API 全部 mock
- JSSDK 前端测试需要微信环境（仅测试 hook 逻辑，不测试 wx.config 调用）

## 7. 安全考量

- webhook 签名验证：防止伪造请求
- access_token 不暴露给前端：仅后端使用
- JSSDK 签名端点不暴露 token/ticket：仅返回签名结果
- openid 不作为用户唯一标识暴露：仅用于 session 映射
- 客服消息内容长度限制：微信单条消息 ≤ 2048 字符，截断处理

## 8. 验收标准

1. GET `/api/wechat/webhook` 签名验证正确返回 echostr，错误签名返回 401
2. POST `/api/wechat/webhook` 能解析文本消息 XML 并返回被动回复 XML
3. AI 响应 < 4 秒时，被动回复包含 AI 答案
4. AI 响应 ≥ 4 秒时，被动回复"正在为您查询…"，异步发送客服消息
5. 非文本消息类型回复"暂不支持此消息类型"
6. 转人工信号触发"已转接人工客服"回复
7. GET `/api/wechat/jssdk?url=xxx` 返回正确的签名配置
8. access_token 和 jsapi_ticket 缓存有效，过期自动刷新
9. 前端 `useWechatShare` hook 在非微信环境静默跳过
10. 所有单元测试通过
11. 无第三方微信 SDK 依赖
12. `.env.example` 包含微信配置项

## 9. 文件结构

```
backend/src/
├── api/wechat/
│   ├── controllers/
│   │   ├── __tests__/
│   │   │   └── wechat.test.ts
│   │   └── wechat.ts
│   ├── routes/
│   │   └── wechat.ts
│   └── services/
│       ├── __tests__/
│       │   └── wechat.test.ts
│       └── wechat.ts
├── services/
│   ├── __tests__/
│   │   ├── wechat-token-service.test.ts
│   │   └── wechat-message-service.test.ts
│   ├── wechat-token-service.ts
│   └── wechat-message-service.ts
frontend-next/
├── lib/
│   └── wechat.ts
├── hooks/
│   ├── __tests__/
│   │   └── use-wechat-share.test.ts
│   └── use-wechat-share.ts
```

## 10. 用户预授权决策记录

以下决策由用户在离开前通过 AskUserQuestion 预授权：

1. **功能范围**：公众号客服消息 + JSSDK 分享（不含登录/支付/小程序）
2. **凭证状态**：无凭证，代码+配置+测试先做好
3. **消息回复策略**：混合模式（被动回复 + 客服消息），由设计推荐
4. **方案选择**：复用现有 chat 服务（方案 A），由设计推荐
5. **不引入第三方 SDK**：符合项目零依赖原则
6. **初期明文模式**：不使用 EncodingAESKey 加密，后续可扩展
