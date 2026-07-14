import { factories } from '@strapi/strapi';

export default factories.createCoreService('api::knowledge-base.knowledge-base', ({ strapi }) => ({
  async search(params: any) {
    console.log('[KnowledgeBaseService] search() called, params:', params);
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

      console.log('[KnowledgeBaseService] search() completed, found:', documents.length);
      return { data: documents };
    } catch (err) {
      console.error('[KnowledgeBaseService] search() failed:', err instanceof Error ? err.message : err);
      throw err;
    }
  },

  async updateStatus(documentId: number, status: string, message?: string) {
    console.log('[KnowledgeBaseService] updateStatus() called, documentId:', documentId, 'status:', status);
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
      console.log('[KnowledgeBaseService] updateStatus() completed successfully');
      return result;
    } catch (err) {
      console.error('[KnowledgeBaseService] updateStatus() failed:', err instanceof Error ? err.message : err);
      throw err;
    }
  },

  async setVectorDbIds(documentId: number, ids: string[]) {
    console.log('[KnowledgeBaseService] setVectorDbIds() called, documentId:', documentId, 'ids:', ids);
    try {
      const result = await this.update(documentId, {
        data: {
          vectorDbIds: ids,
          chunkCount: ids.length,
        },
      });
      console.log('[KnowledgeBaseService] setVectorDbIds() completed successfully');
      return result;
    } catch (err) {
      console.error('[KnowledgeBaseService] setVectorDbIds() failed:', err instanceof Error ? err.message : err);
      throw err;
    }
  },

  async initializeDefaults() {
    console.log('[KnowledgeBaseService] initializeDefaults() called');
    try {
      const existing = await strapi.db.query('api::knowledge-base.knowledge-base').findMany();
      console.log('[KnowledgeBaseService] initializeDefaults() found existing records:', existing.length);

      if (existing.length === 0) {
        console.log('[KnowledgeBaseService] initializeDefaults() creating default documents');
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
        console.log('[KnowledgeBaseService] initializeDefaults() defaults:', JSON.stringify(defaults));

        const created = await Promise.all(
          defaults.map((item, index) => {
            return this.create({ data: item });
          })
        );
        console.log('[KnowledgeBaseService] initializeDefaults() created successfully, count:', created.length);
        return created;
      } else {
        console.log('[KnowledgeBaseService] initializeDefaults() skipping - already exists');
        return existing;
      }
    } catch (err) {
      console.error('[KnowledgeBaseService] initializeDefaults() failed:', err instanceof Error ? err.message : err);
      throw err;
    }
  },

  async getPendingDocuments() {
    console.log('[KnowledgeBaseService] getPendingDocuments() called');
    try {
      const documents = await strapi.db.query('api::knowledge-base.knowledge-base').findMany({
        where: { status: 'pending' },
        orderBy: { priority: 'desc', createdAt: 'asc' },
      });
      console.log('[KnowledgeBaseService] getPendingDocuments() completed, count:', documents.length);
      return documents;
    } catch (err) {
      console.error('[KnowledgeBaseService] getPendingDocuments() failed:', err instanceof Error ? err.message : err);
      throw err;
    }
  },

  async deleteVectors(documentId: number) {
    console.log('[KnowledgeBaseService] deleteVectors() called, documentId:', documentId);
    try {
      await strapi.db.connection.raw(
        'DELETE FROM knowledge_embeddings WHERE "documentId" = ?',
        [documentId]
      );
      console.log('[KnowledgeBaseService] deleteVectors() completed');
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
