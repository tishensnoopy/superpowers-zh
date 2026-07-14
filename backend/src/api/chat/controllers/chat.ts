/**
 * AI customer service chat controller.
 *
 * Endpoints (see routes/chat.ts):
 *   POST /chat/start     - startSession
 *   POST /chat/message   - sendMessage (intent detect + RAG answer)
 *   POST /chat/transfer  - transferToHuman
 *   GET  /chat/history/:sessionId - getHistory
 *   POST /chat/feedback  - submitFeedback
 *
 * Database access uses the Strapi v5 Document Service API. The LLM/RAG services
 * are required lazily so this controller registers even before those service
 * files exist (incremental dev safety); a missing service surfaces as a 500
 * only when the relevant endpoint is actually called.
 */

interface ChatMessageRow {
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt?: string;
}

function randomId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export default {
  async startSession(ctx: any) {
    const { visitorName, visitorPhone, sourcePage } = ctx.request.body || {};

    const sessionId = randomId('sess');
    const visitorId = randomId('vis');

    const session = await strapi.documents('api::chat-session.chat-session').create({
      data: {
        sessionId,
        visitorId,
        visitorName: visitorName || null,
        visitorPhone: visitorPhone || null,
        sourcePage: sourcePage || null,
        status: 'active',
      },
    });

    ctx.body = { sessionId, visitorId, documentId: session.documentId };
  },

  async sendMessage(ctx: any) {
    const { sessionId, message } = ctx.request.body || {};
    if (!sessionId || !message) {
      ctx.throw(400, 'sessionId and message are required');
    }

    // 1. Find the session by business sessionId.
    const sessions = await strapi.documents('api::chat-session.chat-session').findMany({
      filters: { sessionId },
      limit: 1,
    });
    if (!sessions || sessions.length === 0) {
      ctx.throw(404, 'Session not found');
    }
    const session = sessions[0];

    // Already handed off to a human agent.
    if (session.status === 'transferred') {
      ctx.body = { type: 'transfer', content: '您已被转接至人工客服，请稍候。' };
      return;
    }

    // 2. Persist the user message.
    await strapi.documents('api::chat-message.chat-message').create({
      data: { session: session.documentId, role: 'user', content: message },
    });

    // 3. Intent detection — transfer to human if appropriate.
    const { detectIntent } = require('../../../services/llm-service') as {
      detectIntent: (message: string) => Promise<{ shouldTransfer: boolean }>;
    };
    const intent = await detectIntent(message);
    if (intent?.shouldTransfer) {
      // Use db.query for the status update: the Strapi v5 Document Service
      // `update` data type reserves/excludes a custom `status` attribute, while
      // db.query writes the column directly. Consistent with the knowledge-base
      // code which also manages `status` via db.query / service layer.
      await strapi.db.query('api::chat-session.chat-session').update({
        where: { id: session.id },
        data: { status: 'transferred', transferredAt: new Date().toISOString() },
      });
      ctx.body = { type: 'transfer', content: '好的，正在为您转接人工客服，请稍候...' };
      return;
    }

    // 4. Gather recent history for context (last 10 messages).
    const history = await strapi.documents('api::chat-message.chat-message').findMany({
      filters: { session: session.documentId },
      sort: { createdAt: 'asc' },
      limit: 10,
    });

    // 5. RAG: retrieve relevant chunks + generate the answer.
    const { retrieve, generateAnswer } = require('../../../services/rag-service') as {
      retrieve: (query: string, topK: number) => Promise<any[]>;
      generateAnswer: (
        query: string,
        docs: any[],
        history: ChatMessageRow[]
      ) => Promise<{ content: string; tokenCount?: number; latencyMs?: number }>;
    };

    const docs = await retrieve(message, 5);
    const result = await generateAnswer(
      message,
      docs,
      (history || []).map((h: any) => ({ role: h.role, content: h.content }))
    );

    // 6. Persist the assistant message.
    await strapi.documents('api::chat-message.chat-message').create({
      data: {
        session: session.documentId,
        role: 'assistant',
        content: result.content,
        tokenCount: result.tokenCount || 0,
        latencyMs: result.latencyMs || 0,
        // `retrievedDocs` is a JSON column — store the array directly, not a
        // stringified string, so it round-trips as a parsed value.
        retrievedDocs:
          docs && docs.length > 0
            ? docs.map((d: any) => ({
                id: d.id,
                text: d.chunk_text ? d.chunk_text.slice(0, 200) : '',
              }))
            : null,
      },
    });

    ctx.body = { type: 'answer', content: result.content, retrievedDocs: docs ? docs.length : 0 };
  },

  async transferToHuman(ctx: any) {
    const { sessionId } = ctx.request.body || {};
    if (!sessionId) {
      ctx.throw(400, 'sessionId is required');
    }

    const sessions = await strapi.documents('api::chat-session.chat-session').findMany({
      filters: { sessionId },
      limit: 1,
    });
    if (!sessions || sessions.length === 0) {
      ctx.throw(404, 'Session not found');
    }

    // See note in sendMessage: db.query is used for the custom `status` column.
    await strapi.db.query('api::chat-session.chat-session').update({
      where: { id: sessions[0].id },
      data: { status: 'transferred', transferredAt: new Date().toISOString() },
    });

    ctx.body = { success: true, message: '已转接至人工客服' };
  },

  async getHistory(ctx: any) {
    const { sessionId } = ctx.params;
    const sessions = await strapi.documents('api::chat-session.chat-session').findMany({
      filters: { sessionId },
      limit: 1,
    });
    if (!sessions || sessions.length === 0) {
      ctx.throw(404, 'Session not found');
    }
    const session = sessions[0];

    const messages = await strapi.documents('api::chat-message.chat-message').findMany({
      filters: { session: session.documentId },
      sort: { createdAt: 'asc' },
      limit: 100,
    });

    ctx.body = {
      session: { sessionId, status: session.status },
      messages: (messages || []).map((m: any) => ({
        role: m.role,
        content: m.content,
        createdAt: m.createdAt,
      })),
    };
  },

  async submitFeedback(ctx: any) {
    const { sessionId, question, answer, helpful } = ctx.request.body || {};
    if (!sessionId || !question) {
      ctx.throw(400, 'sessionId and question are required');
    }

    const { feedbackToFaq } = require('../../../services/rag-service') as {
      feedbackToFaq: (question: string, answer: string, sessionId: string) => Promise<any>;
    };
    await feedbackToFaq(question, answer || '', sessionId);

    ctx.body = { success: true, message: '感谢您的反馈' };
  },
};
