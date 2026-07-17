import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::navigation.navigation', ({ strapi }) => ({
  async find(ctx) {
    console.log('[Navigation] find() called');
    try {
      ctx.query = {
        ...ctx.query,
        populate: ['children'],
      };
      const result = await super.find(ctx);
      console.log('[Navigation] find() completed, count:', result.data?.length);
      return result;
    } catch (err) {
      console.error('[Navigation] find() failed:', err instanceof Error ? err.message : err);
      throw err;
    }
  },

  async findOne(ctx) {
    console.log('[Navigation] findOne() called, id:', ctx.params.id);
    try {
      const result = await super.findOne(ctx);
      console.log('[Navigation] findOne() completed');
      return result;
    } catch (err) {
      console.error('[Navigation] findOne() failed:', err instanceof Error ? err.message : err);
      throw err;
    }
  },

  async getNavigationTree(ctx) {
    // locale 感知导航树：
    // v5 i18n 中关系字段恒为 localized，en-US 行的 parent 链接可能缺失，
    // 因此结构（父子层级、排序）始终取自 zh-CN 主版本，
    // 显示字段（name/url/icon）按 documentId 从目标 locale 覆盖，缺失则回退 zh-CN。
    const locale = typeof ctx.query.locale === 'string' && ctx.query.locale !== '' ? ctx.query.locale : 'zh-CN';
    console.log('[Navigation] getNavigationTree() called, locale:', locale);
    try {
      const zhItems = await strapi.db.query('api::navigation.navigation').findMany({
        where: { locale: 'zh-CN' },
        orderBy: { position: 'asc' },
        populate: { parent: true, children: true },
      });

      const localizedByDocId = new Map<string, Record<string, unknown>>();
      if (locale !== 'zh-CN') {
        const localizedItems = await strapi.db.query('api::navigation.navigation').findMany({
          where: { locale },
        });
        for (const item of localizedItems) {
          localizedByDocId.set(item.documentId, item);
        }
      }

      const mergeLocale = (item) => {
        const loc = localizedByDocId.get(item.documentId);
        if (!loc) return item;
        return {
          ...item,
          name: loc.name ?? item.name,
          url: loc.url ?? item.url,
          icon: loc.icon ?? item.icon,
        };
      };

      const items = zhItems
        .filter((it) => !it.parent)
        .map((root) => ({
          ...mergeLocale(root),
          children: (root.children ?? [])
            .slice()
            .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
            .map((child) => mergeLocale(child)),
        }));

      console.log('[Navigation] getNavigationTree() completed, root items:', items.length);
      return { data: items, meta: {} };
    } catch (err) {
      console.error('[Navigation] getNavigationTree() failed:', err instanceof Error ? err.message : err);
      throw err;
    }
  },

  async create(ctx) {
    console.log('[Navigation] create() called');
    try {
      const result = await super.create(ctx);
      console.log('[Navigation] create() completed successfully, id:', result.data?.id);
      return result;
    } catch (err) {
      console.error('[Navigation] create() failed:', err instanceof Error ? err.message : err);
      throw err;
    }
  },

  async update(ctx) {
    console.log('[Navigation] update() called, id:', ctx.params.id);
    try {
      const result = await super.update(ctx);
      console.log('[Navigation] update() completed successfully');
      return result;
    } catch (err) {
      console.error('[Navigation] update() failed:', err instanceof Error ? err.message : err);
      throw err;
    }
  },

  async delete(ctx) {
    console.log('[Navigation] delete() called, id:', ctx.params.id);
    try {
      const result = await super.delete(ctx);
      console.log('[Navigation] delete() completed successfully');
      return result;
    } catch (err) {
      console.error('[Navigation] delete() failed:', err instanceof Error ? err.message : err);
      throw err;
    }
  },
}));
