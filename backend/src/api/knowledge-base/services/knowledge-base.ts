import { factories } from '@strapi/strapi';

export default factories.createCoreService('api::knowledge-base.knowledge-base', ({ strapi }) => ({
  async search(params: any) {
    try {
      const query = params?.query || '';
      const documents = await strapi.db.query('api::knowledge-base.knowledge-base').findMany({
        where: {
          status: 'ready',
          $or: [
            { title: { $containsi: query } },
            { content: { $containsi: query } },
            { tags: { $containsi: query } },
          ],
        },
        orderBy: { priority: 'desc', createdAt: 'desc' },
      });

      return { data: documents };
    } catch (err) {
      console.error('[KnowledgeBaseService] search() failed:', err instanceof Error ? err.message : err);
      throw err;
    }
  },

  async updateStatus(documentId: number, status: string, message?: string) {
    try {
      const updateData: any = { status };
      if (message) {
        updateData.statusMessage = message;
      }
      if (status === 'ready') {
        updateData.processedAt = new Date();
        updateData.failedAt = null;
      } else if (status === 'failed') {
        updateData.failedAt = new Date();
        const document = await strapi.db.query('api::knowledge-base.knowledge-base').findOne({
          where: { id: documentId },
        });
        if (document) {
          updateData.retryCount = (document.retryCount || 0) + 1;
        }
      } else if (status === 'processing') {
        updateData.processedAt = null;
        updateData.failedAt = null;
      }

      const result = await this.update(documentId, { data: updateData });
      return result;
    } catch (err) {
      console.error('[KnowledgeBaseService] updateStatus() failed:', err instanceof Error ? err.message : err);
      throw err;
    }
  },

  async setVectorDbIds(documentId: number, ids: string[]) {
    try {
      const result = await this.update(documentId, {
        data: {
          vectorDbIds: ids,
          chunkCount: ids.length,
        },
      });
      return result;
    } catch (err) {
      console.error('[KnowledgeBaseService] setVectorDbIds() failed:', err instanceof Error ? err.message : err);
      throw err;
    }
  },

  async initializeDefaults() {
    try {
      const existing = await strapi.db.query('api::knowledge-base.knowledge-base').findMany();

      if (existing.length === 0) {
        const defaults = [
          {
            title: 'Introduction to Our Company',
            content: 'Welcome to our company. We provide high-quality products and services.',
            sourceType: 'manual',
            status: 'ready',
            priority: 'high',
            tags: 'company, introduction, about',
          },
          {
            title: 'Product FAQ',
            content: 'Frequently asked questions about our products.',
            sourceType: 'faq',
            status: 'ready',
            priority: 'medium',
            tags: 'product, FAQ, questions',
          },
          {
            title: 'Technical Documentation',
            content: 'Technical specifications and documentation.',
            sourceType: 'manual',
            status: 'pending',
            priority: 'low',
            tags: 'technical, documentation, specs',
          },
        ];

        const created = await Promise.all(
          defaults.map((item, index) => {
            return this.create({ data: item });
          })
        );
        return created;
      } else {
        return existing;
      }
    } catch (err) {
      console.error('[KnowledgeBaseService] initializeDefaults() failed:', err instanceof Error ? err.message : err);
      throw err;
    }
  },

  async getPendingDocuments() {
    try {
      const documents = await strapi.db.query('api::knowledge-base.knowledge-base').findMany({
        where: { status: 'pending' },
        orderBy: { priority: 'desc', createdAt: 'asc' },
      });
      return documents;
    } catch (err) {
      console.error('[KnowledgeBaseService] getPendingDocuments() failed:', err instanceof Error ? err.message : err);
      throw err;
    }
  },

  async deleteVectors(knowledgeBaseId: number) {
    try {
      // knowledge_embeddings 表的列是 knowledge_base_id（整数），不是 documentId
      await strapi.db.connection.raw(
        'DELETE FROM knowledge_embeddings WHERE knowledge_base_id = ?',
        [knowledgeBaseId]
      );
      return true;
    } catch (err) {
      console.error('[KnowledgeBaseService] deleteVectors() failed:', err);
      return false;
    }
  },

  async findBySourceUrl(sourceUrl: string) {
    return strapi.db.query('api::knowledge-base.knowledge-base').findOne({
      where: { sourceUrl },
    });
  },
}));
