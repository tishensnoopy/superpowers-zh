import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::knowledge-base.knowledge-base', ({ strapi }) => ({
  async find(ctx) {
    try {
      ctx.query = {
        ...ctx.query,
        populate: [],
      };
      return await super.find(ctx);
    } catch (err) {
      console.error('[KnowledgeBase] find() failed:', err instanceof Error ? err.message : err);
      throw err;
    }
  },

  async findOne(ctx) {
    try {
      ctx.query = {
        ...ctx.query,
        populate: [],
      };
      return await super.findOne(ctx);
    } catch (err) {
      console.error('[KnowledgeBase] findOne() failed:', err instanceof Error ? err.message : err);
      throw err;
    }
  },

  async create(ctx) {
    try {
      ctx.request.body.data = {
        ...ctx.request.body.data,
        status: 'pending',
        retryCount: 0,
      };
      const result = await super.create(ctx);

      const { addJob } = await import('../../../utils/queue');
      await addJob('document-processing', 'vectorize', {
        type: 'vectorize',
        documentId: result.data?.id,
      });

      return result;
    } catch (err) {
      console.error('[KnowledgeBase] create() failed:', err instanceof Error ? err.message : err);
      throw err;
    }
  },

  async update(ctx) {
    try {
      const result = await super.update(ctx);

      // Strapi v5: ctx.params.id 是 documentId（字符串），db.query 需用 documentId 过滤
      const document = await strapi.db.query('api::knowledge-base.knowledge-base').findOne({
        where: { documentId: ctx.params.id },
      });
      if (document?.content && document.status === 'ready') {
        const { addJob } = await import('../../../utils/queue');
        await addJob('document-processing', 'revectorize', {
          type: 'revectorize',
          documentId: ctx.params.id,
        });
      }

      return result;
    } catch (err) {
      console.error('[KnowledgeBase] update() failed:', err instanceof Error ? err.message : err);
      throw err;
    }
  },

  async delete(ctx) {
    try {
      // Strapi v5: ctx.params.id 是 documentId（字符串），db.query 需用 documentId 过滤
      const document = await strapi.db.query('api::knowledge-base.knowledge-base').findOne({
        where: { documentId: ctx.params.id },
      });
      // 清理 pgvector 中的向量数据，防止孤立残留
      if (document?.id) {
        const kbService = strapi.service('api::knowledge-base.knowledge-base');
        if (kbService && typeof (kbService as any).deleteVectors === 'function') {
          const deleted = await (kbService as any).deleteVectors(document.id);
          if (!deleted) {
            console.warn('[KnowledgeBase] delete() vector cleanup failed for id:', document.id);
          }
        }
      }

      return await super.delete(ctx);
    } catch (err) {
      console.error('[KnowledgeBase] delete() failed:', err instanceof Error ? err.message : err);
      throw err;
    }
  },

  async search(ctx) {
    try {
      const query = String(ctx.query.q || '');
      // 限制查询长度，防止恶意超长输入
      if (query.length > 200) {
        ctx.throw(400, '查询关键词不能超过 200 字符');
      }
      const results = await strapi.db.query('api::knowledge-base.knowledge-base').findMany({
        where: {
          $or: [
            { title: { $containsi: query } },
            { content: { $containsi: query } },
            { tags: { $containsi: query } },
          ],
          status: 'ready',
        },
      });
      return { data: results, meta: {} };
    } catch (err) {
      console.error('[KnowledgeBase] search() failed:', err instanceof Error ? err.message : err);
      throw err;
    }
  },

  async syncAll(ctx) {
    try {
      const { syncWebsiteContent } = require('../../../services/knowledge-sync-service');
      const result = await syncWebsiteContent(strapi);
      ctx.body = { success: true, synced: result.synced, updated: result.updated, errors: result.errors };
    } catch (err) {
      ctx.badRequest('Sync failed: ' + (err instanceof Error ? err.message : err));
    }
  },
}));
