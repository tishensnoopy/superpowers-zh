import { NextRequest } from 'next/server';
import { getSiteSettings, getProducts, getTeachers, getCampuses, getNews, getFaqItems } from '@/lib/api';
import { buildLlmsTxtContent } from '@/lib/geo';
import type { Locale } from '@/lib/api';

export const revalidate = 3600;

const SUPPORTED_LOCALES: Locale[] = ['zh-CN', 'en-US'];

function parseLocale(searchParams: URLSearchParams): Locale {
  const raw = searchParams.get('locale');
  if (raw && SUPPORTED_LOCALES.includes(raw as Locale)) {
    return raw as Locale;
  }
  return 'zh-CN';
}

export async function GET(request: NextRequest) {
  const locale = parseLocale(request.nextUrl.searchParams);

  const [settingsRes, productsRes, teachersRes, campusesRes, newsRes, faqRes] = await Promise.all([
    getSiteSettings(locale).catch(() => ({ data: [] as never[] })),
    getProducts(locale).catch(() => ({ data: [] as never[] })),
    getTeachers(locale).catch(() => ({ data: [] as never[] })),
    getCampuses(locale).catch(() => ({ data: [] as never[] })),
    getNews(locale).catch(() => ({ data: [] as never[] })),
    getFaqItems(locale).catch(() => ({ data: [] as never[] })),
  ]);

  const settings = Array.isArray(settingsRes.data) ? settingsRes.data[0] : settingsRes.data;
  const content = buildLlmsTxtContent(
    settings || { name: '佑森小课堂' },
    productsRes.data,
    teachersRes.data,
    campusesRes.data,
    newsRes.data,
    faqRes.data,
    locale
  );

  return new Response(content, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 's-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
