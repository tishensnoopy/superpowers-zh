import type { Metadata } from 'next';
import { Noto_Sans_SC, Nunito } from 'next/font/google';
import { setRequestLocale, getMessages, getTranslations } from 'next-intl/server';
import { NextIntlClientProvider } from 'next-intl';
import { getSiteSettings, getNavigationTree, getFooter, getImageUrl, type Locale } from '@/lib/api';
import { buildWebSiteSchema, buildOrganizationSchema, buildJsonLd } from '@/lib/seo';
import { routing } from '@/i18n/routing';
import LayoutShell from '@/components/layout/LayoutShell';
import Navigation from '@/components/layout/Navigation';
import Footer from '@/components/layout/Footer';
import FloatingChat from '@/components/chat/FloatingChat';
import '../globals.css';

export const revalidate = 300;

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

const notoSansSC = Noto_Sans_SC({
  weight: ['400', '500', '700'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-default',
  preload: true,
});

const nunito = Nunito({
  weight: ['400', '600', '700', '800'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-nunito',
  preload: true,
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations('seo');
  return {
    title: {
      default:
        locale === 'en-US'
          ? t('defaultTitleEn')
          : t('defaultTitleZh'),
      template:
        locale === 'en-US' ? t('titleTemplateEn') : t('titleTemplateZh'),
    },
    description:
      locale === 'en-US'
        ? t('defaultDescriptionEn')
        : t('defaultDescriptionZh'),
    metadataBase: new URL(
      process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
    ),
    openGraph: {
      type: 'website',
      locale: locale === 'en-US' ? 'en_US' : 'zh_CN',
      siteName: locale === 'en-US' ? t('siteNameEn') : t('siteNameZh'),
    },
    robots: { index: true, follow: true },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [settingsRes, navRes, footerRes, messages] = await Promise.all([
    getSiteSettings(locale as Locale),
    getNavigationTree(locale as Locale),
    getFooter(locale as Locale),
    getMessages(),
  ]);

  const settings = Array.isArray(settingsRes.data)
    ? settingsRes.data[0]
    : settingsRes.data;
  const navigation = navRes.data;
  const footer = Array.isArray(footerRes.data)
    ? footerRes.data[0]
    : footerRes.data;

  const fontSettings = settings?.fontSettings;
  const customFontFamily = fontSettings?.fontFamily;
  const customFontUrl = fontSettings?.fontFile?.url
    ? getImageUrl(fontSettings.fontFile)
    : null;
  const customFontFormat = fontSettings?.fontFormat || 'woff2';
  const customFontWeight = fontSettings?.fontWeight || '400';
  const customFontDisplay = fontSettings?.fontDisplay || 'swap';

  const isSafeUrl = (url: string) => /^https?:\/\/[^\s]+$/.test(url);
  const safeFontFamily = /^[\w\s-]{1,64}$/.test(customFontFamily || '')
    ? customFontFamily
    : null;
  const safeFontUrl = isSafeUrl(customFontUrl || '') ? customFontUrl : null;
  const safeFontFormat = ['woff2', 'ttf', 'otf', 'woff'].includes(
    customFontFormat || ''
  )
    ? customFontFormat
    : null;
  const safeFontDisplay = ['swap', 'block', 'fallback', 'optional'].includes(
    customFontDisplay || ''
  )
    ? customFontDisplay
    : 'swap';

  const fontFaceCSS =
    safeFontUrl && safeFontFamily
      ? `@font-face {
        font-family: '${safeFontFamily}';
        src: url('${safeFontUrl}') format('${safeFontFormat || 'woff2'}');
        font-weight: ${customFontWeight};
        font-display: ${safeFontDisplay};
      }`
      : '';

  const fontFamily = safeFontFamily
    ? `'${safeFontFamily}', var(--font-nunito), var(--font-default), sans-serif`
    : `var(--font-nunito), var(--font-default), sans-serif`;

  const cmsUrl =
    process.env.NEXT_PUBLIC_STRAPI_API_URL || 'http://localhost:1337';
  // 相对路径（如 /api/strapi）走 Next.js rewrites 同源代理，无需 dns-prefetch / preconnect
  const isRelativeCmsUrl = cmsUrl.startsWith('/');
  const cmsParsedUrl = isRelativeCmsUrl ? null : new URL(cmsUrl);

  const websiteSchema = settings
    ? buildWebSiteSchema(settings, locale as Locale)
    : null;
  const orgSchema = settings
    ? buildOrganizationSchema(
        settings,
        footer?.socialLinks || [],
        locale as Locale
      )
    : null;

  return (
    <html
      lang={locale}
      className={`${notoSansSC.variable} ${nunito.variable}`}
      style={{ fontFamily }}
    >
      <head>
        {fontFaceCSS && (
          <style dangerouslySetInnerHTML={{ __html: fontFaceCSS }} />
        )}
        {cmsParsedUrl && (
          <>
            <link rel="dns-prefetch" href={`//${cmsParsedUrl.host}`} />
            <link rel="preconnect" href={cmsUrl} crossOrigin="anonymous" />
          </>
        )}
      </head>
      <body>
        {websiteSchema && (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: buildJsonLd(websiteSchema) }}
          />
        )}
        {orgSchema && (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: buildJsonLd(orgSchema) }}
          />
        )}
        <NextIntlClientProvider locale={locale} messages={messages}>
          <LayoutShell>
            <Navigation navigation={navigation} settings={settings} />
            <main className="flex-1">{children}</main>
            <Footer footer={footer} settings={settings} />
          </LayoutShell>
          <FloatingChat locale={locale as Locale} />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
