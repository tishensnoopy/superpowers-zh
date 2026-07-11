import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::page.page', ({ strapi }) => ({
  async find(ctx) {
    console.log('[Page] find() called');
    try {
      ctx.query = {
        ...ctx.query,
        populate: {
          sections: {
            populate: '*',
          },
          seo: {
            fields: ['metaTitle', 'metaDescription'],
          },
        },
      };
      const result = await super.find(ctx);
      if (result.data && Array.isArray(result.data)) {
        result.data = result.data.map(item => {
          const { id, ...attributes } = item;
          return { id, attributes };
        });
      }
      console.log('[Page] find() completed, count:', result.data?.length);
      return result;
    } catch (err) {
      console.error('[Page] find() failed:', err instanceof Error ? err.message : err);
      throw err;
    }
  },

  async findOne(ctx) {
    console.log('[Page] findOne() called, id:', ctx.params.id);
    try {
      ctx.query = {
        ...ctx.query,
        populate: {
          sections: {
            populate: '*',
          },
          seo: {
            fields: ['metaTitle', 'metaDescription'],
          },
        },
      };
      const result = await super.findOne(ctx);
      console.log('[Page] findOne() completed');
      if (result.data) {
        const { id, ...attributes } = result.data;
        result.data = { id, attributes };
      }
      return result;
    } catch (err) {
      console.error('[Page] findOne() failed:', err instanceof Error ? err.message : err);
      throw err;
    }
  },

  async findBySlug(ctx) {
    console.log('[Page] findBySlug() called, slug:', ctx.params.slug);
    try {
      const page = await strapi.db.query('api::page.page').findOne({
        where: { slug: ctx.params.slug },
        populate: {
          sections: {
            populate: '*',
          },
          seo: {
            fields: ['metaTitle', 'metaDescription'],
          },
        },
      });
      if (!page) {
        console.warn('[Page] findBySlug() page not found:', ctx.params.slug);
        return ctx.notFound('Page not found');
      }
      const { id, ...attributes } = page;
      console.log('[Page] findBySlug() completed, id:', page.id);
      return { data: { id, attributes }, meta: {} };
    } catch (err) {
      console.error('[Page] findBySlug() failed:', err instanceof Error ? err.message : err);
      throw err;
    }
  },

  async getHomepage(ctx) {
    console.log('[Page] getHomepage() called');
    try {
      const page = await strapi.db.query('api::page.page').findOne({
        where: { isHomepage: true },
        populate: ['sections'],
      });
      if (!page) {
        console.warn('[Page] getHomepage() homepage not found');
        return ctx.notFound('Homepage not found');
      }
      const { id, ...attributes } = page;
      console.log('[Page] getHomepage() completed, id:', page.id);
      return { data: { id, attributes }, meta: {} };
    } catch (err) {
      console.error('[Page] getHomepage() failed:', err instanceof Error ? err.message : err);
      throw err;
    }
  },

  async create(ctx) {
    console.log('[Page] create() called');
    console.log('[Page] create() data:', JSON.stringify(ctx.request.body));
    try {
      const result = await super.create(ctx);
      console.log('[Page] create() completed successfully, id:', result.data?.id);
      return result;
    } catch (err) {
      console.error('[Page] create() failed:', err instanceof Error ? err.message : err);
      throw err;
    }
  },

  async update(ctx) {
    console.log('[Page] update() called, id:', ctx.params.id);
    console.log('[Page] update() data:', JSON.stringify(ctx.request.body));
    try {
      const result = await super.update(ctx);
      console.log('[Page] update() completed successfully');
      return result;
    } catch (err) {
      console.error('[Page] update() failed:', err instanceof Error ? err.message : err);
      throw err;
    }
  },

  async delete(ctx) {
    console.log('[Page] delete() called, id:', ctx.params.id);
    try {
      const result = await super.delete(ctx);
      console.log('[Page] delete() completed successfully');
      return result;
    } catch (err) {
      console.error('[Page] delete() failed:', err instanceof Error ? err.message : err);
      throw err;
    }
  },
}));
