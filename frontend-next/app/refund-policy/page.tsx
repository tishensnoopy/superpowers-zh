import { getPageBySlug } from '@/lib/api';
import { buildMetadata } from '@/lib/seo';
import SectionRenderer from '@/components/SectionRenderer';
import type { Metadata } from 'next';

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const { data: page } = await getPageBySlug('refund-policy').catch(() => ({
    data: null,
  }));
  if (!page) {
    return buildMetadata(undefined, { title: '退费政策' });
  }
  return buildMetadata(page.seo, { title: page.title });
}

export default async function RefundPolicyPage() {
  const { data: page } = await getPageBySlug('refund-policy');
  const sections = page.sections || [];

  return (
    <>
      {sections.map((section, index) => (
        <SectionRenderer
          key={`${section.__component}-${section.id}-${index}`}
          section={section}
        />
      ))}
    </>
  );
}
