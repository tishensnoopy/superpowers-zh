import { factories } from '@strapi/strapi';

export default factories.createCoreService('api::faq-item.faq-item', ({ strapi }) => ({
  async generateFaqFromDocument(documentId: number) {
    console.log('[FaqItemService] generateFaqFromDocument() called, documentId:', documentId);
    try {
      const document = await strapi.db.query('api::knowledge-base.knowledge-base').findOne({
        where: { id: documentId },
      });

      if (!document) {
        console.warn('[FaqItemService] generateFaqFromDocument() document not found:', documentId);
        return [];
      }

      console.log('[FaqItemService] generateFaqFromDocument() analyzing document:', document.title);

      const generatedFaqs = [
        {
          question: `What is ${document.title}?`,
          answer: 'This is a generated FAQ answer based on the document content.',
          category: 'General',
          tags: document.tags || '',
          isActive: true,
          sourceDocument: documentId,
        },
        {
          question: `How to use ${document.title}?`,
          answer: 'This is another generated FAQ answer.',
          category: 'Usage',
          tags: document.tags || '',
          isActive: true,
          sourceDocument: documentId,
        },
      ];

      const created = await Promise.all(
        generatedFaqs.map((item) => {
          return this.create({ data: item });
        })
      );
      console.log('[FaqItemService] generateFaqFromDocument() created', created.length, 'FAQs');
      return created;
    } catch (err) {
      console.error('[FaqItemService] generateFaqFromDocument() failed:', err instanceof Error ? err.message : err);
      throw err;
    }
  },

  async initializeDefaults() {
    console.log('[FaqItemService] initializeDefaults() called');
    try {
      const existing = await strapi.db.query('api::faq-item.faq-item').findMany();
      console.log('[FaqItemService] initializeDefaults() found existing records:', existing.length);

      if (existing.length === 0) {
        console.log('[FaqItemService] initializeDefaults() creating default FAQs');
        const defaults = [
          {
            question: 'What products do you offer?',
            answer: 'We offer a wide range of products including Product A, Product B, and Product C.',
            category: 'Products',
            tags: 'products, offer',
            isActive: true,
            sortOrder: 0,
          },
          {
            question: 'How do I contact customer support?',
            answer: 'You can contact our customer support via phone or email.',
            category: 'Support',
            tags: 'support, contact',
            isActive: true,
            sortOrder: 1,
          },
          {
            question: 'What is your return policy?',
            answer: 'We offer a 30-day return policy for most products.',
            category: 'Policies',
            tags: 'return, policy',
            isActive: true,
            sortOrder: 2,
          },
        ];
        console.log('[FaqItemService] initializeDefaults() defaults:', JSON.stringify(defaults));

        const created = await Promise.all(
          defaults.map((item, index) => {
            return this.create({ data: item });
          })
        );
        console.log('[FaqItemService] initializeDefaults() created successfully, count:', created.length);
        return created;
      } else {
        console.log('[FaqItemService] initializeDefaults() skipping - already exists');
        return existing;
      }
    } catch (err) {
      console.error('[FaqItemService] initializeDefaults() failed:', err instanceof Error ? err.message : err);
      throw err;
    }
  },

  async getCategories() {
    console.log('[FaqItemService] getCategories() called');
    try {
      const faqs = await strapi.db.query('api::faq-item.faq-item').findMany({
        where: { isActive: true },
        select: ['category'],
      });
      const categories = [...new Set(faqs.map(f => f.category).filter(Boolean))];
      console.log('[FaqItemService] getCategories() completed, count:', categories.length);
      return categories;
    } catch (err) {
      console.error('[FaqItemService] getCategories() failed:', err instanceof Error ? err.message : err);
      throw err;
    }
  },
}));
