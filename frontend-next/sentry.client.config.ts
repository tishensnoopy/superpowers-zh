import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  release: process.env.NEXT_PUBLIC_SENTRY_RELEASE,
  environment: process.env.NODE_ENV,
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 0.5,
  replaysSessionSampleRate: 0.01,
  replaysOnErrorSampleRate: 1.0,
  integrations: [
    Sentry.browserTracingIntegration(),
  ],
  ignoreErrors: [
    'ResizeObserver loop limit exceeded',
    'Navigation cancelled',
    'AbortError',
  ],
});

Sentry.lazyLoadIntegration('replayIntegration')
  .then((replayIntegration) => {
    Sentry.addIntegration(replayIntegration({
      maskAllText: true,
      blockAllMedia: true,
    }));
  })
  .catch(() => {
    // 动态加载失败时静默处理，错误捕获仍可用
  });
