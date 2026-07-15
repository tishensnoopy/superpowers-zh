import { getSiteSettings, getProducts, getTeachers, getCampuses, getNews, getFaqItems } from '@/lib/api';
import { buildLlmsTxtContent } from '@/lib/geo';

export const revalidate = 3600;

export async function GET() {
  const [settingsRes, productsRes, teachersRes, campusesRes, newsRes, faqRes] = await Promise.all([
    getSiteSettings().catch(() => ({ data: [] as never[] })),
    getProducts().catch(() => ({ data: [] as never[] })),
    getTeachers().catch(() => ({ data: [] as never[] })),
    getCampuses().catch(() => ({ data: [] as never[] })),
    getNews().catch(() => ({ data: [] as never[] })),
    getFaqItems().catch(() => ({ data: [] as never[] })),
  ]);

  const settings = Array.isArray(settingsRes.data) ? settingsRes.data[0] : settingsRes.data;
  const content = buildLlmsTxtContent(
    settings || { name: '佑森小课堂' },
    productsRes.data,
    teachersRes.data,
    campusesRes.data,
    newsRes.data,
    faqRes.data,
    'zh-CN'
  );

  return new Response(content, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 's-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
