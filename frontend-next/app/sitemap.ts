import type { MetadataRoute } from 'next';
import { getProducts, getNews } from '@/lib/api';

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  const entries: MetadataRoute.Sitemap = [];

  // Static pages — output both zh-CN and en-US URLs with hreflang
  const staticPaths = ['', '/courses', '/news', '/campuses', '/teachers', '/faq', '/refund-policy', '/privacy-policy', '/user-agreement'];
  staticPaths.forEach((path) => {
    const zhUrl = `${baseUrl}${path}`;
    const enUrl = `${baseUrl}/en-US${path}`;
    entries.push({
      url: zhUrl,
      lastModified: new Date(),
      priority: path === '' ? 1.0 : 0.8,
      changeFrequency: 'daily',
      alternates: {
        languages: {
          'zh-CN': zhUrl,
          'en-US': enUrl,
        },
      },
    });
    entries.push({
      url: enUrl,
      lastModified: new Date(),
      priority: path === '' ? 0.9 : 0.7,
      alternates: {
        languages: {
          'zh-CN': zhUrl,
          'en-US': enUrl,
        },
      },
    });
  });

  // Dynamic pages (products, news) — same pattern
  const { data: products } = await getProducts().catch(() => ({ data: [] as never[] }));
  products.forEach((p) => {
    const zhUrl = `${baseUrl}/courses/${p.slug}`;
    const enUrl = `${baseUrl}/en-US/courses/${p.slug}`;
    [zhUrl, enUrl].forEach((url) => {
      entries.push({
        url,
        lastModified: p.updatedAt ? new Date(p.updatedAt) : new Date(),
        priority: 0.7,
        alternates: { languages: { 'zh-CN': zhUrl, 'en-US': enUrl } },
      });
    });
  });

  const { data: news } = await getNews().catch(() => ({ data: [] as never[] }));
  news.forEach((n) => {
    const zhUrl = `${baseUrl}/news/${n.slug}`;
    const enUrl = `${baseUrl}/en-US/news/${n.slug}`;
    [zhUrl, enUrl].forEach((url) => {
      entries.push({
        url,
        lastModified: n.publishedAt ? new Date(n.publishedAt) : new Date(),
        priority: 0.6,
        alternates: { languages: { 'zh-CN': zhUrl, 'en-US': enUrl } },
      });
    });
  });

  return entries;
}
