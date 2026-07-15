import { test, expect, type APIRequestContext } from '@playwright/test';

const STRAPI_URL = 'http://localhost:1337';
const FRONTEND_URL = 'http://localhost:3000';
const ADMIN_EMAIL = 'admin@yousen.com';
const ADMIN_PASSWORD = 'Yousen2026!';

let adminToken: string;

async function createViaContentManager(
  request: APIRequestContext,
  contentType: string,
  data: Record<string, unknown>
): Promise<{ documentId: string; id: number }> {
  const response = await request.post(
    `${STRAPI_URL}/content-manager/collection-types/${contentType}`,
    {
      headers: { Authorization: `Bearer ${adminToken}` },
      data,
    }
  );
  if (!response.ok()) {
    const text = await response.text();
    throw new Error(`Create ${contentType} failed: ${response.status()} ${text}`);
  }
  const body = await response.json();
  return { documentId: body.data.documentId, id: body.data.id };
}

async function verifyViaContentManager(
  request: APIRequestContext,
  contentType: string,
  documentId: string,
  expectedFields: Record<string, unknown>
): Promise<void> {
  const response = await request.get(
    `${STRAPI_URL}/content-manager/collection-types/${contentType}/${documentId}`,
    { headers: { Authorization: `Bearer ${adminToken}` } }
  );
  expect(response.ok()).toBe(true);
  const body = await response.json();
  for (const [key, value] of Object.entries(expectedFields)) {
    expect(body.data[key]).toBe(value);
  }
}

test.describe('Strapi REST API 录入测试数据（真实后端）', () => {
  test.beforeAll(async ({ request }) => {
    const response = await request.post(`${STRAPI_URL}/admin/login`, {
      data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    });
    expect(response.ok()).toBe(true);
    const body = await response.json();
    adminToken = body.data.token;
  });

  test('创建测试 FAQ（政策分类）并通过 Admin API 验证', async ({ request }) => {
    const testQuestion = `测试FAQ-${Date.now()}：退费流程需要多长时间？`;
    const testAnswer = '退费申请提交后，校区审核通过将在7个工作日内退费至家长支付账户。这是通过 Strapi REST API 录入的测试数据。';

    const { documentId } = await createViaContentManager(request, 'api::faq-item.faq-item', {
      question: testQuestion,
      answer: testAnswer,
      category: 'policy',
      tags: '退费,流程',
      sortOrder: 99,
    });

    expect(documentId).toBeDefined();

    await verifyViaContentManager(request, 'api::faq-item.faq-item', documentId, {
      question: testQuestion,
      answer: testAnswer,
      category: 'policy',
    });
  });

  test('创建测试新闻文章并通过 Admin API 验证', async ({ request }) => {
    const testSlug = `yousen-news-test-${Date.now()}`;
    const testTitle = `测试新闻：佑森小课堂2026年暑期班圆满结业-${Date.now()}`;

    const { documentId } = await createViaContentManager(request, 'api::news-article.news-article', {
      title: testTitle,
      slug: testSlug,
      excerpt: '2026年暑期班圆满结业，孩子们收获满满。这是通过 Strapi REST API 录入的测试新闻。',
      content: '<p>2026年8月，佑森小课堂暑期班圆满结业。经过两个月的系统学习，孩子们在拼音、数学、英语等方面取得了显著进步。</p>',
      category: 'event_notice',
      isFeatured: false,
    });

    expect(documentId).toBeDefined();

    await verifyViaContentManager(request, 'api::news-article.news-article', documentId, {
      title: testTitle,
      slug: testSlug,
      category: 'event_notice',
    });
  });

  test('创建测试预约（Admin API）并通过 Admin API 验证', async ({ request }) => {
    const testPhone = `138${Date.now().toString().slice(-8)}`;

    const { documentId } = await createViaContentManager(request, 'api::appointment.appointment', {
      name: '测试家长',
      childName: '测试孩子',
      parentName: '测试家长',
      phone: testPhone,
      campus: 'yousen-baibuting',
      age: 6,
      course: 'language',
      preferredTimeSlot: 'morning',
      message: '通过 Strapi Admin REST API 创建的测试预约',
    });

    expect(documentId).toBeDefined();

    await verifyViaContentManager(request, 'api::appointment.appointment', documentId, {
      childName: '测试孩子',
      parentName: '测试家长',
      phone: testPhone,
      campus: 'yousen-baibuting',
      course: 'language',
    });
  });

  test('前端 FAQ 页面可访问', async ({ page }) => {
    const response = await page.goto(`${FRONTEND_URL}/faq`, {
      waitUntil: 'domcontentloaded',
      timeout: 15000,
    });
    if (response) {
      expect(response.status()).toBe(200);
    }
    await expect(page.locator('h1, h2').first()).toBeVisible();
  });
});
