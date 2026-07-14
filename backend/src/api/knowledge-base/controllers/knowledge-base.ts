import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::knowledge-base.knowledge-base', ({ strapi }) => ({
  async find(ctx) {
    console.log('[KnowledgeBase] find() called');
    try {
      ctx.query = {
        ...ctx.query,
        populate: [],
      };
      const result = await super.find(ctx);
      console.log('[KnowledgeBase] find() completed, count:', result.data?.length);
      return result;
    } catch (err) {
      console.error('[KnowledgeBase] find() failed:', err instanceof Error ? err.message : err);
      throw err;
    }
  },

  async findOne(ctx) {
    console.log('[KnowledgeBase] findOne() called, id:', ctx.params.id);
    try {
      ctx.query = {
        ...ctx.query,
        populate: [],
      };
      const result = await super.findOne(ctx);
      console.log('[KnowledgeBase] findOne() completed');
      return result;
    } catch (err) {
      console.error('[KnowledgeBase] findOne() failed:', err instanceof Error ? err.message : err);
      throw err;
    }
  },

  async create(ctx) {
    console.log('[KnowledgeBase] create() called');
    console.log('[KnowledgeBase] create() data:', JSON.stringify(ctx.request.body));
    try {
      ctx.request.body.data = {
        ...ctx.request.body.data,
        status: 'pending',
        retryCount: 0,
      };
      const result = await super.create(ctx);
      console.log('[KnowledgeBase] create() completed successfully, id:', result.data?.id);

      const { addJob } = await import('../../../utils/queue');
      await addJob('document-processing', 'vectorize', {
        type: 'vectorize',
        documentId: result.data?.id,
      });
      console.log('[KnowledgeBase] create() added to document-processing queue');

      return result;
    } catch (err) {
      console.error('[KnowledgeBase] create() failed:', err instanceof Error ? err.message : err);
      throw err;
    }
  },

  async update(ctx) {
    console.log('[KnowledgeBase] update() called, id:', ctx.params.id);
    console.log('[KnowledgeBase] update() data:', JSON.stringify(ctx.request.body));
    try {
      const result = await super.update(ctx);
      console.log('[KnowledgeBase] update() completed successfully');

      const document = await strapi.db.query('api::knowledge-base.knowledge-base').findOne({
        where: { id: ctx.params.id },
      });
      if (document?.content && document.status === 'ready') {
        const { addJob } = await import('../../../utils/queue');
      await addJob('document-processing', 'revectorize', {
        type: 'revectorize',
        documentId: ctx.params.id,
      });
      console.log('[KnowledgeBase] update() added to document-processing queue for re-vectorization');
      }

      return result;
    } catch (err) {
      console.error('[KnowledgeBase] update() failed:', err instanceof Error ? err.message : err);
      throw err;
    }
  },

  async delete(ctx) {
    console.log('[KnowledgeBase] delete() called, id:', ctx.params.id);
    try {
      const document = await strapi.db.query('api::knowledge-base.knowledge-base').findOne({
        where: { id: ctx.params.id },
      });
      if (document?.vectorDbIds) {
        console.log('[KnowledgeBase] delete() cleaning up vector DB entries:', document.vectorDbIds);
      }

      const result = await super.delete(ctx);
      console.log('[KnowledgeBase] delete() completed successfully');
      return result;
    } catch (err) {
      console.error('[KnowledgeBase] delete() failed:', err instanceof Error ? err.message : err);
      throw err;
    }
  },

  async search(ctx) {
    console.log('[KnowledgeBase] search() called, query:', ctx.query.q);
    try {
      const query = ctx.query.q || '';
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
      console.log('[KnowledgeBase] search() completed, count:', results.length);
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
