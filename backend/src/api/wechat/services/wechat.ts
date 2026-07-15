import * as crypto from 'crypto';

export interface WechatMessage {
  ToUserName: string;
  FromUserName: string;
  CreateTime?: string;
  MsgType: string;
  Content?: string;
  MsgId?: string;
  PicUrl?: string;
  [key: string]: string | undefined;
}

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

export async function parseXml(xmlString: string): Promise<WechatMessage> {
  const result: WechatMessage = {} as WechatMessage;
  const regex = /<(\w+)>(?:<!\[CDATA\[([\s\S]*?)\]\]>|([^<]*))<\/\1>/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(xmlString)) !== null) {
    const key = match[1];
    const value = match[2] !== undefined ? match[2] : match[3];
    result[key] = value;
  }
  return result;
}

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
 * 1. Map openid -> sessionId (`wechat:${openid}`)
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
  const sessions = await strapi.documents('api::chat-session.chat-session').findMany({
    filters: { sessionId },
    limit: 1,
  });
  let session = sessions && sessions.length > 0 ? sessions[0] : null;

  if (!session) {
    const created = await strapi.documents('api::chat-session.chat-session').create({
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
    session = created || null;
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
    aiPromise
      .then(async (answer) => {
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
        await sendCustomMessage(openid, answer);
      })
      .catch((err) => {
        console.error(`[wechat] Async follow-up failed for ${openid}:`, err instanceof Error ? err.message : err);
      });

    return {
      passiveReply: QUERYING_REPLY,
      asyncFollowUp: true,
      followUpContent: undefined,
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
