import type { MetadataRoute } from 'next';
import { getProducts, getNews } from '@/lib/api';

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  const entries: MetadataRoute.Sitemap = [
    { url: baseUrl, lastModified: new Date(), priority: 1.0, changeFrequency: 'daily' },
    { url: `${baseUrl}/courses`, lastModified: new Date(), priority: 0.9 },
    { url: `${baseUrl}/news`, lastModified: new Date(), priority: 0.8 },
    { url: `${baseUrl}/campuses`, lastModified: new Date(), priority: 0.8 },
    { url: `${baseUrl}/teachers`, lastModified: new Date(), priority: 0.7 },
    { url: `${baseUrl}/faq`, lastModified: new Date(), priority: 0.6 },
  ];

  const { data: products } = await getProducts().catch(() => ({ data: [] as never[] }));
  products.forEach((p) => {
    entries.push({
      url: `${baseUrl}/courses/${p.slug}`,
      lastModified: p.updatedAt ? new Date(p.updatedAt) : new Date(),
      priority: 0.7,
    });
  });

  const { data: news } = await getNews().catch(() => ({ data: [] as never[] }));
  news.forEach((n) => {
    entries.push({
      url: `${baseUrl}/news/${n.slug}`,
      lastModified: n.publishedAt ? new Date(n.publishedAt) : new Date(),
      priority: 0.6,
    });
  });

  ['/refund-policy', '/privacy-policy', '/user-agreement'].forEach((path) => {
    entries.push({ url: `${baseUrl}${path}`, priority: 0.3 });
  });

  return entries;
}
