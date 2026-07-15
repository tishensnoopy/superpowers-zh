import { getFaqItems, type Locale } from '@/lib/api';
import { buildMetadata, buildJsonLd, buildFaqPageSchema, buildBreadcrumbSchema } from '@/lib/seo';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { useTranslations } from 'next-intl';
import Faq from '@/components/sections/Faq';
import type { Metadata } from 'next';

export const revalidate = 300;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations('faq');
  return buildMetadata(undefined, {
    title: t('title'),
    description: t('description'),
    canonicalUrl: '/faq',
  }, { locale: locale as 'zh-CN' | 'en-US', path: '/faq' });
}

export default async function FaqPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = useTranslations('faq');
  const tSeo = useTranslations('seo');
  const { data: faqItems } = await getFaqItems(locale as Locale).catch(() => ({ data: [] as never[] }));

  // 构造 section 对象以复用 Faq 组件
  const section = {
    id: 0,
    __component: 'section.faq',
    title: t('title'),
    faqs: { data: faqItems },
    showSearch: true,
  };

  const faqJsonLd = buildFaqPageSchema(faqItems);
  const breadcrumbSchema = buildBreadcrumbSchema(
    [
      { name: tSeo('home'), url: '/' },
      { name: tSeo('faq'), url: '/faq' },
    ],
    locale as Locale
  );

  return (
    <div className="pt-[120px] min-h-screen" style={{ background: '#FAFAFA' }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: buildJsonLd(faqJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: buildJsonLd(breadcrumbSchema) }}
      />
      <div className="max-w-[1400px] mx-auto px-8 pt-16">
        <h1
          className="text-[#1C2B3A] text-center"
          style={{
            fontFamily: "'Nunito', 'Noto Sans SC', sans-serif",
            fontSize: 'clamp(2rem, 5vw, 3rem)',
            fontWeight: 800,
          }}
        >
          {t('title')}
        </h1>
        <p className="text-center text-[#6B7280] text-base sm:text-lg mt-4 mb-8">
          {t('subtitle')}
        </p>
      </div>
      <Faq section={section} />
    </div>
  );
}
