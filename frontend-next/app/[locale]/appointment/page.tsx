import { buildMetadata, buildJsonLd, buildBreadcrumbSchema } from '@/lib/seo';
import { setRequestLocale } from 'next-intl/server';
import ContactForm from '@/components/sections/ContactForm';
import type { Metadata } from 'next';

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata(undefined, {
    title: '预约免费试听',
    description: '预约佑森小课堂免费试听课程，填写表单后我们将在 24 小时内联系您。',
    canonicalUrl: '/appointment',
  });
}

export default async function AppointmentPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const breadcrumbSchema = buildBreadcrumbSchema(
    [
      { name: locale === 'en-US' ? 'Home' : '首页', url: '/' },
      { name: locale === 'en-US' ? 'Appointment' : '预约试听', url: '/appointment' },
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
            📅 预约试听
          </div>
          <h1
            className="text-[#1C2B3A] mb-4"
            style={{
              fontFamily: "'Nunito', 'Noto Sans SC', sans-serif",
              fontSize: 'clamp(2rem, 5vw, 3rem)',
              fontWeight: 800,
            }}
          >
            预约免费试听
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            填写下方表单预约免费试听课程，我们将在 24 小时内与您联系确认时间。
          </p>
        </div>
        <ContactForm section={{
          id: 0,
          __component: 'section.contact-form',
          title: '预约免费试听',
          description: '填写下方表单，我们将尽快联系您',
          submitText: '立即预约',
        }} />
      </div>
    </div>
  );
}
