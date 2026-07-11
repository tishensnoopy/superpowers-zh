import { factories } from '@strapi/strapi';

export default factories.createCoreService('api::page.page', ({ strapi }) => ({
  async findBySlug(params: any) {
    console.log('[PageService] findBySlug() called, params:', params);
    try {
      const slug = params?.slug || '';
      const page = await strapi.db.query('api::page.page').findOne({
        where: { slug, publishedAt: { $notNull: true } },
        populate: ['sections'],
      });

      console.log('[PageService] findBySlug() completed, found:', !!page);
      return page;
    } catch (err) {
      console.error('[PageService] findBySlug() failed:', err instanceof Error ? err.message : err);
      throw err;
    }
  },

  async getHomepage() {
    console.log('[PageService] getHomepage() called');
    try {
      const page = await strapi.db.query('api::page.page').findOne({
        where: { isHomepage: true, publishedAt: { $notNull: true } },
        populate: ['sections'],
      });

      console.log('[PageService] getHomepage() completed, found:', !!page);
      return page;
    } catch (err) {
      console.error('[PageService] getHomepage() failed:', err instanceof Error ? err.message : err);
      throw err;
    }
  },

  async initializeDefaults() {
    console.log('[PageService] initializeDefaults() called');
    try {
      const existing = await strapi.db.query('api::page.page').findMany();
      console.log('[PageService] initializeDefaults() found existing records:', existing.length);

      if (existing.length === 0) {
        console.log('[PageService] initializeDefaults() creating default pages');
        const defaults = [
          {
            title: 'Home',
            slug: '/',
            isHomepage: true,
            layout: 'full-width',
            showNavigation: true,
            showFooter: true,
            sections: [
              {
                __component: 'section.hero',
                title: '让每个孩子\n自信迈入小学大门',
                subtitle: '2026年秋季班正在招生 · 名额有限',
                description: '专注幼小衔接教育8年，科学课程体系 + 专业师资团队，帮助3-6岁儿童在入学前全面准备。',
                buttonText: '立即预约试听',
                buttonUrl: '/contact',
                isFullWidth: true,
              },
            ],
          },
          {
            title: 'Products',
            slug: '/products',
            isHomepage: false,
            layout: 'full-width',
            showNavigation: true,
            showFooter: true,
            sections: [],
          },
          {
            title: 'About',
            slug: '/about',
            isHomepage: false,
            layout: 'full-width',
            showNavigation: true,
            showFooter: true,
            sections: [],
          },
          {
            title: 'Contact',
            slug: '/contact',
            isHomepage: false,
            layout: 'full-width',
            showNavigation: true,
            showFooter: true,
            sections: [],
          },
        ];
        console.log('[PageService] initializeDefaults() defaults:', JSON.stringify(defaults));

        const created = await Promise.all(
          defaults.map((item, index) => {
            return this.create({ data: item });
          })
        );
        console.log('[PageService] initializeDefaults() created successfully, count:', created.length);
        return created;
      } else {
        console.log('[PageService] initializeDefaults() skipping - already exists');
        return existing;
      }
    } catch (err) {
      console.error('[PageService] initializeDefaults() failed:', err instanceof Error ? err.message : err);
      throw err;
    }
  },

  async getPageTree() {
    console.log('[PageService] getPageTree() called');
    try {
      const pages = await strapi.db.query('api::page.page').findMany({
        where: { parent: null },
        orderBy: { createdAt: 'asc' },
        populate: {
          children: {
            orderBy: { createdAt: 'asc' },
          },
        },
      });
      console.log('[PageService] getPageTree() completed, root pages:', pages.length);
      return pages;
    } catch (err) {
      console.error('[PageService] getPageTree() failed:', err instanceof Error ? err.message : err);
      throw err;
    }
  },
}));
