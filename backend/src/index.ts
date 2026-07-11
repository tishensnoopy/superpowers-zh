import type { Core } from '@strapi/strapi';

export default {
  async bootstrap({ strapi }: { strapi: Core.Strapi }) {
    console.log('[Bootstrap] Starting up...');

    if (process.env.REDIS_HOST) {
      try {
        const { registerQueues } = await import('./utils/queue');
        await registerQueues(strapi);
        console.log('[Bootstrap] Queues registered');
      } catch (err) {
        console.warn('[Bootstrap] Queue registration failed:', err instanceof Error ? err.message : err);
      }
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
