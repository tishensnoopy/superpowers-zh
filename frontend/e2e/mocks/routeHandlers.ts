import { Page } from '@playwright/test';
import { mockSiteSettings, mockNavigation, mockFooter, mockHomepage, mockFaqItems, mockProducts, mockProductCategories, mockNavigationTree, mockCourseDetailFull, mockCourseDetailEmpty, mockCourseDetailNotFound } from './data';

export async function setupApiMocks(page: Page) {
  await page.route('/api/site-settings', async (route) => {
    await route.fulfill({
      status: 200,
      json: mockSiteSettings,
    });
  });

  await page.route('/api/navigation', async (route) => {
    await route.fulfill({
      status: 200,
      json: mockNavigation,
    });
  });

  await page.route('/api/navigation/tree', async (route) => {
    await route.fulfill({
      status: 200,
      json: mockNavigationTree,
    });
  });

  await page.route('/api/footer', async (route) => {
    await route.fulfill({
      status: 200,
      json: mockFooter,
    });
  });

  await page.route('/api/pages/homepage', async (route) => {
    await route.fulfill({
      status: 200,
      json: mockHomepage,
    });
  });

  await page.route('/api/pages/slug/homepage', async (route) => {
    await route.fulfill({
      status: 200,
      json: mockHomepage,
    });
  });

  await page.route('/api/faq-items', async (route) => {
    await route.fulfill({
      status: 200,
      json: mockFaqItems,
    });
  });

  await page.route('/api/products', async (route) => {
    await route.fulfill({
      status: 200,
      json: mockProducts,
    });
  });

  await page.route('/api/products/featured', async (route) => {
    await route.fulfill({
      status: 200,
      json: { data: mockProducts.data.filter(p => p.attributes.isFeatured) },
    });
  });

  await page.route('**/api/products/slug/pinyin-basic', async (route) => {
    await route.fulfill({ status: 200, json: mockCourseDetailFull });
  });

  await page.route('**/api/products/slug/math-thinking', async (route) => {
    await route.fulfill({ status: 200, json: mockCourseDetailEmpty });
  });

  await page.route('**/api/products/slug/not-exist', async (route) => {
    await route.fulfill({ status: 404, json: mockCourseDetailNotFound });
  });

  await page.route('/api/product-categories', async (route) => {
    await route.fulfill({
      status: 200,
      json: mockProductCategories,
    });
  });

  await page.route('/api/appointments', async (route) => {
    const request = await route.request();
    const body = request.method() === 'POST' ? await request.json() : null;
    await route.fulfill({
      status: 201,
      json: {
        data: {
          id: Date.now(),
          attributes: {
            ...body?.data,
            status: 'pending',
          },
        },
      },
    });
  });
}