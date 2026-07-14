import type { Metadata } from 'next';
import { Noto_Sans_SC, Nunito } from 'next/font/google';
import { setRequestLocale, getMessages } from 'next-intl/server';
import { NextIntlClientProvider } from 'next-intl';
import { getSiteSettings, getNavigationTree, getFooter, getImageUrl, type Locale } from '@/lib/api';
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
  return {
    title: {
      default:
        locale === 'en-US'
          ? 'Yousen Education | Preschool-Primary Transition'
          : '佑森小课堂 | 专注幼小衔接教育8年',
      template:
        locale === 'en-US' ? '%s | Yousen Education' : '%s | 佑森小课堂',
    },
    description:
      locale === 'en-US'
        ? '8 years of preschool-primary transition education with scientific curriculum and professional teachers'
        : '专注幼小衔接教育8年，科学课程体系+专业师资团队',
    metadataBase: new URL(
      process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
    ),
    openGraph: {
      type: 'website',
      locale: locale === 'en-US' ? 'en_US' : 'zh_CN',
      siteName: locale === 'en-US' ? 'Yousen Education' : '佑森小课堂',
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
  const cmsParsedUrl = new URL(cmsUrl);

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
        <link rel="dns-prefetch" href={`//${cmsParsedUrl.host}`} />
        <link rel="preconnect" href={cmsUrl} crossOrigin="anonymous" />
      </head>
      <body>
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
