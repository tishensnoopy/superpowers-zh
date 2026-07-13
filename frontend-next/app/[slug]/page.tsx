import { notFound } from 'next/navigation';
import { getPages, getPageBySlug } from '@/lib/api';
import { buildMetadata } from '@/lib/seo';
import SectionRenderer from '@/components/SectionRenderer';
import type { Metadata } from 'next';

export const revalidate = 300;

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const { data: pages } = await getPages();
  const staticSlugs = ['refund-policy', 'privacy-policy', 'user-agreement', 'contact'];
  return pages
    .filter((page) => !page.isHomepage && !staticSlugs.includes(page.slug))
    .map((page) => ({ slug: page.slug }));
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const { data: page } = await getPageBySlug(slug).catch(() => ({
    data: null,
  }));
  if (!page) {
    return buildMetadata(undefined, { title: '页面' });
  }
  return buildMetadata(page.seo, { title: page.title });
}

export default async function DynamicPage({ params }: PageProps) {
  const { slug } = await params;
  const { data: page } = await getPageBySlug(slug).catch(() => ({
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
