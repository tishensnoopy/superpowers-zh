import { NextRequest } from 'next/server';
import { getSiteSettings, getProducts, getTeachers, getCampuses, getNews, getFaqItems } from '@/lib/api';
import { buildLlmsTxtContent } from '@/lib/geo';
import type { Locale } from '@/lib/api';

// force-dynamic 确保查询参数 (?locale=en-US) 每次都被正确处理。
// ISR 的 revalidate 会以 URL 路径为缓存键（不含查询参数），
// 导致 ?locale=en-US 返回缓存的 zh-CN 版本。
// 改用 CDN 层面的 Cache-Control 实现缓存。
export const dynamic = 'force-dynamic';

const SUPPORTED_LOCALES: Locale[] = ['zh-CN', 'en-US'];

function parseLocale(searchParams: URLSearchParams): Locale {
  const raw = searchParams.get('locale');
  if (raw && SUPPORTED_LOCALES.includes(raw as Locale)) {
    return raw as Locale;
  }
  return 'zh-CN';
}

export async function GET(request: NextRequest) {
  // 用 new URL(request.url) 而非 request.nextUrl.searchParams，
  // dev 模式下 nextUrl.searchParams 可能不包含查询参数
  const url = new URL(request.url);
  const locale = parseLocale(url.searchParams);
  console.log('[llms.txt] url:', request.url, 'locale:', locale);

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
