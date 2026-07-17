import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['zh-CN', 'en-US'],
  defaultLocale: 'zh-CN',
  localePrefix: 'as-needed',
  // Disable locale cookie: middleware set-cookie downgrades every response to
  // cache-control: private, which kills ISR for all pages (R3). Language is
  // determined purely by URL prefix instead — links must use the localized
  // Link from @/i18n/navigation so the /en-US prefix is preserved.
  localeCookie: false,
  // Disable Accept-Language auto-redirect: with localePrefix 'as-needed',
  // detecting en-US browsers on / would 307 them to /en-US, breaking SSG/ISR
  // canonical URLs and confusing search engine crawlers (R3).
  localeDetection: false,
});

export type Locale = (typeof routing.locales)[number];
