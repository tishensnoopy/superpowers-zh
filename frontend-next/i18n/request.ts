import { getRequestConfig } from 'next-intl/server';
import { routing } from './routing';

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;

  // Ensure locale is one of our supported locales
  if (!locale || !routing.locales.includes(locale as any)) {
    locale = routing.defaultLocale;
  }

  return {
    locale,
    messages: (await import(`./messages/${locale}.json`)).default,
    onError(error: Error) {
      if (process.env.NODE_ENV === 'production') {
        console.error('[i18n]', error.message);
      } else {
        throw error;
      }
    },
    getMessageFallback({ key }: { key: string }) {
      return key;
    },
  };
});
