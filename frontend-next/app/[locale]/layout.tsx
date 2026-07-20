import type { Metadata } from 'next';
import { Noto_Sans_SC, Nunito } from 'next/font/google';
import { setRequestLocale, getMessages, getTranslations } from 'next-intl/server';
import { NextIntlClientProvider } from 'next-intl';
import { getSiteSettings, getNavigationTree, getFooter, getImageUrl, type Locale } from '@/lib/api';
import { buildWebSiteSchema, buildOrganizationSchema, buildJsonLd } from '@/lib/seo';
import { buildSiteNavigationSchema } from '@/lib/geo';
import { buildThemeCss } from '@/lib/theme';
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
  const settingsRes = await getSiteSettings(locale as Locale);
  const settings = Array.isArray(settingsRes.data)
    ? settingsRes.data[0]
    : settingsRes.data;

  // 站长平台验证码
  const verification: Record<string, string> = {};
  if (settings?.googleVerification) verification.google = settings.googleVerification;
  if (settings?.bingVerification) verification.other = settings.bingVerification;

  // 默认 OG 分享图
  const defaultOgImageUrl = getImageUrl(settings?.defaultOgImage);

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
      images: defaultOgImageUrl ? [{ url: defaultOgImageUrl }] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      images: defaultOgImageUrl ? [defaultOgImageUrl] : undefined,
    },
    robots: { index: true, follow: true },
    verification: Object.keys(verification).length > 0 ? verification : undefined,
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

  // 后台「站点设置」品牌色 → 全站 CSS 变量（未配置时输出品牌默认色）
  const themeCss = buildThemeCss({
    primaryColor: settings?.primaryColor,
    darkColor: settings?.darkColor,
  });
  const faviconUrl = getImageUrl(settings?.favicon);

  // 站长平台验证码（Google/Bing/百度）：后台配置后自动注入 meta 标签
  const googleVerify = settings?.googleVerification;
  const bingVerify = settings?.bingVerification;
  const baiduVerify = settings?.baiduVerification;

  // 统计代码配置
  const ga4Id = settings?.analytics?.ga4Id;
  const baiduTongjiId = settings?.analytics?.baiduTongjiId;
  const fbPixelId = settings?.analytics?.facebookPixelId;

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

  // SiteNavigationElement：从导航树构建站点导航结构化数据
  const navItems: { name: string; url: string }[] = (navigation || [])
    .filter((item: any) => item?.name && item?.url)
    .map((item: any) => ({ name: item.name, url: item.url }));
  const navSchema = navItems.length > 0
    ? buildSiteNavigationSchema(navItems, locale as Locale)
    : null;

  return (
    <html
      lang={locale}
      className={`${notoSansSC.variable} ${nunito.variable}`}
      style={{ fontFamily }}
    >
      <head>
        <style data-theme-vars="" dangerouslySetInnerHTML={{ __html: themeCss }} />
        {faviconUrl && <link rel="icon" href={faviconUrl} />}
        {/* 站长平台验证码 */}
        {googleVerify && <meta name="google-site-verification" content={googleVerify} />}
        {bingVerify && <meta name="msvalidate.01" content={bingVerify} />}
        {baiduVerify && <meta name="baidu-site-verification" content={baiduVerify} />}
        {/* 统计代码：GA4 */}
        {ga4Id && (
          <>
            <script src={`https://www.googletagmanager.com/gtag/js?id=${ga4Id}`} async />
            <script dangerouslySetInnerHTML={{ __html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${ga4Id}');` }} />
          </>
        )}
        {/* 统计代码：百度统计 */}
        {baiduTongjiId && (
          <script dangerouslySetInnerHTML={{ __html: `var _hmt=_hmt||[];(function(){var hm=document.createElement('script');hm.src='https://hm.baidu.com/hm.js?${baiduTongjiId}';var s=document.getElementsByTagName('script')[0];s.parentNode.insertBefore(hm,s);})();` }} />
        )}
        {/* 统计代码：Facebook Pixel */}
        {fbPixelId && (
          <>
            <script dangerouslySetInnerHTML={{ __html: `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${fbPixelId}');fbq('track','PageView');` }} />
          </>
        )}
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
        {navSchema && (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: buildJsonLd(navSchema) }}
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
