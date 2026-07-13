import type { Metadata } from 'next';
import { Noto_Sans_SC } from 'next/font/google';
import { getSiteSettings, getNavigationTree, getFooter, getImageUrl } from '@/lib/api';
import LayoutShell from '@/components/layout/LayoutShell';
import Navigation from '@/components/layout/Navigation';
import Footer from '@/components/layout/Footer';
import './globals.css';

export const revalidate = 300;

const notoSansSC = Noto_Sans_SC({
  weight: ['400', '500', '700'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-default',
  preload: true,
});

export const metadata: Metadata = {
  title: {
    default: '佑森小课堂 | 专注幼小衔接教育8年',
    template: '%s | 佑森小课堂',
  },
  description: '专注幼小衔接教育8年，科学课程体系+专业师资团队',
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
  openGraph: {
    type: 'website',
    locale: 'zh_CN',
    siteName: '佑森小课堂',
  },
  robots: { index: true, follow: true },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [settingsRes, navRes, footerRes] = await Promise.all([
    getSiteSettings(),
    getNavigationTree(),
    getFooter(),
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

  const fontFaceCSS =
    customFontUrl && customFontFamily
      ? `@font-face {
        font-family: '${customFontFamily}';
        src: url('${customFontUrl}') format('${customFontFormat}');
        font-weight: ${customFontWeight};
        font-display: ${customFontDisplay};
      }`
      : '';

  const fontFamily = customFontFamily
    ? `'${customFontFamily}', var(--font-default), sans-serif`
    : `var(--font-default), sans-serif`;

  const cmsUrl = process.env.NEXT_PUBLIC_STRAPI_API_URL || 'http://localhost:1337';
  const cmsParsedUrl = new URL(cmsUrl);

  return (
    <html
      lang="zh-CN"
      className={notoSansSC.variable}
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
        <LayoutShell>
          <Navigation navigation={navigation} settings={settings} />
          <main className="flex-1">{children}</main>
          <Footer footer={footer} settings={settings} />
        </LayoutShell>
      </body>
    </html>
  );
}
