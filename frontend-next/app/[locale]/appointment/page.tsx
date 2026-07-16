import { buildMetadata, buildJsonLd, buildBreadcrumbSchema } from '@/lib/seo';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import ContactForm from '@/components/sections/ContactForm';
import type { Metadata } from 'next';

export const revalidate = 300;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  await params;
  const t = await getTranslations('appointment');
  return buildMetadata(undefined, {
    title: t('pageTitle'),
    description: t('pageDescription'),
    canonicalUrl: '/appointment',
  });
}

export default async function AppointmentPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('appointment');
  const tSeo = await getTranslations('seo');
  const tContactForm = await getTranslations('sections.contactForm');
  const breadcrumbSchema = buildBreadcrumbSchema(
    [
      { name: tSeo('home'), url: '/' },
      { name: tSeo('appointment'), url: '/appointment' },
    ],
    locale as 'zh-CN' | 'en-US'
  );
  return (
    <div className="pt-[120px] pb-16 min-h-screen bg-gradient-to-br from-[#FFF3E5] to-[#FFFCF8]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: buildJsonLd(breadcrumbSchema) }}
      />
      <div className="max-w-[1200px] mx-auto px-8">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#F5851F]/10 border border-[#F5851F]/20 text-[#F5851F] text-sm mb-6">
            📅 {t('badgeText')}
          </div>
          <h1
            className="text-[#1C2B3A] mb-4"
            style={{
              fontFamily: "'Nunito', 'Noto Sans SC', sans-serif",
              fontSize: 'clamp(2rem, 5vw, 3rem)',
              fontWeight: 800,
            }}
          >
            {t('pageTitle')}
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            {t('pageSubtitle')}
          </p>
        </div>
        <ContactForm section={{
          id: 0,
          __component: 'section.contact-form',
          title: tContactForm('titleFallback'),
          description: tContactForm('descriptionFallback'),
          submitText: tContactForm('submitTextFallback'),
        }} />
      </div>
    </div>
  );
}
