import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::faq-item.faq-item', ({ strapi }) => ({
  async find(ctx) {
    console.log('[FaqItem] find() called');
    try {
      ctx.query = {
        ...ctx.query,
        populate: [],
      };
      const result = await super.find(ctx);
      console.log('[FaqItem] find() completed, count:', result.data?.length);
      return result;
    } catch (err) {
      console.error('[FaqItem] find() failed:', err instanceof Error ? err.message : err);
      throw err;
    }
  },

  async findOne(ctx) {
    console.log('[FaqItem] findOne() called, id:', ctx.params.id);
    try {
      ctx.query = {
        ...ctx.query,
        populate: [],
      };
      const result = await super.findOne(ctx);
      console.log('[FaqItem] findOne() completed');
      return result;
    } catch (err) {
      console.error('[FaqItem] findOne() failed:', err instanceof Error ? err.message : err);
      throw err;
    }
  },

  async findByCategory(ctx) {
    console.log('[FaqItem] findByCategory() called, category:', ctx.params.category);
    try {
      const faqs = await strapi.db.query('api::faq-item.faq-item').findMany({
        where: { category: ctx.params.category, isActive: true },
        orderBy: { sortOrder: 'asc' },
      });
      console.log('[FaqItem] findByCategory() completed, count:', faqs.length);
      return { data: faqs, meta: {} };
    } catch (err) {
      console.error('[FaqItem] findByCategory() failed:', err instanceof Error ? err.message : err);
      throw err;
    }
  },

  async search(ctx) {
    console.log('[FaqItem] search() called, query:', ctx.query.q);
    try {
      const query = ctx.query.q || '';
      const faqs = await strapi.db.query('api::faq-item.faq-item').findMany({
        where: {
          $or: [
            { question: { $containsi: query } },
            { answer: { $containsi: query } },
            { tags: { $containsi: query } },
          ],
          isActive: true,
        },
        orderBy: { sortOrder: 'asc' },
      });
      console.log('[FaqItem] search() completed, count:', faqs.length);
      return { data: faqs, meta: {} };
    } catch (err) {
      console.error('[FaqItem] search() failed:', err instanceof Error ? err.message : err);
      throw err;
    }
  },

  async submitFeedback(ctx) {
    console.log('[FaqItem] submitFeedback() called, faqId:', ctx.params.id);
    console.log('[FaqItem] submitFeedback() data:', JSON.stringify(ctx.request.body));
    try {
      const { helpful, comment } = ctx.request.body.data || {};
      const faq = await strapi.db.query('api::faq-item.faq-item').findOne({
        where: { id: ctx.params.id },
      });

      if (!faq) {
        console.warn('[FaqItem] submitFeedback() FAQ not found:', ctx.params.id);
        return ctx.notFound('FAQ not found');
      }

      const updateData = {
        feedbackCount: (faq.feedbackCount || 0) + 1,
        helpfulCount: helpful ? (faq.helpfulCount || 0) + 1 : faq.helpfulCount || 0,
      };
      await strapi.db.query('api::faq-item.faq-item').update({
        where: { id: ctx.params.id },
        data: updateData,
      });
      console.log('[FaqItem] submitFeedback() updated feedback counts');

      if (!helpful || comment) {
        const { addJob } = await import('../../../utils/queue');
        await addJob('faq-feedback', 'analyze-feedback', {
          type: 'analyze-feedback',
          faqId: ctx.params.id,
          helpful,
          comment,
        });
        console.log('[FaqItem] submitFeedback() added to faq-feedback queue');
      }

      return { data: { success: true }, meta: {} };
    } catch (err) {
      console.error('[FaqItem] submitFeedback() failed:', err instanceof Error ? err.message : err);
      throw err;
    }
  },

  async create(ctx) {
    console.log('[FaqItem] create() called');
    console.log('[FaqItem] create() data:', JSON.stringify(ctx.request.body));
    try {
      const result = await super.create(ctx);
      console.log('[FaqItem] create() completed successfully, id:', result.data?.id);
      return result;
    } catch (err) {
      console.error('[FaqItem] create() failed:', err instanceof Error ? err.message : err);
      throw err;
    }
  },

  async update(ctx) {
    console.log('[FaqItem] update() called, id:', ctx.params.id);
    console.log('[FaqItem] update() data:', JSON.stringify(ctx.request.body));
    try {
      const result = await super.update(ctx);
      console.log('[FaqItem] update() completed successfully');
      return result;
    } catch (err) {
      console.error('[FaqItem] update() failed:', err instanceof Error ? err.message : err);
      throw err;
    }
  },

  async delete(ctx) {
    console.log('[FaqItem] delete() called, id:', ctx.params.id);
    try {
      const result = await super.delete(ctx);
      console.log('[FaqItem] delete() completed successfully');
      return result;
    } catch (err) {
      console.error('[FaqItem] delete() failed:', err instanceof Error ? err.message : err);
      throw err;
    }
  },
}));
