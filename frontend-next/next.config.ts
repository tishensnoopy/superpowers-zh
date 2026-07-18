import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const cmsUrl = process.env.NEXT_PUBLIC_STRAPI_API_URL || 'http://localhost:1337';
// 相对路径（/api/strapi）走 rewrites 同源代理，无需 images.remotePatterns
const isRelativeCmsUrl = cmsUrl.startsWith('/');
const cmsParsedUrl = isRelativeCmsUrl ? null : new URL(cmsUrl);

const nextConfig: NextConfig = {
  output: 'standalone',

  images: {
    // Docker 容器内 /_next/image 代理无法访问 localhost:1337（localhost 指向容器自身）
    // 改用 unoptimized: true 让 <Image> 直接输出原始 URL，由浏览器直接请求 Strapi
    // 生产环境用 CDN 时这也是最佳实践
    unoptimized: true,
    remotePatterns: cmsParsedUrl
      ? [
          {
            protocol: cmsParsedUrl.protocol.replace(':', '') as 'http' | 'https',
            hostname: cmsParsedUrl.hostname,
            port: cmsParsedUrl.port || undefined,
            pathname: '/uploads/**',
          },
        ]
      : [],
  },

  async headers() {
    return [
      {
        source: '/_next/static/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        source: '/_next/image/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=86400, stale-while-revalidate=31536000' },
        ],
      },
      {
        source: '/llms.txt',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=3600, stale-while-revalidate=86400' },
        ],
      },
    ];
  },

  async redirects() {
    return [
      {
        source: '/team',
        destination: '/teachers',
        permanent: true,
      },
    ];
  },

  // 浏览器 → Next.js 同源代理 → Strapi
  // 让 NEXT_PUBLIC_STRAPI_API_URL 可配为相对路径 /api/strapi（无需暴露 1337 端口 / 无需 nginx）
  // 注意：rewrites 在构建时固化进 routes-manifest.json，运行时不重读环境变量，
  // 因此使用独立的 STRAPI_REWRITE_TARGET（默认 backend:1337，构建时传入运行时容器名）。
  async rewrites() {
    const backendUrl =
      process.env.STRAPI_REWRITE_TARGET ||
      process.env.STRAPI_API_URL_SSR ||
      'http://localhost:1337';
    return [
      {
        source: '/api/strapi/:path*',
        destination: `${backendUrl}/:path*`,
      },
      // Strapi 上传的图片：avatar.url 是相对路径 /uploads/...，浏览器走同源代理
      {
        source: '/uploads/:path*',
        destination: `${backendUrl}/uploads/:path*`,
      },
    ];
  },
};

const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

export default withBundleAnalyzer(withNextIntl(nextConfig));
