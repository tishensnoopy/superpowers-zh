import type { Core } from '@strapi/strapi';

export default {
  async bootstrap({ strapi }: { strapi: Core.Strapi }) {
    console.log('[Bootstrap] Starting up...');

    if (process.env.REDIS_HOST) {
      try {
        const { registerQueues, createWorker } = await import('./utils/queue');
        await registerQueues(strapi);
        console.log('[Bootstrap] Queues registered');

        const { setStrapi: setDocumentStrapi, processDocument } = await import('./workers/document-processor');
        setDocumentStrapi(strapi);
        createWorker('document-processing', processDocument, { concurrency: 2 });
        console.log('[Bootstrap] Document processor worker registered');

        const { setStrapi: setFaqStrapi, processFaqFeedback } = await import('./workers/faq-feedback');
        setFaqStrapi(strapi);
        createWorker('faq-feedback', processFaqFeedback, { concurrency: 1 });
        console.log('[Bootstrap] FAQ feedback worker registered');
      } catch (err) {
        console.warn('[Bootstrap] Queue registration failed:', err instanceof Error ? err.message : err);
      }
    }

    console.log('[Bootstrap] Initializing default global data...');
    try {
      const siteSettingsService = strapi.service('api::site-settings.site-settings');
      await siteSettingsService.initializeDefaults();
      console.log('[Bootstrap] Site Settings initialized');

      const navigationService = strapi.service('api::navigation.navigation');
      await navigationService.initializeDefaults();
      console.log('[Bootstrap] Navigation initialized');

      const footerService = strapi.service('api::footer.footer');
      await footerService.initializeDefaults();
      console.log('[Bootstrap] Footer initialized');

      const pageService = strapi.service('api::page.page');
      await pageService.initializeDefaults();
      console.log('[Bootstrap] Pages initialized');
    } catch (err) {
      console.warn('[Bootstrap] Default data initialization failed:', err instanceof Error ? err.message : err);
    }

    console.log('[Bootstrap] Startup complete');
  },

  async destroy({ strapi }: { strapi: Core.Strapi }) {
    console.log('[Destroy] Shutting down...');

    try {
      const { closeAllQueues } = await import('./utils/queue');
      await closeAllQueues();
      console.log('[Destroy] Queues closed');
    } catch (err) {
      console.warn('[Destroy] Queue cleanup failed:', err instanceof Error ? err.message : err);
    }
  },
};
