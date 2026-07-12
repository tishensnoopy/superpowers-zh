import { notFound } from 'next/navigation';
import { getPageBySlug } from '@/lib/api';
import { buildMetadata } from '@/lib/seo';
import SectionRenderer from '@/components/SectionRenderer';
import type { Metadata } from 'next';

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const { data: page } = await getPageBySlug('user-agreement').catch(() => ({
    data: null,
  }));
  if (!page) {
    return buildMetadata(undefined, { title: '用户协议' });
  }
  return buildMetadata(page.seo, { title: page.title });
}

export default async function UserAgreementPage() {
  const { data: page } = await getPageBySlug('user-agreement').catch(() => ({
    data: null,
  }));

  if (!page) {
    notFound();
  }

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
