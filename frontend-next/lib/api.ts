import * as Sentry from '@sentry/nextjs';

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

function logRequest(path: string, options: RequestInit = {}) {
  const method = options.method || 'GET';
  const hasBody = options.body ? ` (body: ${options.body.toString().length} chars)` : '';
  console.log(`${LOG_PREFIX} ${method} ${path}${hasBody}`);
}

function logResponse(path: string, status: number, duration: number, contentLength?: string | null) {
  const sizeStr = contentLength ? `, size=${contentLength} bytes` : '';
  console.log(`${LOG_PREFIX} Response ${path}: status=${status}, duration=${duration}ms${sizeStr}`);
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
        Sentry.captureException(error, {
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
      Sentry.captureException(err, {
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

export async function getSiteSettings() {
  return fetchApi<{ data: SiteSettings[] }>('/api/site-settings');
}

export async function getNavigation() {
  return fetchApi<{ data: NavigationItem[] }>('/api/navigation');
}

export async function getNavigationTree() {
  return fetchApi<{ data: NavigationItem[] }>('/api/navigation/tree');
}

export async function getFooter() {
  return fetchApi<{ data: Footer[] }>('/api/footer?populate=socialLinks&populate=quickLinks');
}

export async function getPages(locale?: string) {
  const params = locale ? `?locale=${locale}` : '';
  return fetchApi<{ data: Page[]; meta: Pagination }>(`/api/pages${params}`);
}

export async function getHomepage() {
  return fetchApi<{ data: Page }>('/api/pages/homepage');
}

export async function getPageBySlug(slug: string) {
  return fetchApi<{ data: Page }>(`/api/pages/slug/${slug}`);
}

export async function getProducts(filters?: { category?: string }) {
  const params = new URLSearchParams();
  params.set('populate', 'thumbnail,categories,specs,objectives,outline,testimonials');
  if (filters?.category) {
    params.set('category', filters.category);
  }
  return fetchApi<{ data: Product[]; meta: Pagination }>(`/api/products?${params.toString()}`);
}

export async function getFeaturedProducts() {
  return fetchApi<{ data: Product[] }>('/api/products/featured');
}

export async function getProductBySlug(slug: string) {
  return fetchApi<{ data: Product }>(`/api/products/slug/${slug}`);
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

export async function getNews(category?: string) {
  console.log(`${LOG_PREFIX} Fetching news${category ? ` (category: ${category})` : ''}...`);
  const params = new URLSearchParams();
  params.set('populate', 'coverImage');
  if (category) {
    params.set('category', category);
  }
  params.set('sort', 'publishedAt:desc');
  const result = await fetchApi<{ data: NewsArticle[] }>(`/api/news-articles?${params.toString()}`);
  console.log(`${LOG_PREFIX} News loaded: ${result.data.length} items`);
  return result;
}

export async function getNewsBySlug(slug: string) {
  console.log(`${LOG_PREFIX} Fetching news by slug: ${slug}...`);
  const result = await fetchApi<{ data: NewsArticle }>(`/api/news-articles/slug/${slug}`);
  console.log(`${LOG_PREFIX} News loaded: ${result.data.title}`);
  return result;
}

export async function getProductSpecs() {
  console.log(`${LOG_PREFIX} Fetching product specs...`);
  const result = await fetchApi<{ data: ProductSpec[] }>('/api/product-specs');
  console.log(`${LOG_PREFIX} Product specs loaded: ${result.data.length} items`);
  return result;
}

export async function getFaqItems(category?: string) {
  console.log(`${LOG_PREFIX} Fetching FAQ items${category ? ` (category: ${category})` : ''}...`);
  const params = category ? `?category=${category}` : '';
  const result = await fetchApi<{ data: FaqItem[] }>(`/api/faq-items${params}`);
  console.log(`${LOG_PREFIX} FAQ items loaded: ${result.data.length} items`);
  return result;
}

export async function searchFaqItems(query: string) {
  console.log(`${LOG_PREFIX} Searching FAQ items: "${query}"...`);
  const result = await fetchApi<{ data: FaqItem[] }>(`/api/faq-items/search?q=${encodeURIComponent(query)}`);
  console.log(`${LOG_PREFIX} FAQ search results: ${result.data.length} items`);
  return result;
}

export async function submitFaqFeedback(id: string, data: { helpful: boolean; comment?: string }) {
  console.log(`${LOG_PREFIX} Submitting FAQ feedback for id=${id}, helpful=${data.helpful}...`);
  const result = await fetchApi(`/api/faq-items/${id}/feedback`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
  console.log(`${LOG_PREFIX} FAQ feedback submitted successfully`);
  return result;
}

export async function getKnowledgeBases() {
  console.log(`${LOG_PREFIX} Fetching knowledge bases...`);
  const result = await fetchApi<{ data: KnowledgeBase[] }>('/api/knowledge-bases');
  console.log(`${LOG_PREFIX} Knowledge bases loaded: ${result.data.length} items`);
  return result;
}

export async function searchKnowledgeBases(query: string) {
  console.log(`${LOG_PREFIX} Searching knowledge bases: "${query}"...`);
  const result = await fetchApi<{ data: KnowledgeBase[] }>(`/api/knowledge-bases/search?q=${encodeURIComponent(query)}`);
  console.log(`${LOG_PREFIX} Knowledge base search results: ${result.data.length} items`);
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
  email?: string;
  address?: string;
  wechat?: string;
  icp?: string;
  publicSecurityRecord?: string;
  seo?: Seo;
  fontSettings?: FontSettings;
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
  url: string;
  icon?: string;
  label?: string;
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
  childName?: string;
  parentName?: string;
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
  console.log(`${LOG_PREFIX} Creating appointment...`);
  console.log(`${LOG_PREFIX} Appointment request:`, { hasName: !!data.name, hasPhone: !!data.phone, campus: data.campus });

  const requiredFields = ['name', 'phone', 'campus'];
  const missingFields = requiredFields.filter(field => !data[field as keyof AppointmentData]);
  if (missingFields.length > 0) {
    console.warn(`${LOG_PREFIX} WARNING: Missing required fields: ${missingFields.join(', ')}`);
  }

  try {
    const result = await fetchApi<{ data: any }>('/api/appointments', {
      method: 'POST',
      body: JSON.stringify({ data }),
    });

    console.log(`${LOG_PREFIX} ✅ Appointment created successfully!`);
    console.log(`${LOG_PREFIX} Appointment created:`, { id: result?.data?.id, status: result?.data?.status });

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
}

export async function getTeachers(filters?: {
  campusSlug?: string;
  subject?: string;
  featured?: boolean;
}) {
  console.log(`${LOG_PREFIX} Fetching teachers...`, filters);
  const params = new URLSearchParams();
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
  console.log(`${LOG_PREFIX} Teachers loaded: ${result.data.length} items`);
  return result;
}

export async function getTeacherBySlug(slug: string) {
  console.log(`${LOG_PREFIX} Fetching teacher by slug: ${slug}...`);
  const params = new URLSearchParams();
  params.set('filters[slug][$eq]', slug);
  params.set('populate', 'avatar,campus');
  const result = await fetchApi<{ data: Teacher[] }>(`/api/teachers?${params.toString()}`);
  console.log(`${LOG_PREFIX} Teacher loaded:`, result.data[0]?.name);
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
  businessHours?: string;
  transportation?: string;
  area?: string;
  description?: string;
  mapEmbed?: string;
  sortOrder?: number;
  teachers?: Teacher[];
  seo?: Seo;
}

export async function getCampuses() {
  console.log(`${LOG_PREFIX} Fetching campuses...`);
  const params = new URLSearchParams();
  params.set('sort', 'sortOrder:asc');
  params.set('populate', 'coverImage,gallery,teachers');
  const result = await fetchApi<{ data: Campus[] }>(`/api/campuses?${params.toString()}`);
  console.log(`${LOG_PREFIX} Campuses loaded: ${result.data.length} items`);
  return result;
}

export async function getCampusBySlug(slug: string) {
  console.log(`${LOG_PREFIX} Fetching campus by slug: ${slug}...`);
  const params = new URLSearchParams();
  params.set('filters[slug][$eq]', slug);
  const result = await fetchApi<{ data: Campus[] }>(`/api/campuses?${params.toString()}`);
  console.log(`${LOG_PREFIX} Campus loaded:`, result.data[0]?.name);
  return result;
}

// === MeiliSearch 产品搜索 API ===

export async function searchProducts(params: {
  query?: string;
  categorySlugs?: string[];
  sort?: string[];
  page?: number;
  limit?: number;
}): Promise<{ data: Product[]; meta: { total: number; page: number; pageSize: number; pageCount: number } }> {
  console.log(`${LOG_PREFIX} Searching products...`, params);
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
  const queryString = urlParams.toString();
  const result = await fetchApi<{ data: Product[]; meta: { total: number; page: number; pageSize: number; pageCount: number } }>(
    `/api/products/search${queryString ? `?${queryString}` : ''}`
  );
  console.log(`${LOG_PREFIX} Search results: ${result.data.length} products, total=${result.meta.total}`);
  return result;
}
