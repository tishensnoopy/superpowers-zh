import { getSiteSettings, getProducts } from '@/lib/api';

export const revalidate = 3600;

export async function GET() {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

  const [settingsRes, productsRes] = await Promise.all([
    getSiteSettings().catch(() => ({ data: [] as never[] })),
    getProducts().catch(() => ({ data: [] as never[] })),
  ]);

  const settings = Array.isArray(settingsRes.data)
    ? settingsRes.data[0]
    : settingsRes.data;
  const products = productsRes.data;

  const content = `# ${settings?.name || '佑森小课堂'} (Yousen Education)

> ${settings?.slogan || '专注幼小衔接教育8年'} | Focus on preschool-primary transition education for 8 years

## 中文版 / Chinese Version
- 首页: ${baseUrl}
- 师资团队: ${baseUrl}/teachers
- 校区环境: ${baseUrl}/campuses
${products.map((p) => `- ${p.name}: ${baseUrl}/courses/${p.slug}`).join('\n')}
- 常见问题: ${baseUrl}/faq
- 退费政策: ${baseUrl}/refund-policy

## English Version
- Home: ${baseUrl}/en-US
- Teachers: ${baseUrl}/en-US/teachers
- Campuses: ${baseUrl}/en-US/campuses
${products.map((p) => `- ${p.name}: ${baseUrl}/en-US/courses/${p.slug}`).join('\n')}
- FAQ: ${baseUrl}/en-US/faq
- Refund Policy: ${baseUrl}/en-US/refund-policy

## Contact
${settings?.phone ? `- 电话/Phone: ${settings.phone}` : ''}
${settings?.email ? `- 邮箱/Email: ${settings.email}` : ''}
${settings?.address ? `- 地址/Address: ${settings.address}` : ''}
`;

  return new Response(content, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 's-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
