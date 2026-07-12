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

  const content = `# ${settings?.name || '启航幼小教育'}

> ${settings?.slogan || '专注幼小衔接教育8年'}

## 关于我们
- 学校介绍: ${baseUrl}/about-school
- 办学理念: ${baseUrl}/about-philosophy
- 资质荣誉: ${baseUrl}/about-honors

## 课程体系
${products.map((p) => `- ${p.name}: ${baseUrl}/courses/${p.slug}`).join('\n')}

## 师资团队
- ${baseUrl}/teachers

## 常见问题
- ${baseUrl}/faq

## 联系方式
${settings?.phone ? `- 电话: ${settings.phone}` : ''}
${settings?.email ? `- 邮箱: ${settings.email}` : ''}
${settings?.address ? `- 地址: ${settings.address}` : ''}
`;

  return new Response(content, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 's-maxage=3600, stale-while-revalidate',
    },
  });
}
