// Sentry 可选：仅在配置了 DSN 时上报
const captureException = (error: unknown, context?: Record<string, unknown>) => {
  if (typeof window === 'undefined' || process.env.NEXT_PUBLIC_SENTRY_DSN) {
    import('@sentry/nextjs').then((Sentry) => Sentry.captureException(error, context));
  }
};

export type Locale = 'zh-CN' | 'en-US';

const DEFAULT_API_URL = 'http://localhost:1337';

export function getApiBaseUrl(opts: {
  isServer: boolean;
  serverUrl?: string;
  clientUrl?: string;
}): string {
  if (opts.isServer && opts.serverUrl) {
    return opts.serverUrl;
  }
  return opts.clientUrl || DEFAULT_API_URL;
}

const API_BASE_URL = getApiBaseUrl({
  isServer: typeof window === 'undefined',
  serverUrl: process.env.STRAPI_API_URL_SSR,
  clientUrl: process.env.NEXT_PUBLIC_STRAPI_API_URL,
});

const LOG_PREFIX = '[API]';

// 生产环境静默调试日志（避免控制台噪音），错误仍通过 console.error/Sentry 上报
const isDev = process.env.NODE_ENV !== 'production';
const log = (...args: unknown[]) => { if (isDev) console.log(...args); };
const warn = (...args: unknown[]) => { if (isDev) console.warn(...args); };

function logRequest(path: string, options: RequestInit = {}) {
  const method = options.method || 'GET';
  const hasBody = options.body ? ` (body: ${options.body.toString().length} chars)` : '';
  log(`${LOG_PREFIX} ${method} ${path}${hasBody}`);
}

function logResponse(path: string, status: number, duration: number, contentLength?: string | null) {
  const sizeStr = contentLength ? `, size=${contentLength} bytes` : '';
  log(`${LOG_PREFIX} Response ${path}: status=${status}, duration=${duration}ms${sizeStr}`);
}

function logError(path: string, error: Error, duration?: number) {
  const durationStr = duration ? ` after ${duration}ms` : '';
  console.error(`${LOG_PREFIX} ERROR ${path}${durationStr}:`, error.message);
}

export async function fetchApi<T>(path: string, options: RequestInit = {}): Promise<T> {
  const startTime = performance.now();
  logRequest(path, options);

  try {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });

    const duration = Math.round(performance.now() - startTime);

    if (!res.ok) {
      const errorText = await res.text().catch(() => '');
      const error = new Error(`API request failed: ${res.status} ${res.statusText}${errorText ? ' - ' + errorText : ''}`);
      logError(path, error, duration);
      if (res.status >= 500) {
        const isSensitiveEndpoint = path.includes('/appointments') || path.includes('/feedback');
        captureException(error, {
          tags: { api: path, status: res.status.toString() },
          extra: {
            method: options.method || 'GET',
            duration,
            ...(isSensitiveEndpoint ? {} : { responseBody: errorText.substring(0, 500) }),
          },
        });
      }
      throw error;
    }

    const data = await res.json();
    logResponse(path, res.status, duration, res.headers.get('content-length'));
    return data;
  } catch (err) {
    const duration = Math.round(performance.now() - startTime);
    if (err instanceof Error) {
      logError(path, err, duration);
    } else {
      logError(path, new Error(String(err)), duration);
    }
    if (!(err instanceof Error && err.message.includes('API request failed'))) {
      captureException(err, {
        tags: { api: path, type: 'network-error' },
      });
    }
    throw err;
  }
}

export function getImageUrl(
  image?: { url: string; alternativeText?: string } | null
): string | null {
  if (!image?.url) return null;
  if (image.url.startsWith('http')) return image.url;
  const clientUrl = process.env.NEXT_PUBLIC_STRAPI_API_URL || DEFAULT_API_URL;
  return `${clientUrl}${image.url}`;
}

export async function getSiteSettings(locale: Locale = 'zh-CN') {
  return fetchApi<{ data: SiteSettings[] }>(`/api/site-settings?locale=${locale}`);
}

export async function getNavigation() {
  return fetchApi<{ data: NavigationItem[] }>('/api/navigation');
}

export async function getNavigationTree(locale: Locale = 'zh-CN') {
  return fetchApi<{ data: NavigationItem[] }>(`/api/navigation/tree?locale=${locale}`);
}

export async function getFooter(locale: Locale = 'zh-CN') {
  return fetchApi<{ data: Footer[] }>(`/api/footer?populate=socialLinks&populate=quickLinks&locale=${locale}`);
}

export async function getPages(locale: Locale = 'zh-CN') {
  const params = locale ? `?locale=${locale}` : '';
  return fetchApi<{ data: Page[]; meta: Pagination }>(`/api/pages${params}`);
}

export async function getHomepage(locale: Locale = 'zh-CN') {
  return fetchApi<{ data: Page }>(`/api/pages/homepage?locale=${locale}`);
}

export async function getPageBySlug(slug: string, locale: Locale = 'zh-CN'): Promise<{ data: Page; _i18nFallback?: boolean }> {
  try {
    return await fetchApi<{ data: Page }>(`/api/pages/slug/${slug}?locale=${locale}`);
  } catch (err) {
    if (locale !== 'zh-CN' && err instanceof Error && err.message.includes('404')) {
      warn(`[i18n] ${locale} missing, fallback to zh-CN: pages/${slug}`);
      const result = await fetchApi<{ data: Page }>(`/api/pages/slug/${slug}?locale=zh-CN`);
      return { ...result, _i18nFallback: true };
    }
    throw err;
  }
}

export async function getProducts(locale: Locale = 'zh-CN', filters?: { category?: string }) {
  const params = new URLSearchParams();
  params.set('populate', 'thumbnail,images,categories,specs,objectives,outline,testimonials');
  params.set('locale', locale);
  if (filters?.category) {
    params.set('category', filters.category);
  }
  return fetchApi<{ data: Product[]; meta: Pagination }>(`/api/products?${params.toString()}`);
}

export async function getFeaturedProducts() {
  return fetchApi<{ data: Product[] }>('/api/products/featured');
}

export async function getProductBySlug(slug: string, locale: Locale = 'zh-CN'): Promise<{ data: Product; _i18nFallback?: boolean }> {
  try {
    return await fetchApi<{ data: Product }>(`/api/products/slug/${slug}?locale=${locale}`);
  } catch (err) {
    if (locale !== 'zh-CN' && err instanceof Error && err.message.includes('404')) {
      warn(`[i18n] ${locale} missing, fallback to zh-CN: products/${slug}`);
      const result = await fetchApi<{ data: Product }>(`/api/products/slug/${slug}?locale=zh-CN`);
      return { ...result, _i18nFallback: true };
    }
    throw err;
  }
}

export async function getProductCategories() {
  return fetchApi<{ data: ProductCategory[] }>('/api/product-categories');
}

export async function getProductCategoryTree() {
  return fetchApi<{ data: ProductCategory[] }>('/api/product-categories/tree');
}

// === News Article API ===

const categoryLabels: Record<string, string> = {
  company_news: '公司动态',
  industry_news: '行业资讯',
  event_notice: '活动通知',
};

export function getNewsCategoryLabel(category: string): string {
  return categoryLabels[category] || category;
}

export async function getNews(locale: Locale = 'zh-CN', category?: string) {
  log(`${LOG_PREFIX} Fetching news${category ? ` (category: ${category})` : ''}...`);
  const params = new URLSearchParams();
  params.set('populate', 'coverImage');
  params.set('locale', locale);
  if (category) {
    params.set('category', category);
  }
  params.set('sort', 'publishedAt:desc');
  const result = await fetchApi<{ data: NewsArticle[] }>(`/api/news-articles?${params.toString()}`);
  log(`${LOG_PREFIX} News loaded: ${result.data.length} items`);
  return result;
}

export async function getNewsBySlug(slug: string, locale: Locale = 'zh-CN'): Promise<{ data: NewsArticle; _i18nFallback?: boolean }> {
  log(`${LOG_PREFIX} Fetching news by slug: ${slug}...`);
  try {
    const result = await fetchApi<{ data: NewsArticle }>(`/api/news-articles/slug/${slug}?locale=${locale}`);
    log(`${LOG_PREFIX} News loaded: ${result.data.title}`);
    return result;
  } catch (err) {
    if (locale !== 'zh-CN' && err instanceof Error && err.message.includes('404')) {
      warn(`[i18n] ${locale} missing, fallback to zh-CN: news-articles/${slug}`);
      const result = await fetchApi<{ data: NewsArticle }>(`/api/news-articles/slug/${slug}?locale=zh-CN`);
      log(`${LOG_PREFIX} News loaded: ${result.data.title}`);
      return { ...result, _i18nFallback: true };
    }
    throw err;
  }
}

export async function getProductSpecs() {
  log(`${LOG_PREFIX} Fetching product specs...`);
  const result = await fetchApi<{ data: ProductSpec[] }>('/api/product-specs');
  log(`${LOG_PREFIX} Product specs loaded: ${result.data.length} items`);
  return result;
}

export async function getFaqItems(locale: Locale = 'zh-CN', category?: string) {
  log(`${LOG_PREFIX} Fetching FAQ items${category ? ` (category: ${category})` : ''}...`);
  const params = new URLSearchParams();
  params.set('locale', locale);
  if (category) {
    params.set('category', category);
  }
  const result = await fetchApi<{ data: FaqItem[] }>(`/api/faq-items?${params.toString()}`);
  log(`${LOG_PREFIX} FAQ items loaded: ${result.data.length} items`);
  return result;
}

export async function searchFaqItems(query: string) {
  log(`${LOG_PREFIX} Searching FAQ items: "${query}"...`);
  const result = await fetchApi<{ data: FaqItem[] }>(`/api/faq-items/search?q=${encodeURIComponent(query)}`);
  log(`${LOG_PREFIX} FAQ search results: ${result.data.length} items`);
  return result;
}

export async function submitFaqFeedback(id: string, data: { helpful: boolean; comment?: string }) {
  log(`${LOG_PREFIX} Submitting FAQ feedback for id=${id}, helpful=${data.helpful}...`);
  const result = await fetchApi(`/api/faq-items/${id}/feedback`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
  log(`${LOG_PREFIX} FAQ feedback submitted successfully`);
  return result;
}

export async function getKnowledgeBases() {
  log(`${LOG_PREFIX} Fetching knowledge bases...`);
  const result = await fetchApi<{ data: KnowledgeBase[] }>('/api/knowledge-bases');
  log(`${LOG_PREFIX} Knowledge bases loaded: ${result.data.length} items`);
  return result;
}

export async function searchKnowledgeBases(query: string) {
  log(`${LOG_PREFIX} Searching knowledge bases: "${query}"...`);
  const result = await fetchApi<{ data: KnowledgeBase[] }>(`/api/knowledge-bases/search?q=${encodeURIComponent(query)}`);
  log(`${LOG_PREFIX} Knowledge base search results: ${result.data.length} items`);
  return result;
}

export interface FontSettings {
  fontFamily?: string;
  fontFile?: { url: string; alternativeText?: string } | null;
  fontFormat?: 'woff2' | 'ttf' | 'otf';
  fontWeight?: string;
  fontDisplay?: 'swap' | 'block' | 'fallback' | 'optional';
  fallbackFont?: string;
  licenseType?: 'ofl' | 'apache' | 'commercial' | 'custom';
  licenseOwner?: string;
  licenseExpiry?: string;
  licenseNote?: string;
}

export interface SiteSettings {
  id: number;
  documentId?: string;
  name: string;
  slogan?: string;
  logo?: { url: string; alternativeText?: string } | null;
  favicon?: { url: string; alternativeText?: string } | null;
  phone?: string;
  showPhoneInNav?: boolean;
  email?: string;
  address?: string;
  wechat?: string;
  icp?: string;
  icpUrl?: string;
  publicSecurityRecord?: string;
  publicSecurityRecordUrl?: string;
  seo?: Seo;
  fontSettings?: FontSettings;
  /** 品牌主色（hex），后台「站点设置」可调，留空用默认 #F5851F */
  primaryColor?: string;
  /** 深色（标题/深色背景，hex），后台可调，留空用默认 #1C2B3A */
  darkColor?: string;
  /** GEO：给 AI 搜索引擎看的机构摘要（写入 llms.txt） */
  aiSummary?: string;
  /** Google Search Console 验证码 */
  googleVerification?: string;
  /** Bing Webmaster 验证码 */
  bingVerification?: string;
  /** 百度站长平台验证码 */
  baiduVerification?: string;
  /** 统计代码配置（GA4 / 百度统计 / Facebook Pixel） */
  analytics?: AnalyticsConfig;
  /** 站点级默认分享图（页面未配置 OG 图时回退） */
  defaultOgImage?: { url: string; alternativeText?: string } | null;
}

export interface AnalyticsConfig {
  ga4Id?: string;
  baiduTongjiId?: string;
  facebookPixelId?: string;
}

export interface NavigationItem {
  id: number;
  documentId?: string;
  name: string;
  url: string;
  icon?: string;
  position: number;
  isActive: boolean;
  children?: NavigationItem[];
}

export interface Footer {
  id: number;
  documentId?: string;
  copyright?: string;
  aboutText?: string;
  socialLinks?: SocialLink[];
  quickLinks?: QuickLink[];
}

export interface SocialLink {
  id: number;
  documentId?: string;
  platform: string;
  /** 纯二维码条目可为空 */
  url?: string;
  icon?: string;
  label?: string;
  /** 关注二维码图片（如微信公众号二维码），后台可上传 */
  qrImage?: { url: string; alternativeText?: string } | null;
}

export interface QuickLink {
  id: number;
  documentId?: string;
  title: string;
  url: string;
}

export interface Page {
  id: number;
  documentId?: string;
  title: string;
  slug: string;
  isHomepage: boolean;
  sections: Section[];
  seo?: Seo;
}

export interface Section {
  id: number;
  __component: string;
  [key: string]: any;
}

export interface Seo {
  metaTitle?: string;
  metaDescription?: string;
  metaKeywords?: string;
  canonicalUrl?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: { url: string; alternativeText?: string } | null;
  ogType?: string;
  /** 后台勾选后此页面不被搜索引擎索引 */
  noindex?: boolean;
}

export interface CourseObjective {
  id: number;
  title: string;
  description?: string;
}

export interface CourseModule {
  id: number;
  title: string;
  description?: string;
  lessonCount?: number;
}

export interface CourseTestimonial {
  id: number;
  parentName: string;
  content: string;
  rating?: number;
}

export interface Product {
  id: number;
  documentId?: string;
  name: string;
  slug: string;
  description?: string;
  shortDescription?: string;
  price?: number;
  originalPrice?: number;
  image?: { url: string; alternativeText?: string } | null;
  images?: { url: string; alternativeText?: string }[];
  thumbnail?: { url: string; alternativeText?: string } | null;
  isFeatured?: boolean;
  isNew?: boolean;
  categories?: ProductCategory[];
  specs?: ProductSpec[];
  specValues?: Record<string, string>;
  teachingMethod?: string;
  objectives?: CourseObjective[];
  outline?: CourseModule[];
  testimonials?: CourseTestimonial[];
  seo?: Seo;
  /** GEO：课程级 AI 摘要 */
  aiSummary?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ProductCategory {
  id: number;
  documentId?: string;
  name: string;
  slug: string;
  description?: string;
  parent?: ProductCategory | null;
  children?: ProductCategory[];
}

export interface ProductSpec {
  id: number;
  documentId?: string;
  name: string;
  value: string;
  unit?: string;
}

export interface FaqItem {
  id: number;
  documentId?: string;
  question: string;
  answer: string;
  category?: string;
  isActive?: boolean;
  helpfulCount?: number;
  notHelpfulCount?: number;
}

export interface NewsArticle {
  id: number;
  documentId?: string;
  title: string;
  slug: string;
  excerpt?: string;
  content?: string;
  coverImage?: { url: string; alternativeText?: string } | null;
  category?: 'company_news' | 'industry_news' | 'event_notice';
  isFeatured?: boolean;
  publishedAt?: string;
  viewCount?: number;
  seo?: Seo;
  /** GEO：新闻级 AI 摘要 */
  aiSummary?: string;
}

export interface KnowledgeBase {
  id: number;
  documentId?: string;
  title: string;
  content: string;
  sourceType?: string;
  status?: string;
  statusMessage?: string;
  createdAt?: string;
}

export interface Pagination {
  page: number;
  pageSize: number;
  pageCount: number;
  total: number;
}

export interface AppointmentData {
  name?: string;
  childName: string;
  parentName: string;
  phone: string;
  campus: string;
  age?: string;
  course?: string;
  preferredDate?: string;
  preferredTimeSlot?: string;
  message?: string;
  sourcePage?: string;
}

export async function createAppointment(data: AppointmentData) {
  log(`${LOG_PREFIX} Creating appointment...`);
  log(`${LOG_PREFIX} Appointment request:`, { hasParentName: !!data.parentName, hasChildName: !!data.childName, hasPhone: !!data.phone, campus: data.campus });

  const requiredFields = ['parentName', 'childName', 'phone', 'campus'];
  const missingFields = requiredFields.filter(field => !data[field as keyof AppointmentData]);
  if (missingFields.length > 0) {
    warn(`${LOG_PREFIX} WARNING: Missing required fields: ${missingFields.join(', ')}`);
  }

  try {
    const result = await fetchApi<{ data: any }>('/api/appointments', {
      method: 'POST',
      body: JSON.stringify({ data }),
    });

    log(`${LOG_PREFIX} ✅ Appointment created successfully!`);
    log(`${LOG_PREFIX} Appointment created:`, { id: result?.data?.id, status: result?.data?.status });

    return result;
  } catch (error) {
    console.error(`${LOG_PREFIX} ❌ Appointment creation failed!`);
    console.error(`${LOG_PREFIX} Error details:`, error);

    if (error instanceof Error) {
      console.error(`${LOG_PREFIX} Error message: ${error.message}`);
      console.error(`${LOG_PREFIX} Error stack:`, error.stack);
    }

    console.error(`${LOG_PREFIX} Appointment creation failed:`, error instanceof Error ? error.message : 'unknown');

    throw error;
  }
}

// === Teacher 接口与 API ===

export interface Teacher {
  id: number;
  documentId?: string;
  name: string;
  slug: string;
  title: string;
  avatar?: { url: string; alternativeText?: string } | null;
  campus?: Campus | null;
  subject?: 'pinyin' | 'math' | 'english' | 'comprehensive';
  teachingYears?: number;
  education?: string;
  teachingFeatures?: string;
  achievements?: string[];
  isFeatured?: boolean;
  sortOrder?: number;
  seo?: Seo;
  /** GEO：教师级 AI 摘要 */
  aiSummary?: string;
}

export async function getTeachers(
  locale: Locale = 'zh-CN',
  filters?: {
    campusSlug?: string;
    subject?: string;
    featured?: boolean;
  }
) {
  log(`${LOG_PREFIX} Fetching teachers...`, filters);
  const params = new URLSearchParams();
  params.set('locale', locale);
  if (filters?.campusSlug) {
    params.set('filters[campus][slug][$eq]', filters.campusSlug);
  }
  if (filters?.subject) {
    params.set('filters[subject][$eq]', filters.subject);
  }
  if (filters?.featured !== undefined) {
    params.set('filters[isFeatured][$eq]', String(filters.featured));
  }
  params.set('sort', 'sortOrder:asc');
  params.set('populate', 'avatar,campus');
  const result = await fetchApi<{ data: Teacher[] }>(`/api/teachers?${params.toString()}`);
  log(`${LOG_PREFIX} Teachers loaded: ${result.data.length} items`);
  return result;
}

export async function getTeacherBySlug(slug: string, locale: Locale = 'zh-CN'): Promise<(Teacher & { _i18nFallback?: boolean }) | null> {
  log(`${LOG_PREFIX} Fetching teacher by slug: ${slug} (locale: ${locale})...`);
  const params = new URLSearchParams();
  params.set('filters[slug][$eq]', slug);
  params.set('populate', 'avatar,campus');
  params.set('locale', locale);
  const result = await fetchApi<{ data: Teacher[] }>(`/api/teachers?${params.toString()}`);

  if (result.data.length === 0 && locale !== 'zh-CN') {
    warn(`[i18n] ${locale} missing, fallback to zh-CN: teachers/${slug}`);
    const fallbackParams = new URLSearchParams();
    fallbackParams.set('filters[slug][$eq]', slug);
    fallbackParams.set('populate', 'avatar,campus');
    fallbackParams.set('locale', 'zh-CN');
    const fallbackResult = await fetchApi<{ data: Teacher[] }>(`/api/teachers?${fallbackParams.toString()}`);
    const teacher = fallbackResult.data[0] || null;
    log(`${LOG_PREFIX} Teacher loaded:`, teacher?.name);
    return teacher ? { ...teacher, _i18nFallback: true } : null;
  }

  log(`${LOG_PREFIX} Teacher loaded:`, result.data[0]?.name);
  return result.data[0] || null;
}

// === Campus 接口与 API ===

export interface Campus {
  id: number;
  documentId?: string;
  name: string;
  slug: string;
  coverImage?: { url: string; alternativeText?: string } | null;
  gallery?: { url: string; alternativeText?: string }[];
  address: string;
  phone?: string;
  contactPerson?: string;
  businessHours?: string;
  transportation?: string;
  area?: string;
  description?: string;
  mapEmbed?: string;
  latitude?: number;
  longitude?: number;
  sortOrder?: number;
  teachers?: Teacher[];
  seo?: Seo;
  /** GEO：校区级 AI 摘要 */
  aiSummary?: string;
}

export async function getCampuses(locale: Locale = 'zh-CN') {
  log(`${LOG_PREFIX} Fetching campuses...`);
  const params = new URLSearchParams();
  params.set('sort', 'sortOrder:asc');
  params.set('populate', 'coverImage,gallery,teachers');
  params.set('locale', locale);
  const result = await fetchApi<{ data: Campus[] }>(`/api/campuses?${params.toString()}`);
  log(`${LOG_PREFIX} Campuses loaded: ${result.data.length} items`);
  return result;
}

export async function getCampusBySlug(slug: string, locale: Locale = 'zh-CN'): Promise<{ data: Campus[]; _i18nFallback?: boolean }> {
  log(`${LOG_PREFIX} Fetching campus by slug: ${slug} (locale: ${locale})...`);
  const params = new URLSearchParams();
  params.set('filters[slug][$eq]', slug);
  params.set('locale', locale);
  const result = await fetchApi<{ data: Campus[] }>(`/api/campuses?${params.toString()}`);

  if (result.data.length === 0 && locale !== 'zh-CN') {
    warn(`[i18n] ${locale} missing, fallback to zh-CN: campuses/${slug}`);
    const fallbackParams = new URLSearchParams();
    fallbackParams.set('filters[slug][$eq]', slug);
    fallbackParams.set('locale', 'zh-CN');
    const fallbackResult = await fetchApi<{ data: Campus[] }>(`/api/campuses?${fallbackParams.toString()}`);
    log(`${LOG_PREFIX} Campus loaded:`, fallbackResult.data[0]?.name);
    if (fallbackResult.data.length === 0) {
      return fallbackResult;
    }
    return { ...fallbackResult, _i18nFallback: true };
  }

  log(`${LOG_PREFIX} Campus loaded:`, result.data[0]?.name);
  return result;
}

// === MeiliSearch 产品搜索 API ===

export async function searchProducts(params: {
  query?: string;
  categorySlugs?: string[];
  sort?: string[];
  page?: number;
  limit?: number;
  locale?: Locale;
}): Promise<{ data: Product[]; meta: { total: number; page: number; pageSize: number; pageCount: number } }> {
  log(`${LOG_PREFIX} Searching products...`, params);
  const urlParams = new URLSearchParams();
  if (params.query) {
    urlParams.set('query', params.query);
  }
  if (params.categorySlugs && params.categorySlugs.length > 0) {
    params.categorySlugs.forEach((slug) => {
      urlParams.append('categorySlugs', slug);
    });
  }
  if (params.sort && params.sort.length > 0) {
    params.sort.forEach((s) => {
      urlParams.append('sort', s);
    });
  }
  if (params.page !== undefined) {
    urlParams.set('page', String(params.page));
  }
  if (params.limit !== undefined) {
    urlParams.set('limit', String(params.limit));
  }
  if (params.locale) {
    urlParams.set('locale', params.locale);
  }
  const queryString = urlParams.toString();
  const result = await fetchApi<{ data: Product[]; meta: { total: number; page: number; pageSize: number; pageCount: number } }>(
    `/api/products/search${queryString ? `?${queryString}` : ''}`
  );
  log(`${LOG_PREFIX} Search results: ${result.data.length} products, total=${result.meta.total}`);
  return result;
}
