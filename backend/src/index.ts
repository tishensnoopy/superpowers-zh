import type { Core } from '@strapi/strapi';

export default {
  async register({ strapi }: { strapi: Core.Strapi }) {
    console.log('[Register] Registering lifecycle hooks...');

    const { reconcileContent, SYNCED_UIDS } = await import('./services/knowledge-sync-service');

    for (const uid of SYNCED_UIDS) {
      try {
        // afterCreate/afterUpdate/afterDelete 统一走 reconcile：
        // Strapi v5 无 afterPublish/afterUnpublish 事件，发布/取消发布/删除都经这三个钩子，
        // reconcileContent 以"当前是否存在 published 版本"为唯一事实来源，事件载荷不可信。
        const handler = async (event: any) => {
          const record = event?.result;
          if (!record?.documentId) return;
          await reconcileContent(strapi, uid, {
            documentId: record.documentId,
            locale: record.locale,
          });
          console.log(`[Lifecycle] Reconciled ${uid} (${record.documentId}, ${record.locale ?? 'zh-CN'})`);
        };
        strapi.db.lifecycles.subscribe({
          models: [uid],
          afterCreate: handler,
          afterUpdate: handler,
          afterDelete: handler,
        });
      } catch (err) {
        console.warn(`[Register] Failed to subscribe lifecycle for ${uid}:`, err);
      }
    }

    console.log('[Register] Lifecycle hooks registered');
  },

  async bootstrap({ strapi }: { strapi: Core.Strapi }) {
    console.log('[Bootstrap] Starting up...');

    // 注入 strapi 到 llm-service 和 rag-service（生产环境必须）
    try {
      const { setStrapi: setLlmStrapi } = await import('./services/llm-service');
      setLlmStrapi(strapi);
      console.log('[Bootstrap] strapi injected into llm-service');

      const { setStrapi: setRagStrapi } = await import('./services/rag-service');
      setRagStrapi(strapi);
      console.log('[Bootstrap] strapi injected into rag-service');
    } catch (err) {
      console.warn('[Bootstrap] Failed to inject strapi into services:', err);
    }

    if (process.env.REDIS_HOST) {
      try {
        const { registerQueues, createWorker } = await import('./utils/queue');
        await registerQueues(strapi);
        console.log('[Bootstrap] Queues registered');

        // Real document vectorization worker (BullMQ queue -> text extraction ->
        // cleaning -> chunking -> embedding -> pgvector). Replaces the stub worker.
        // Guarded so tests don't spin up a Redis worker.
        if (process.env.NODE_ENV !== 'test') {
          const { startDocumentWorker } = await import('./queues/document-processor');
          const documentWorker = startDocumentWorker(strapi);
          if (documentWorker) {
            console.log('[Bootstrap] Document processor worker registered');
          } else {
            console.log('[Bootstrap] Document processor worker skipped - Redis not available');
          }
        }

        const { setStrapi: setFaqStrapi, processFaqFeedback } = await import('./workers/faq-feedback');
        setFaqStrapi(strapi);
        const faqWorker = createWorker('faq-feedback', processFaqFeedback, { concurrency: 1 });
        if (faqWorker) {
          console.log('[Bootstrap] FAQ feedback worker registered');
        } else {
          console.log('[Bootstrap] FAQ feedback worker skipped - Redis not available');
        }
      } catch (err) {
        console.warn('[Bootstrap] Queue registration failed:', err instanceof Error ? err.message : err);
      }
    } else {
      console.log('[Bootstrap] Queue system disabled - REDIS_HOST not set');
    }

    console.log('[Bootstrap] Initializing default global data...');
    try {
      const siteSettingsService = strapi.service('api::site-settings.site-settings');
      await siteSettingsService.initializeDefaults();
      console.log('[Bootstrap] Site Settings initialized');
    } catch (err) {
      console.warn('[Bootstrap] Site Settings initialization failed:', err instanceof Error ? err.message : err);
    }

    try {
      const navigationService = strapi.service('api::navigation.navigation');
      await navigationService.initializeDefaults();
      console.log('[Bootstrap] Navigation initialized');
    } catch (err) {
      console.warn('[Bootstrap] Navigation initialization failed:', err instanceof Error ? err.message : err);
    }

    try {
      const footerService = strapi.service('api::footer.footer');
      await footerService.initializeDefaults();
      console.log('[Bootstrap] Footer initialized');
    } catch (err) {
      console.warn('[Bootstrap] Footer initialization failed:', err instanceof Error ? err.message : err);
    }

    try {
      const pageService = strapi.service('api::page.page');
      await pageService.initializeDefaults();
      console.log('[Bootstrap] Pages initialized');
    } catch (err) {
      console.warn('[Bootstrap] Pages initialization failed:', err instanceof Error ? err.message : err);
    }

    try {
      const productCategoryService = strapi.service('api::product-category.product-category');
      await productCategoryService.initializeDefaults();
      console.log('[Bootstrap] Product Categories initialized');
    } catch (err) {
      console.warn('[Bootstrap] Product Categories initialization failed:', err instanceof Error ? err.message : err);
    }

    try {
      const productSpecService = strapi.service('api::product-spec.product-spec');
      await productSpecService.initializeDefaults();
      console.log('[Bootstrap] Product Specs initialized');
    } catch (err) {
      console.warn('[Bootstrap] Product Specs initialization failed:', err instanceof Error ? err.message : err);
    }

    try {
      const productService = strapi.service('api::product.product');
      await productService.initializeDefaults();
      console.log('[Bootstrap] Products initialized');
    } catch (err) {
      console.warn('[Bootstrap] Products initialization failed:', err instanceof Error ? err.message : err);
    }

    try {
      const knowledgeBaseService = strapi.service('api::knowledge-base.knowledge-base');
      await knowledgeBaseService.initializeDefaults();
      console.log('[Bootstrap] Knowledge Base initialized');
    } catch (err) {
      console.warn('[Bootstrap] Knowledge Base initialization failed:', err instanceof Error ? err.message : err);
    }

    try {
      const faqItemService = strapi.service('api::faq-item.faq-item');
      await faqItemService.initializeDefaults();
      console.log('[Bootstrap] FAQ Items initialized');
    } catch (err) {
      console.warn('[Bootstrap] FAQ Items initialization failed:', err instanceof Error ? err.message : err);
    }

    console.log('[Bootstrap] Initializing RBAC roles...');
    try {
      const rbacService = await import('./services/rbac');
      await rbacService.default({ strapi }).initializeRoles();
      console.log('[Bootstrap] RBAC roles initialized');
    } catch (err) {
      console.warn('[Bootstrap] RBAC initialization failed:', err instanceof Error ? err.message : err);
    }

    console.log('[Bootstrap] Startup complete');
  },

  async destroy({ strapi }: { strapi: Core.Strapi }) {
    console.log('[Destroy] Shutting down...');

    // 关闭文档向量化 Worker（独立于 utils/queue 的 workers 字典管理）
    try {
      const { closeDocumentWorker } = await import('./queues/document-processor');
      await closeDocumentWorker();
    } catch (err) {
      console.warn('[Destroy] Document worker cleanup failed:', err instanceof Error ? err.message : err);
    }

    try {
      const { closeAllQueues } = await import('./utils/queue');
      await closeAllQueues();
      console.log('[Destroy] Queues closed');
    } catch (err) {
      console.warn('[Destroy] Queue cleanup failed:', err instanceof Error ? err.message : err);
    }
  },
};
