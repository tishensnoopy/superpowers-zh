import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs';

const cmsUrl = process.env.NEXT_PUBLIC_STRAPI_API_URL || 'http://localhost:1337';
const cmsParsedUrl = new URL(cmsUrl);

const nextConfig: NextConfig = {
  output: 'standalone',

  images: {
    remotePatterns: [
      {
        protocol: cmsParsedUrl.protocol.replace(':', '') as 'http' | 'https',
        hostname: cmsParsedUrl.hostname,
        port: cmsParsedUrl.port || undefined,
        pathname: '/uploads/**',
      },
    ],
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 3600,
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
};

const sentryConfig = {
  silent: true,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  hideSourceMaps: true,
  disableLogger: true,
};

const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

export default withSentryConfig(
  withBundleAnalyzer(nextConfig),
  sentryConfig
);
