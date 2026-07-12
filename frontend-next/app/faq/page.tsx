import { getFaqItems } from '@/lib/api';
import { buildMetadata, buildJsonLd } from '@/lib/seo';
import Faq from '@/components/sections/Faq';
import type { Metadata } from 'next';

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata(undefined, {
    title: '常见问题',
    description: '幼小衔接课程常见问题解答，帮助您了解入学流程、课程安排等。',
  });
}

export default async function FaqPage() {
  const { data: faqItems } = await getFaqItems();

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
    <div className="pt-[72px] min-h-screen" style={{ background: '#FAFAFA' }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: buildJsonLd(faqJsonLd) }}
      />
      <Faq section={section} />
    </div>
  );
}
