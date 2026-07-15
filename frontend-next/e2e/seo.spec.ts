import { test, expect } from '@playwright/test';

async function getJsonLdSchemas(page: import('@playwright/test').Page) {
  const scripts = page.locator('script[type="application/ld+json"]');
  const jsonContents = await scripts.allTextContents();
  return jsonContents.map((s) => JSON.parse(s));
}

test.describe('SEO structured data', () => {
  test('homepage has Organization + WebSite schema', async ({ page }) => {
    await page.goto('/');
    const schemas = await getJsonLdSchemas(page);
    expect(schemas.length).toBeGreaterThanOrEqual(2);
    const types = schemas.map((s) => s['@type']);
    expect(types).toContain('WebSite');
    expect(types).toContain('EducationalOrganization');
  });

  test('course detail page has Course + BreadcrumbList schema', async ({ page }) => {
    await page.goto('/courses/yousen-youxiao-xianjie');
    const schemas = await getJsonLdSchemas(page);
    expect(schemas.length).toBeGreaterThanOrEqual(2);
    const types = schemas.map((s) => s['@type']);
    expect(types).toContain('Course');
    expect(types).toContain('BreadcrumbList');
  });

  test('campus detail page has LocalBusiness + BreadcrumbList schema', async ({ page }) => {
    await page.goto('/campuses/yousen-baibuting');
    const schemas = await getJsonLdSchemas(page);
    expect(schemas.length).toBeGreaterThanOrEqual(2);

    const localBusiness = schemas.find((s) => {
      const t = s['@type'];
      return Array.isArray(t) ? t.includes('LocalBusiness') : t === 'LocalBusiness';
    });
    expect(localBusiness).toBeDefined();
    expect(localBusiness?.['@type']).toEqual(['LocalBusiness', 'EducationalOrganization']);
    expect(localBusiness?.['address']?.streetAddress).toBeTruthy();
    expect(localBusiness?.['name']).toBeTruthy();

    const breadcrumb = schemas.find((s) => s['@type'] === 'BreadcrumbList');
    expect(breadcrumb).toBeDefined();
  });

  test('FAQ page has FAQPage + BreadcrumbList schema', async ({ page }) => {
    await page.goto('/faq');
    const schemas = await getJsonLdSchemas(page);
    expect(schemas.length).toBeGreaterThanOrEqual(2);
    const types = schemas.map((s) => s['@type']);
    expect(types).toContain('FAQPage');
    expect(types).toContain('BreadcrumbList');
  });

  test('sitemap.xml contains campuses and teachers URLs', async ({ page }) => {
    const response = await page.request.get('/sitemap.xml');
    expect(response.status()).toBe(200);
    const content = await response.text();
    expect(content).toContain('/campuses/');
    expect(content).toContain('/teachers/');
    expect(content).toContain('hreflang');
  });
});
