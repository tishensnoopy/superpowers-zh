const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:1337';

const LOG_PREFIX = '[API]';

function logRequest(path: string, options: RequestInit = {}) {
  const method = options.method || 'GET';
  const hasBody = options.body ? ` (body: ${options.body.toString().length} chars)` : '';
  console.log(`${LOG_PREFIX} ${method} ${path}${hasBody}`);
}

function logResponse(path: string, status: number, duration: number, data?: any) {
  const dataSize = data ? JSON.stringify(data).length : 0;
  console.log(`${LOG_PREFIX} Response ${path}: status=${status}, duration=${duration}ms, size=${dataSize} bytes`);
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
      throw error;
    }

    const data = await res.json();
    logResponse(path, res.status, duration, data);
    return data;
  } catch (err) {
    const duration = Math.round(performance.now() - startTime);
    if (err instanceof Error) {
      logError(path, err, duration);
    } else {
      logError(path, new Error(String(err)), duration);
    }
    throw err;
  }
}

export async function getSiteSettings() {
  console.log(`${LOG_PREFIX} Fetching site settings...`);
  const result = await fetchApi<{ data: SiteSettings[] }>('/api/site-settings');
  const item = Array.isArray(result.data) ? result.data[0] : result.data;
  console.log(`${LOG_PREFIX} Site settings loaded: id=${item?.id}, name=${item?.attributes?.name}`);
  return result;
}

export async function getNavigation() {
  console.log(`${LOG_PREFIX} Fetching navigation...`);
  const result = await fetchApi<{ data: NavigationItem[] }>('/api/navigation');
  console.log(`${LOG_PREFIX} Navigation loaded: ${result.data.length} items`);
  return result;
}

export async function getNavigationTree() {
  console.log(`${LOG_PREFIX} Fetching navigation tree...`);
  const result = await fetchApi<{ data: NavigationItem[] }>('/api/navigation/tree');
  console.log(`${LOG_PREFIX} Navigation tree loaded: ${result.data.length} items`);
  return result;
}

export async function getFooter() {
  console.log(`${LOG_PREFIX} Fetching footer...`);
  const result = await fetchApi<{ data: Footer[] }>('/api/footer?populate=socialLinks&populate=quickLinks');
  const item = Array.isArray(result.data) ? result.data[0] : result.data;
  console.log(`${LOG_PREFIX} Footer loaded: id=${item?.id}`);
  return result;
}

export async function getPages(locale?: string) {
  console.log(`${LOG_PREFIX} Fetching pages${locale ? ` (locale: ${locale})` : ''}...`);
  const params = locale ? `?locale=${locale}` : '';
  const result = await fetchApi<{ data: Page[]; meta: Pagination }>(`/api/pages${params}`);
  console.log(`${LOG_PREFIX} Pages loaded: ${result.data.length} pages, total=${result.meta.total}`);
  return result;
}

export async function getHomepage() {
  console.log(`${LOG_PREFIX} Fetching homepage...`);
  const result = await fetchApi<{ data: Page }>('/api/pages/homepage');
  console.log(`${LOG_PREFIX} Homepage loaded: id=${result.data.id}, title=${result.data.attributes.title}, sections=${result.data.attributes.sections?.length || 0}`);
  return result;
}

export async function getPageBySlug(slug: string) {
  console.log(`${LOG_PREFIX} Fetching page by slug: ${slug}...`);
  const result = await fetchApi<{ data: Page }>(`/api/pages/slug/${slug}`);
  console.log(`${LOG_PREFIX} Page loaded: id=${result.data.id}, title=${result.data.attributes.title}`);
  return result;
}

export async function getProducts(filters?: { category?: string }) {
  console.log(`${LOG_PREFIX} Fetching products${filters?.category ? ` (category: ${filters.category})` : ''}...`);
  let params = '';
  if (filters?.category) {
    params = `?category=${filters.category}`;
  }
  const result = await fetchApi<{ data: Product[]; meta: Pagination }>(`/api/products${params}`);
  console.log(`${LOG_PREFIX} Products loaded: ${result.data.length} products, total=${result.meta.total}`);
  return result;
}

export async function getFeaturedProducts() {
  console.log(`${LOG_PREFIX} Fetching featured products...`);
  const result = await fetchApi<{ data: Product[] }>('/api/products/featured');
  console.log(`${LOG_PREFIX} Featured products loaded: ${result.data.length} items`);
  return result;
}

export async function getProductBySlug(slug: string) {
  console.log(`${LOG_PREFIX} Fetching product by slug: ${slug}...`);
  const result = await fetchApi<{ data: Product }>(`/api/products/slug/${slug}`);
  console.log(`${LOG_PREFIX} Product loaded: id=${result.data.id}, name=${result.data.attributes.name}`);
  return result;
}

export async function getProductCategories() {
  console.log(`${LOG_PREFIX} Fetching product categories...`);
  const result = await fetchApi<{ data: ProductCategory[] }>('/api/product-categories');
  console.log(`${LOG_PREFIX} Product categories loaded: ${result.data.length} items`);
  return result;
}

export async function getProductCategoryTree() {
  console.log(`${LOG_PREFIX} Fetching product category tree...`);
  const result = await fetchApi<{ data: ProductCategory[] }>('/api/product-categories/tree');
  console.log(`${LOG_PREFIX} Product category tree loaded: ${result.data.length} items`);
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

export interface SiteSettings {
  id: number;
  attributes: {
    name: string;
    slogan?: string;
    logo?: { data?: { attributes: { url: string } } };
    favicon?: { data?: { attributes: { url: string } } };
    phone?: string;
    email?: string;
    address?: string;
    wechat?: string;
    seo?: Seo;
  };
}

export interface NavigationItem {
  id: number;
  attributes: {
    name: string;
    url: string;
    icon?: string;
    position: number;
    isActive: boolean;
    children?: { data: NavigationItem[] };
  };
}

export interface Footer {
  id: number;
  attributes: {
    copyright?: string;
    socialLinks?: { data: SocialLink[] };
    quickLinks?: { data: QuickLink[] };
  };
}

export interface SocialLink {
  id: number;
  attributes: {
    platform: string;
    url: string;
    icon?: string;
  };
}

export interface QuickLink {
  id: number;
  attributes: {
    name: string;
    url: string;
  };
}

export interface Page {
  id: number;
  attributes: {
    title: string;
    slug: string;
    isHomepage: boolean;
    sections: Section[];
    seo?: Seo;
  };
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
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: { data?: { attributes: { url: string } } };
  twitterTitle?: string;
  twitterDescription?: string;
  twitterImage?: { data?: { attributes: { url: string } } };
  structuredData?: string;
}

export interface Product {
  id: number;
  attributes: {
    name: string;
    slug: string;
    description?: string;
    shortDescription?: string;
    price?: number;
    originalPrice?: number;
    image?: { data?: { attributes: { url: string } } };
    images?: { data: { attributes: { url: string } }[] };
    isFeatured?: boolean;
    isNew?: boolean;
    categories?: { data: ProductCategory[] };
    specs?: { data: ProductSpec[] };
    createdAt?: string;
    updatedAt?: string;
  };
}

export interface ProductCategory {
  id: number;
  attributes: {
    name: string;
    slug: string;
    description?: string;
    parent?: { data?: ProductCategory };
    children?: { data: ProductCategory[] };
  };
}

export interface ProductSpec {
  id: number;
  attributes: {
    name: string;
    value: string;
    unit?: string;
  };
}

export interface FaqItem {
  id: number;
  attributes: {
    question: string;
    answer: string;
    category?: string;
    isActive?: boolean;
    helpfulCount?: number;
    notHelpfulCount?: number;
  };
}

export interface KnowledgeBase {
  id: number;
  attributes: {
    title: string;
    content: string;
    sourceType?: string;
    status?: string;
    statusMessage?: string;
    createdAt?: string;
  };
}

export interface Pagination {
  page: number;
  pageSize: number;
  pageCount: number;
  total: number;
}

export interface AppointmentData {
  name: string;
  phone: string;
  campus: string;
  age?: string;
  course?: string;
  preferredTimeSlot?: string;
  message?: string;
}

export async function createAppointment(data: AppointmentData) {
  console.log(`${LOG_PREFIX} Creating appointment...`);
  console.log(`${LOG_PREFIX} Request data:`, JSON.stringify(data, null, 2));
  
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
    console.log(`${LOG_PREFIX} Response data:`, JSON.stringify(result, null, 2));
    console.log(`${LOG_PREFIX} Appointment ID: ${result.data?.id}`);
    console.log(`${LOG_PREFIX} Status: ${result.data?.status || 'pending'}`);
    
    return result;
  } catch (error) {
    console.error(`${LOG_PREFIX} ❌ Appointment creation failed!`);
    console.error(`${LOG_PREFIX} Error details:`, error);
    
    if (error instanceof Error) {
      console.error(`${LOG_PREFIX} Error message: ${error.message}`);
      console.error(`${LOG_PREFIX} Error stack:`, error.stack);
    }
    
    console.error(`${LOG_PREFIX} Request data that failed:`, JSON.stringify(data, null, 2));
    
    throw error;
  }
}
