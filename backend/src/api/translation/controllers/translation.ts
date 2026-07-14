/**
 * POST /api/translation/assist
 *
 * Admin-only endpoint that uses DashScope to translate document fields
 * from sourceLocale to targetLocale. Returns a draft JSON — the admin
 * reviews and manually saves it to the en-US locale entry in Strapi.
 *
 * The translation service is loaded lazily via dynamic import() so this
 * controller registers even before the service file exists (incremental
 * dev safety, same pattern as chat controller). Using import() instead of
 * require() allows vitest's vi.doMock to intercept the module in tests.
 * Path '../services/translation' resolves to
 * backend/src/api/translation/services/translation.ts.
 */

const CONTENT_TYPE_UIDS: Record<string, string> = {
  products: 'api::product.product',
  news: 'api::news-article.news-article',
  campuses: 'api::campus.campus',
  teachers: 'api::teacher.teacher',
  pages: 'api::page.page',
  faq: 'api::faq-item.faq-item',
};

function isAdmin(ctx: any): boolean {
  const user = ctx.state?.user;
  if (!user) return false;
  const roles = user.roles || [];
  return roles.some((r: any) => r.name === 'strapi-super-admin' || r.name === 'strapi-editor');
}

export default {
  async assist(ctx: any) {
    // 1. Permission check
    if (!isAdmin(ctx)) {
      ctx.throw(403, JSON.stringify({ error: { code: 'FORBIDDEN' } }));
      return;
    }

    // 2. Input validation
    const { sourceLocale, targetLocale, contentType, documentId, fields } = ctx.request.body || {};

    if (!contentType || !(contentType in CONTENT_TYPE_UIDS)) {
      ctx.throw(400, JSON.stringify({ error: { code: 'INVALID_PARAMS', message: 'contentType not in whitelist' } }));
      return;
    }
    if (!documentId) {
      ctx.throw(400, JSON.stringify({ error: { code: 'INVALID_PARAMS', message: 'documentId required' } }));
      return;
    }
    if (!Array.isArray(fields) || fields.length === 0) {
      ctx.throw(400, JSON.stringify({ error: { code: 'INVALID_PARAMS', message: 'fields must be non-empty array' } }));
      return;
    }

    // 3. Read source document
    const uid = CONTENT_TYPE_UIDS[contentType];
    const sourceDoc = await strapi.documents(uid).findOne({
      documentId,
      locale: sourceLocale || 'zh-CN',
    });

    if (!sourceDoc) {
      ctx.throw(404, JSON.stringify({ error: { code: 'SOURCE_NOT_FOUND' } }));
      return;
    }

    // 4. Extract fields to translate
    const fieldsToTranslate: Record<string, string> = {};
    for (const field of fields) {
      const value = (sourceDoc as any)[field];
      if (typeof value === 'string' && value.length > 0) {
        fieldsToTranslate[field] = value;
      }
    }

    if (Object.keys(fieldsToTranslate).length === 0) {
      ctx.body = { translations: {} };
      return;
    }

    // 5. Call DashScope via translation service
    const apiKey = process.env.DASHSCOPE_API_KEY;
    if (!apiKey) {
      ctx.throw(502, JSON.stringify({ error: { code: 'AI_PROVIDER_ERROR', message: 'DASHSCOPE_API_KEY not set' } }));
      return;
    }

    // Lazy-load the translation service via dynamic import (not require) so
    // that vitest's vi.doMock can intercept it in tests. Path '../services/translation'
    // resolves from controllers/ to backend/src/api/translation/services/translation.ts.
    // Tests use vi.doMock('../../services/translation') from __tests__/ which
    // resolves to the same file.
    const { translateDocument } = await import('../services/translation') as {
      translateDocument: (opts: { apiKey: string; fields: Record<string, string> }) => Promise<Record<string, string>>;
    };

    let translations: Record<string, string>;
    try {
      translations = await translateDocument({ apiKey, fields: fieldsToTranslate });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes('AI_RESPONSE_PARSE_ERROR')) {
        ctx.throw(502, JSON.stringify({ error: { code: 'AI_RESPONSE_PARSE_ERROR' } }));
      } else {
        ctx.throw(502, JSON.stringify({ error: { code: 'AI_PROVIDER_ERROR', message: '上游服务异常' } }));
      }
      return;
    }

    // 6. Field completeness check
    const missingFields = fields.filter(f => !(f in translations));
    if (missingFields.length > 0) {
      console.error(`[translation] AI response missing fields: ${missingFields.join(', ')}`);
      ctx.throw(502, JSON.stringify({ error: { code: 'AI_RESPONSE_INCOMPLETE', message: `Missing: ${missingFields.join(', ')}` } }));
      return;
    }

    ctx.body = { translations };
  },
};
