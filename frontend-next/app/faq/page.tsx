import { getFaqItems } from '@/lib/api';
import { buildMetadata, buildJsonLd } from '@/lib/seo';
import Faq from '@/components/sections/Faq';
import type { Metadata } from 'next';

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata(undefined, {
    title: '常见问题',
    description: '幼小衔接课程常见问题解答，帮助您了解入学流程、课程安排等。',
    canonicalUrl: '/faq',
  });
}

export default async function FaqPage() {
  const { data: faqItems } = await getFaqItems().catch(() => ({ data: [] as never[] }));

  // 构造 section 对象以复用 Faq 组件
  const section = {
    id: 0,
    __component: 'section.faq',
    title: '常见问题',
    faqs: { data: faqItems },
    showSearch: true,
  };

  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqItems.map((f) => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: f.answer,
      },
    })),
  };

  return (
    <div className="pt-[120px] min-h-screen" style={{ background: '#FAFAFA' }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: buildJsonLd(faqJsonLd) }}
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
          常见问题
        </h1>
        <p className="text-center text-[#6B7280] text-base sm:text-lg mt-4 mb-8">
          幼小衔接课程常见问题解答
        </p>
      </div>
      <Faq section={section} />
    </div>
  );
}
