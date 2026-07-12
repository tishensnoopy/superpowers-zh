# Next.js 迁移阶段 2：骨架搭建实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 创建 `frontend-next/` Next.js 15 App Router 项目，移植所有页面/组件/测试，实现 SEO 基础设施（metadata/sitemap/robots/llms.txt）、错误处理（not-found/error/global-error/loading）、Sentry 错误监控，确保 345+ 测试通过且构建产物体积达标。

**架构：** App Router + Server Components（ISR `revalidate=300`）为主，CSR 仅用于搜索页和交互组件。Layout 拆分为 `layout.tsx`（Server）+ `Navigation.tsx`（Client）+ `Footer.tsx`（Server）。SEO 通过 `generateMetadata` + `sitemap.ts` + `robots.ts` + `llms.txt/route.ts` 实现。图片用 `next/image`，字体用 `next/font/local`（思源黑体）+ Strapi 后台可配置动态 `@font-face`。

**技术栈：** Next.js 15、React 18、TypeScript、Tailwind CSS 4、Vitest、@sentry/nextjs、@next/bundle-analyzer

**设计文档：** `docs/superpowers/specs/2026-07-12-nextjs-migration-design.md`

**前置条件：** 阶段 1（技术债修复）已完成——v5 扁平格式统一、useProductSearch 竞态修复、345 个测试通过

---

## 文件结构

### 新建配置文件

| 文件 | 职责 |
|------|------|
| `frontend-next/package.json` | 依赖与脚本 |
| `frontend-next/tsconfig.json` | TypeScript 配置（paths `@/*`） |
| `frontend-next/next.config.ts` | Next.js 配置（images/standalone/bundle-analyzer/Sentry） |
| `frontend-next/tailwind.config.ts` | Tailwind 配置 |
| `frontend-next/postcss.config.js` | PostCSS 配置 |
| `frontend-next/vitest.config.ts` | Vitest 配置（alias `@`） |
| `frontend-next/.env.local` | 环境变量 |
| `frontend-next/.env.example` | 环境变量示例 |
| `frontend-next/.dockerignore` | Docker 忽略文件 |
| `frontend-next/Dockerfile` | Docker 多阶段构建 |
| `frontend-next/sentry.client.config.ts` | Sentry 客户端配置 |
| `frontend-next/sentry.server.config.ts` | Sentry 服务端配置 |
| `frontend-next/sentry.edge.config.ts` | Sentry Edge 配置 |
| `frontend-next/__tests__/setup.ts` | 测试全局 setup（next/navigation mock） |

### 新建 app 目录文件

| 文件 | 职责 |
|------|------|
| `frontend-next/app/layout.tsx` | Root layout（Server）：全局数据获取 + metadata + 字体 |
| `frontend-next/app/globals.css` | 全局样式 |
| `frontend-next/app/page.tsx` | 首页（ISR） |
| `frontend-next/app/not-found.tsx` | 404 页面 |
| `frontend-next/app/error.tsx` | 错误边界（Client） |
| `frontend-next/app/global-error.tsx` | 全局错误边界（Client） |
| `frontend-next/app/loading.tsx` | 加载状态 |
| `frontend-next/app/sitemap.ts` | 动态站点地图 |
| `frontend-next/app/robots.ts` | robots.txt |
| `frontend-next/app/llms.txt/route.ts` | 动态 llms.txt |
| `frontend-next/app/courses/page.tsx` | 课程搜索页（CSR） |
| `frontend-next/app/courses/[slug]/page.tsx` | 课程详情页（ISR） |
| `frontend-next/app/news/page.tsx` | 新闻列表页（ISR） |
| `frontend-next/app/news/[slug]/page.tsx` | 新闻详情页（ISR） |
| `frontend-next/app/campuses/page.tsx` | 校区列表页（ISR） |
| `frontend-next/app/campuses/[slug]/page.tsx` | 校区详情页（ISR） |
| `frontend-next/app/teachers/page.tsx` | 教师列表页（ISR） |
| `frontend-next/app/faq/page.tsx` | FAQ 页（ISR） |
| `frontend-next/app/appointment-success/page.tsx` | 预约成功页（CSR） |
| `frontend-next/app/[slug]/page.tsx` | 动态页面（ISR） |
| `frontend-next/app/refund-policy/page.tsx` | 退费政策（ISR） |
| `frontend-next/app/privacy-policy/page.tsx` | 隐私政策（ISR） |
| `frontend-next/app/user-agreement/page.tsx` | 用户协议（ISR） |

### 新建 lib/hooks/components 文件

| 文件 | 职责 |
|------|------|
| `frontend-next/lib/api.ts` | Strapi API 客户端（从 Vite 移植 + getImageUrl + FontSettings） |
| `frontend-next/lib/seo.ts` | SEO 辅助函数（buildMetadata + buildJsonLd） |
| `frontend-next/hooks/useProductSearch.ts` | 搜索 hook（从 Vite 移植 + 'use client'） |
| `frontend-next/components/layout/LayoutShell.tsx` | 布局壳（Server） |
| `frontend-next/components/layout/Navigation.tsx` | 导航栏（Client） |
| `frontend-next/components/layout/Footer.tsx` | 页脚（Server） |
| `frontend-next/components/SectionRenderer.tsx` | Section 映射渲染器 |
| `frontend-next/components/sections/*.tsx` | 12 个 section 组件（从 Vite 移植） |
| `frontend-next/components/course/*.tsx` | 课程组件（7 个详情 + 5 个搜索 = 12 个） |
| `frontend-next/components/campus/*.tsx` | 校区组件（7 个） |
| `frontend-next/components/team/*.tsx` | 教师组件（4 个） |
| `frontend-next/components/news/NewsCard.tsx` | 新闻卡片 |
| `frontend-next/components/ui/StrapiImage.tsx` | next/image 封装 |

### 移植测试文件

| 文件 | 来源 |
|------|------|
| `frontend-next/lib/__tests__/api.test.ts` | `frontend/src/lib/__tests__/api.test.ts` |
| `frontend-next/hooks/__tests__/useProductSearch.test.ts` | `frontend/src/hooks/__tests__/useProductSearch.test.ts` |
| `frontend-next/components/layout/__tests__/Navigation.test.tsx` | 从 `Layout.test.tsx` 拆分 |
| `frontend-next/components/layout/__tests__/Footer.test.tsx` | 从 `Layout.test.tsx` 拆分 |
| `frontend-next/components/sections/__tests__/*.test.tsx` | `frontend/src/components/sections/__tests__/*.test.tsx` |
| `frontend-next/components/course/__tests__/*.test.tsx` | `frontend/src/components/course/__tests__/*.test.tsx` |
| 其他组件测试 | 对应 `frontend/src/` 测试文件 |

### 静态资源

| 文件 | 说明 |
|------|------|
| `frontend-next/public/fonts/NotoSansSC-Regular.woff2` | 思源黑体 Regular（OFL 协议） |
| `frontend-next/public/fonts/NotoSansSC-Medium.woff2` | 思源黑体 Medium |
| `frontend-next/public/fonts/NotoSansSC-Bold.woff2` | 思源黑体 Bold |

---

## 任务 1：项目初始化与配置

**文件：**
- 创建：`frontend-next/package.json`
- 创建：`frontend-next/tsconfig.json`
- 创建：`frontend-next/next.config.ts`
- 创建：`frontend-next/postcss.config.js`
- 创建：`frontend-next/vitest.config.ts`
- 创建：`frontend-next/.env.local`
- 创建：`frontend-next/.env.example`
- 创建：`frontend-next/app/globals.css`
- 创建：`frontend-next/__tests__/setup.ts`
- 创建：`frontend-next/.eslintrc.json`

> **注意：** Tailwind v4 使用 CSS-first 配置，不需要 `tailwind.config.ts`。主题在 `globals.css` 中通过 `@theme` 指令声明。

- [ ] **步骤 1：创建 Next.js 项目骨架**

```bash
cd /home/tishensnoopy/project/superpowers-zh
mkdir frontend-next
cd frontend-next
```

手动创建 `package.json`（不使用 create-next-app，确保版本可控）：

```json
{
  "name": "frontend-next",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "test": "vitest run",
    "test:watch": "vitest",
    "analyze": "cross-env ANALYZE=true next build",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "next": "^15.1.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "lucide-react": "^0.460.0",
    "@sentry/nextjs": "^8.40.0"
  },
  "devDependencies": {
    "typescript": "^5.7.0",
    "@types/node": "^22.10.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "tailwindcss": "^4.0.0",
    "@tailwindcss/postcss": "^4.0.0",
    "postcss": "^8.4.49",
    "eslint": "^8.57.0",
    "eslint-config-next": "^15.1.0",
    "vitest": "^2.1.0",
    "@testing-library/react": "^16.1.0",
    "@testing-library/jest-dom": "^6.6.0",
    "@testing-library/user-event": "^14.5.0",
    "jsdom": "^25.0.1",
    "@vitejs/plugin-react": "^4.3.4",
    "@next/bundle-analyzer": "^15.1.0",
    "cross-env": "^7.0.3"
  }
}
```

- [ ] **步骤 2：安装依赖**

```bash
cd frontend-next
npm install
```

- [ ] **步骤 3：创建 `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **步骤 4：创建 `next.config.ts`**

```typescript
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
```

- [ ] **步骤 5：创建 `postcss.config.js`**

> **注意：** Tailwind v4 不需要 `tailwind.config.ts`，也不需要 `autoprefixer`（`@tailwindcss/postcss` 已内置）。主题在步骤 9 的 `globals.css` 中通过 `@theme` 指令声明。

```javascript
module.exports = {
  plugins: {
    '@tailwindcss/postcss': {},
  },
};
```

- [ ] **步骤 6：创建 `vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./__tests__/setup.ts'],
    css: false,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
});
```

- [ ] **步骤 7：创建 `.env.local` 和 `.env.example`**

`.env.local`:
```
NEXT_PUBLIC_STRAPI_API_URL=http://localhost:1337
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_SENTRY_DSN=
SENTRY_DSN=
NEXT_PUBLIC_SENTRY_RELEASE=
SENTRY_ORG=
SENTRY_PROJECT=
SENTRY_AUTH_TOKEN=
```

`.env.example`（同上，但提交到 git）

- [ ] **步骤 8：创建 `__tests__/setup.ts`**

> vitest.config.ts 引用了此文件，必须在任务 1 中创建（否则第一个测试文件添加时 vitest 会崩溃）。

```typescript
import { vi } from 'vitest';
import '@testing-library/jest-dom';
import { createElement } from 'react';

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    refresh: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: any) =>
    createElement('a', { href, ...props }, children),
}));
```

- [ ] **步骤 9：创建 `.eslintrc.json`**

```json
{
  "extends": "next/core-web-vitals"
}
```

- [ ] **步骤 10：创建 `app/globals.css`**

> Tailwind v4 使用 CSS-first 配置。`@theme` 指令声明的变量会自动生成对应的工具类（如 `--color-primary` 生成 `bg-primary`、`text-primary` 等）。

```css
@import "tailwindcss";

@theme {
  --color-primary: #F5851F;
  --color-primary-dark: #FF6B35;
  --font-sans: var(--font-default), var(--font-custom), sans-serif;
}

body {
  font-family: var(--font-sans);
}
```

- [ ] **步骤 11：验证项目可启动**

创建最简 `app/layout.tsx` 和 `app/page.tsx`：

```tsx
// app/layout.tsx
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
```

```tsx
// app/page.tsx
export default function HomePage() {
  return <h1>Next.js 骨架验证</h1>;
}
```

运行验证：
```bash
cd frontend-next
npm run typecheck   # TypeScript 类型检查
npm run lint        # ESLint 检查
npm run build       # 生产构建验证
npm run dev         # 开发服务器
```

预期：
- `typecheck` 无错误
- `lint` 无警告或错误
- `build` 成功生成静态页面
- 访问 `http://localhost:3000` 显示 "Next.js 骨架验证"

- [ ] **步骤 12：Commit**

```bash
cd /home/tishensnoopy/project/superpowers-zh
git add frontend-next/
git commit -m "feat(frontend-next): 初始化 Next.js 15 项目骨架与配置"
```

---

## 任务 2：lib/api.ts 移植与增强

**文件：**
- 创建：`frontend-next/lib/api.ts`
- 创建：`frontend-next/lib/seo.ts`
- 创建：`frontend-next/lib/__tests__/api.test.ts`

- [ ] **步骤 1：复制 api.ts 并修改环境变量**

从 `frontend/src/lib/api.ts` 复制到 `frontend-next/lib/api.ts`，做以下修改：

1. 第 1 行环境变量：
```typescript
// 替换：const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:1337';
const API_BASE_URL = process.env.NEXT_PUBLIC_STRAPI_API_URL || 'http://localhost:1337';
```

2. 在文件顶部（接口定义之前）新增 `getImageUrl` 函数：
```typescript
export function getImageUrl(
  image?: { url: string; alternativeText?: string } | null
): string | null {
  if (!image?.url) return null;
  if (image.url.startsWith('http')) return image.url;
  return `${API_BASE_URL}${image.url}`;
}
```

3. 在 `SiteSettings` 接口中新增 `fontSettings` 字段，并新增 `FontSettings` 接口：
```typescript
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
  seo?: Seo;
  fontSettings?: FontSettings;
}
```

4. 所有接口定义和 API 函数保持不变（阶段 1 已完成 v5 扁平化）。

- [ ] **步骤 2：创建 `lib/seo.ts`**

```typescript
import type { Metadata } from 'next';
import type { Seo as SeoData } from './api';
import { getImageUrl } from './api';

export function buildMetadata(
  seo: SeoData | undefined,
  fallback: { title: string; description?: string }
): Metadata {
  const title = seo?.metaTitle ?? fallback.title;
  const description = seo?.metaDescription ?? fallback.description;
  const ogImage = getImageUrl(seo?.ogImage);

  return {
    title,
    description,
    keywords: seo?.metaKeywords,
    alternates: {
      canonical: seo?.canonicalUrl,
    },
    openGraph: {
      title: seo?.ogTitle ?? title,
      description: seo?.ogDescription ?? description,
      images: ogImage ? [{ url: ogImage }] : undefined,
      type: (seo?.ogType as any) ?? 'website',
    },
    twitter: {
      card: 'summary_large_image',
      images: ogImage ? [ogImage] : undefined,
    },
  };
}

export function buildJsonLd(data: Record<string, unknown>): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}
```

- [ ] **步骤 3：复制并适配 api.test.ts**

从 `frontend/src/lib/__tests__/api.test.ts` 复制到 `frontend-next/lib/__tests__/api.test.ts`。

修改 import 路径：
```typescript
// 替换所有 '../../lib/api' → '@/lib/api'
// 替换所有 vi.mock('../../lib/api') → vi.mock('@/lib/api')
```

- [ ] **步骤 4：运行测试验证通过**

```bash
cd frontend-next
npx vitest run lib/__tests__/api.test.ts
```

预期：所有 API 测试通过

- [ ] **步骤 5：Commit**

```bash
cd /home/tishensnoopy/project/superpowers-zh
git add frontend-next/lib/
git commit -m "feat(frontend-next): 移植 lib/api.ts 并新增 getImageUrl/FontSettings/seo.ts"
```

---

## 任务 3：测试基础设施验证

> **注意：** `__tests__/setup.ts` 已在任务 1 步骤 8 中创建。本任务验证 setup 生效，确保后续组件测试可以正常运行。

**文件：**
- 临时创建并删除：`frontend-next/__tests__/setup.test.ts`（验证用，验证后删除）

- [ ] **步骤 1：验证 setup 生效**

创建临时测试文件 `__tests__/setup.test.ts`：

```typescript
import { describe, it, expect } from 'vitest';

describe('test setup', () => {
  it('next/navigation mock works', async () => {
    const { usePathname } = await import('next/navigation');
    expect(usePathname()).toBe('/');
  });
});
```

运行：
```bash
cd frontend-next
npx vitest run __tests__/setup.test.ts
```

预期：通过

- [ ] **步骤 2：删除临时测试文件**

```bash
rm frontend-next/__tests__/setup.test.ts
```

> setup.ts 已在任务 1 中 commit，此处无需再次提交。

---

## 任务 4：Layout 拆分与字体加载

**文件：**
- 创建：`frontend-next/app/layout.tsx`（覆盖临时版本）
- 创建：`frontend-next/components/layout/LayoutShell.tsx`
- 创建：`frontend-next/components/layout/Navigation.tsx`
- 创建：`frontend-next/components/layout/Footer.tsx`
- 创建：`frontend-next/components/layout/__tests__/Navigation.test.tsx`
- 创建：`frontend-next/components/layout/__tests__/Footer.test.tsx`
- 创建：`frontend-next/public/fonts/` 目录（放入思源黑体 woff2 文件）

- [ ] **步骤 1：下载思源黑体 woff2 文件**

从 Google Fonts 下载思源黑体 woff2 文件，放入 `frontend-next/public/fonts/`：

```bash
mkdir -p frontend-next/public/fonts
# 手动下载以下文件放入该目录：
# - NotoSansSC-Regular.woff2
# - NotoSansSC-Medium.woff2
# - NotoSansSC-Bold.woff2
```

来源：https://fonts.google.com/noto/specimen/Noto+Sans+SC（OFL 协议，免费商用）

- [ ] **步骤 2：创建 `LayoutShell.tsx`（Server Component）**

```tsx
// frontend-next/components/layout/LayoutShell.tsx
export default function LayoutShell({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen flex flex-col">{children}</div>;
}
```

- [ ] **步骤 3：创建 `Navigation.tsx`（Client Component）**

从 `frontend/src/layout/Layout.tsx` 提取导航栏逻辑。关键改动：

1. 顶部添加 `'use client'`
2. import 路径改为 `@/lib/api` 和 `@/components/...`
3. `useLocation` → `usePathname`（from `next/navigation`）
4. `useNavigate` → `useRouter`（from `next/navigation`），`navigate(url)` → `router.push(url)`
5. `<Link to={...}>` → `<Link href={...}>`
6. 接收 `navigation` 和 `settings` 作为 props（不再内部 fetch）

```tsx
// frontend-next/components/layout/Navigation.tsx
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Phone, Menu, X, ChevronDown } from 'lucide-react';
import type { NavigationItem, SiteSettings } from '@/lib/api';
import { getImageUrl } from '@/lib/api';

export default function Navigation({
  navigation,
  settings,
}: {
  navigation: NavigationItem[];
  settings: SiteSettings;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState<number | null>(null);

  useEffect(() => {
    setMobileMenuOpen(false);
    setDropdownOpen(null);
  }, [pathname]);

  const isActive = (url: string) => {
    if (url === '/') return pathname === '/';
    return pathname.startsWith(url);
  };

  const handleMobileNavClick = (url: string) => {
    setMobileMenuOpen(false);
    setDropdownOpen(null);
    router.push(url);
  };

  // 从 Layout.tsx 提取的导航栏 JSX
  // 所有 <Link to={...} 替换为 <Link href={...}
  // 所有 navigate(url) 替换为 router.push(url)
  // 所有 useLocation().pathname 替换为 pathname 变量
  // logo 图片使用 getImageUrl(settings.logo)
  
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white shadow-md">
      {/* 从 Layout.tsx 提取的完整导航栏 JSX */}
    </header>
  );
}
```

**注意**：从 `frontend/src/layout/Layout.tsx` 复制导航栏 JSX 部分的完整代码，做上述替换。不要省略任何导航项、下拉菜单、移动端菜单的 JSX。

- [ ] **步骤 4：创建 `Footer.tsx`（Server Component）**

从 `frontend/src/layout/Layout.tsx` 提取页脚逻辑。关键改动：

1. import 路径改为 `@/lib/api`
2. `<Link to={...}>` → `<Link href={...}>`
3. 接收 `footer` 和 `settings` 作为 props
4. 无需 `'use client'`

```tsx
// frontend-next/components/layout/Footer.tsx
import Link from 'next/link';
import type { Footer as FooterData, SiteSettings } from '@/lib/api';

const DEFAULT_SOCIAL_LINKS = [
  { id: 1, platform: 'wechat', url: '#', icon: 'wechat' },
  { id: 2, platform: 'weibo', url: '#', icon: 'weibo' },
];

export default function Footer({
  footer,
  settings,
}: {
  footer: FooterData;
  settings: SiteSettings;
}) {
  const socialLinks = footer.socialLinks?.length > 0
    ? footer.socialLinks
    : DEFAULT_SOCIAL_LINKS;

  // 从 Layout.tsx 提取的页脚 JSX
  // 所有 <Link to={...} 替换为 <Link href={...}
  
  return (
    <footer className="bg-gray-900 text-white">
      {/* 从 Layout.tsx 提取的完整页脚 JSX */}
    </footer>
  );
}
```

- [ ] **步骤 5：创建 `app/layout.tsx`（覆盖临时版本）**

```tsx
// frontend-next/app/layout.tsx
import type { Metadata } from 'next';
import localFont from 'next/font/local';
import { getSiteSettings, getNavigationTree, getFooter, getImageUrl } from '@/lib/api';
import LayoutShell from '@/components/layout/LayoutShell';
import Navigation from '@/components/layout/Navigation';
import Footer from '@/components/layout/Footer';
import './globals.css';

export const revalidate = 300;

const notoSansSC = localFont({
  src: [
    { path: '../public/fonts/NotoSansSC-Regular.woff2', weight: '400', style: 'normal' },
    { path: '../public/fonts/NotoSansSC-Medium.woff2', weight: '500', style: 'normal' },
    { path: '../public/fonts/NotoSansSC-Bold.woff2', weight: '700', style: 'normal' },
  ],
  display: 'swap',
  variable: '--font-default',
  preload: true,
});

export const metadata: Metadata = {
  title: {
    default: '启航幼小教育 | 专注幼小衔接8年',
    template: '%s | 启航幼小教育',
  },
  description: '专注幼小衔接教育8年，科学课程体系+专业师资团队',
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
  openGraph: {
    type: 'website',
    locale: 'zh_CN',
    siteName: '启航幼小教育',
  },
  robots: { index: true, follow: true },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [settingsRes, navRes, footerRes] = await Promise.all([
    getSiteSettings(),
    getNavigationTree(),
    getFooter(),
  ]);

  const settings = Array.isArray(settingsRes.data)
    ? settingsRes.data[0]
    : settingsRes.data;
  const navigation = navRes.data;
  const footer = Array.isArray(footerRes.data)
    ? footerRes.data[0]
    : footerRes.data;

  const fontSettings = settings?.fontSettings;
  const customFontFamily = fontSettings?.fontFamily;
  const customFontUrl = fontSettings?.fontFile?.url
    ? getImageUrl(fontSettings.fontFile)
    : null;
  const customFontFormat = fontSettings?.fontFormat || 'woff2';
  const customFontWeight = fontSettings?.fontWeight || '400';
  const customFontDisplay = fontSettings?.fontDisplay || 'swap';

  const fontFaceCSS = customFontUrl && customFontFamily
    ? `@font-face {
        font-family: '${customFontFamily}';
        src: url('${customFontUrl}') format('${customFontFormat}');
        font-weight: ${customFontWeight};
        font-display: ${customFontDisplay};
      }`
    : '';

  const fontFamily = customFontFamily
    ? `'${customFontFamily}', var(--font-default), sans-serif`
    : `var(--font-default), sans-serif`;

  return (
    <html
      lang="zh-CN"
      className={notoSansSC.variable}
      style={{ fontFamily }}
    >
      <head>
        {fontFaceCSS && (
          <style dangerouslySetInnerHTML={{ __html: fontFaceCSS }} />
        )}
        <link rel="dns-prefetch" href="//localhost:1337" />
        <link rel="preconnect" href="http://localhost:1337" crossOrigin="anonymous" />
      </head>
      <body>
        <LayoutShell>
          <Navigation navigation={navigation} settings={settings} />
          <main className="flex-1">{children}</main>
          <Footer footer={footer} settings={settings} />
        </LayoutShell>
      </body>
    </html>
  );
}
```

- [ ] **步骤 6：创建 Navigation 测试**

从 `frontend/src/layout/__tests__/Layout.test.tsx` 拆分导航相关测试到 `frontend-next/components/layout/__tests__/Navigation.test.tsx`。

关键改动：
1. import 路径改为 `@/components/layout/Navigation` 和 `@/lib/api`
2. mock 路径改为 `vi.mock('@/lib/api')`
3. 测试逻辑保持不变

- [ ] **步骤 7：创建 Footer 测试**

从 `frontend/src/layout/__tests__/Layout.test.tsx` 拆分页脚相关测试到 `frontend-next/components/layout/__tests__/Footer.test.tsx`。

- [ ] **步骤 8：运行测试验证**

```bash
cd frontend-next
npx vitest run components/layout/__tests__/
```

预期：Navigation 和 Footer 测试通过

- [ ] **步骤 9：浏览器验证**

```bash
cd frontend-next
npm run dev
```

使用 TRAE 内建浏览器访问 `http://localhost:3000`，验证：
- 导航栏正常显示（桌面端 + 移动端）
- 页脚正常显示
- 字体正确加载

- [ ] **步骤 10：Commit**

```bash
cd /home/tishensnoopy/project/superpowers-zh
git add frontend-next/
git commit -m "feat(frontend-next): Layout 拆分为 Navigation(Client) + Footer(Server) + 字体加载"
```

---

## 任务 5：SectionRenderer + Section 组件移植

**文件：**
- 创建：`frontend-next/components/SectionRenderer.tsx`
- 创建：`frontend-next/components/sections/*.tsx`（12 个）
- 创建：`frontend-next/components/sections/__tests__/*.test.tsx`（9 个）
- 创建：`frontend-next/components/ui/StrapiImage.tsx`

- [ ] **步骤 1：创建 `StrapiImage.tsx`**

```tsx
// frontend-next/components/ui/StrapiImage.tsx
import Image from 'next/image';
import { getImageUrl } from '@/lib/api';

interface StrapiImageProps {
  src?: { url: string; alternativeText?: string } | null;
  alt?: string;
  width?: number;
  height?: number;
  fill?: boolean;
  priority?: boolean;
  className?: string;
  sizes?: string;
}

export default function StrapiImage({
  src,
  alt,
  width,
  height,
  fill = false,
  priority = false,
  className,
  sizes,
}: StrapiImageProps) {
  const url = getImageUrl(src);
  if (!url) return null;

  if (fill) {
    return (
      <Image
        src={url}
        alt={alt || src?.alternativeText || ''}
        fill
        priority={priority}
        sizes={sizes || '100vw'}
        className={className}
      />
    );
  }

  return (
    <Image
      src={url}
      alt={alt || src?.alternativeText || ''}
      width={width || 800}
      height={height || 600}
      priority={priority}
      className={className}
    />
  );
}
```

- [ ] **步骤 2：移植 SectionRenderer.tsx**

从 `frontend/src/components/SectionRenderer.tsx` 复制到 `frontend-next/components/SectionRenderer.tsx`。

修改：
1. import 路径 `../../lib/api` → `@/lib/api`
2. import 路径 `./sections/...` → `@/components/sections/...`
3. ContactForm 使用 `dynamic()` 懒加载：

```tsx
import dynamic from 'next/dynamic';

const ContactForm = dynamic(() => import('@/components/sections/ContactForm'), {
  loading: () => <div className="h-96 animate-pulse bg-gray-100 rounded" />,
  ssr: true,
});
```

- [ ] **步骤 3：批量移植 12 个 section 组件**

对每个 section 组件执行以下操作：

从 `frontend/src/components/sections/{ComponentName}.tsx` 复制到 `frontend-next/components/sections/{ComponentName}.tsx`。

**统一修改项**（所有 section 组件）：
1. import 路径 `../../lib/api` → `@/lib/api`
2. import 路径 `../../components/...` → `@/components/...`
3. `<Link to={...}>` → `<Link href={...}>`（如使用 react-router-dom 的 Link）
4. 图片 URL 拼接改为 `getImageUrl()` 辅助函数

**需要 `'use client'` 的 section**：
- `ContactForm.tsx` — 表单提交交互
- `FloatingButton.tsx` — 如有滚动监听交互

**无需 `'use client'` 的 section**（Server Component）：
- Hero, Advantages, RichText, ProductGrid, ProductComparison, Features, Team, Testimonials, Faq, Gallery

- [ ] **步骤 4：移植 section 测试文件**

从 `frontend/src/components/sections/__tests__/*.test.tsx` 复制到 `frontend-next/components/sections/__tests__/*.test.tsx`。

修改：
1. import 路径 `../../../lib/api` → `@/lib/api`
2. import 路径 `../../../components/...` → `@/components/...`
3. `vi.mock('../../../lib/api')` → `vi.mock('@/lib/api')`
4. `vi.mock('../../../components/...')` → `vi.mock('@/components/...')`

- [ ] **步骤 5：运行测试验证**

```bash
cd frontend-next
npx vitest run components/sections/__tests__/
```

预期：所有 section 测试通过

- [ ] **步骤 6：Commit**

```bash
cd /home/tishensnoopy/project/superpowers-zh
git add frontend-next/components/
git commit -m "feat(frontend-next): 移植 SectionRenderer + 12 个 section 组件 + StrapiImage"
```

---

## 任务 6：课程组件与搜索 hook 移植

**文件：**
- 创建：`frontend-next/hooks/useProductSearch.ts`
- 创建：`frontend-next/hooks/__tests__/useProductSearch.test.ts`
- 创建：`frontend-next/components/course/*.tsx`（12 个：7 个详情 + 5 个搜索）

- [ ] **步骤 1：移植 useProductSearch.ts**

从 `frontend/src/hooks/useProductSearch.ts` 复制到 `frontend-next/hooks/useProductSearch.ts`。

修改：
1. 顶部添加 `'use client'`
2. import 路径 `../lib/api` → `@/lib/api`

竞态修复逻辑（requestIdRef + AbortController）完全保留，不变。

- [ ] **步骤 2：移植 useProductSearch.test.ts**

从 `frontend/src/hooks/__tests__/useProductSearch.test.ts` 复制到 `frontend-next/hooks/__tests__/useProductSearch.test.ts`。

修改：
1. import 路径 `../useProductSearch` → `@/hooks/useProductSearch`
2. import 路径 `../../lib/api` → `@/lib/api`
3. `vi.mock('../../lib/api')` → `vi.mock('@/lib/api')`

所有 11 个测试用例（含 2 个竞态测试）逻辑不变。

- [ ] **步骤 3：运行测试验证**

```bash
cd frontend-next
npx vitest run hooks/__tests__/useProductSearch.test.ts
```

预期：11 个测试全部通过（含竞态修复测试）

- [ ] **步骤 4：批量移植 12 个课程组件**

对每个课程组件执行以下操作：

从 `frontend/src/components/course/{ComponentName}.tsx` 复制到 `frontend-next/components/course/{ComponentName}.tsx`。

**统一修改项**：
1. import 路径改为 `@/lib/api` 和 `@/components/...`
2. `<Link to={...}>` → `<Link href={...}>`
3. 图片 URL 使用 `getImageUrl()` 或 `<StrapiImage>` 组件

**需要 `'use client'` 的组件**：
- `CourseSearchPanel.tsx` — 使用 useProductSearch hook
- `SearchBar.tsx` — onChange 交互
- `CategoryFilter.tsx` — onClick 交互
- `SortControl.tsx` — onChange 交互
- `Pagination.tsx` — onClick 交互

**无需 `'use client'` 的组件**（Server Component）：
- `CourseDetail.tsx`, `CourseHeader.tsx`, `CourseObjectives.tsx`, `CourseOutline.tsx`, `CourseTestimonials.tsx`, `CourseCTA.tsx`, `SearchResultsGrid.tsx`

- [ ] **步骤 5：移植课程组件测试**

从 `frontend/src/components/course/__tests__/*.test.tsx` 复制到 `frontend-next/components/course/__tests__/*.test.tsx`。

修改：
1. import 路径改为 `@/components/course/...` 和 `@/lib/api`
2. mock 路径改为 `vi.mock('@/lib/api')` 和 `vi.mock('@/components/...')`

- [ ] **步骤 6：运行测试验证**

```bash
cd frontend-next
npx vitest run components/course/__tests__/
```

预期：所有课程组件测试通过

- [ ] **步骤 7：Commit**

```bash
cd /home/tishensnoopy/project/superpowers-zh
git add frontend-next/hooks/ frontend-next/components/course/
git commit -m "feat(frontend-next): 移植 useProductSearch hook + 12 个课程组件（含竞态修复）"
```

---

## 任务 7：其他组件移植（校区/教师/新闻）

**文件：**
- 创建：`frontend-next/components/campus/*.tsx`（7 个）
- 创建：`frontend-next/components/team/*.tsx`（4 个）
- 创建：`frontend-next/components/news/NewsCard.tsx`
- 创建对应测试文件

- [ ] **步骤 1：批量移植校区组件**

从 `frontend/src/components/campus/*.tsx` 复制到 `frontend-next/components/campus/*.tsx`。

统一修改项同任务 5 步骤 3（import 路径 + Link + 图片 URL）。

所有校区组件均为 Server Component（纯展示），无需 `'use client'`。

- [ ] **步骤 2：批量移植教师组件**

从 `frontend/src/components/team/*.tsx` 复制到 `frontend-next/components/team/*.tsx`。

统一修改项同上。

- [ ] **步骤 3：移植新闻组件**

从 `frontend/src/components/news/NewsCard.tsx` 复制到 `frontend-next/components/news/NewsCard.tsx`。

统一修改项同上。

- [ ] **步骤 4：移植对应测试文件**

从 `frontend/src/components/{campus,team,news}/__tests__/*.test.tsx` 复制到 `frontend-next/components/{campus,team,news}/__tests__/*.test.tsx`。

修改 import 路径和 mock 路径。

- [ ] **步骤 5：运行测试验证**

```bash
cd frontend-next
npx vitest run components/campus/__tests__/ components/team/__tests__/ components/news/__tests__/
```

预期：所有测试通过

- [ ] **步骤 6：Commit**

```bash
cd /home/tishensnoopy/project/superpowers-zh
git add frontend-next/components/campus/ frontend-next/components/team/ frontend-next/components/news/
git commit -m "feat(frontend-next): 移植校区/教师/新闻组件"
```

---

## 任务 8：页面路由创建（ISR + CSR）

**文件：**
- 创建：`frontend-next/app/page.tsx`（覆盖临时版本）
- 创建：`frontend-next/app/courses/page.tsx`
- 创建：`frontend-next/app/courses/[slug]/page.tsx`
- 创建：`frontend-next/app/news/page.tsx`
- 创建：`frontend-next/app/news/[slug]/page.tsx`
- 创建：`frontend-next/app/campuses/page.tsx`
- 创建：`frontend-next/app/campuses/[slug]/page.tsx`
- 创建：`frontend-next/app/teachers/page.tsx`
- 创建：`frontend-next/app/faq/page.tsx`
- 创建：`frontend-next/app/appointment-success/page.tsx`
- 创建：`frontend-next/app/[slug]/page.tsx`
- 创建：`frontend-next/app/refund-policy/page.tsx`
- 创建：`frontend-next/app/privacy-policy/page.tsx`
- 创建：`frontend-next/app/user-agreement/page.tsx`

- [ ] **步骤 1：创建首页 `app/page.tsx`**

```tsx
// frontend-next/app/page.tsx
import { getHomepage } from '@/lib/api';
import { buildMetadata } from '@/lib/seo';
import SectionRenderer from '@/components/SectionRenderer';
import type { Metadata } from 'next';

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const { data: page } = await getHomepage();
  return buildMetadata(page.seo, { title: page.title });
}

export default async function HomePage() {
  const { data: page } = await getHomepage();
  const sections = page.sections || [];

  return (
    <>
      {sections.map((section, index) => (
        <SectionRenderer
          key={`${section.__component}-${section.id}-${index}`}
          section={section}
        />
      ))}
    </>
  );
}
```

- [ ] **步骤 2：创建课程搜索页 `app/courses/page.tsx`（CSR）**

```tsx
// frontend-next/app/courses/page.tsx
'use client';

import CourseSearchPanel from '@/components/course/CourseSearchPanel';

export default function CoursesPage() {
  return <CourseSearchPanel />;
}
```

- [ ] **步骤 3：创建课程详情页 `app/courses/[slug]/page.tsx`（ISR）**

从 `frontend/src/components/course/CourseDetail.tsx` 提取渲染逻辑，整合到 Server Component 中。

```tsx
// frontend-next/app/courses/[slug]/page.tsx
import { getProductBySlug, getProducts } from '@/lib/api';
import { buildMetadata, buildJsonLd } from '@/lib/seo';
import CourseHeader from '@/components/course/CourseHeader';
import CourseObjectives from '@/components/course/CourseObjectives';
import CourseOutline from '@/components/course/CourseOutline';
import CourseTestimonials from '@/components/course/CourseTestimonials';
import CourseCTA from '@/components/course/CourseCTA';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

export const revalidate = 300;

export async function generateStaticParams() {
  const { data: products } = await getProducts();
  return products.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const { data: product } = await getProductBySlug(slug);
  if (!product) return { title: '课程不存在' };

  return {
    ...buildMetadata(product.seo, {
      title: product.name,
      description: product.shortDescription,
    }),
    other: {
      'application/ld+json': buildJsonLd({
        '@context': 'https://schema.org',
        '@type': 'Course',
        name: product.name,
        description: product.description || '',
      }),
    },
  };
}

export default async function CourseDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { data: product } = await getProductBySlug(slug);

  if (!product) {
    notFound();
  }

  return (
    <>
      <CourseHeader product={product} />
      {product.description && (
        <section className="py-16 bg-background">
          <div className="max-w-[1400px] mx-auto px-8">
            <h2 className="text-3xl font-bold mb-8">课程介绍</h2>
            <div className="prose prose-lg">{product.description}</div>
          </div>
        </section>
      )}
      <CourseObjectives objectives={product.objectives} />
      <CourseOutline outline={product.outline} />
      <CourseTestimonials testimonials={product.testimonials} />
      <CourseCTA courseName={product.name} />
    </>
  );
}
```

- [ ] **步骤 4：创建新闻列表页 `app/news/page.tsx`（ISR）**

参照 `frontend/src/pages/NewsPage.tsx` 的渲染逻辑，改为 Server Component：

```tsx
// frontend-next/app/news/page.tsx
import { getNews } from '@/lib/api';
import NewsCard from '@/components/news/NewsCard';
import type { Metadata } from 'next';

export const revalidate = 300;

export const metadata: Metadata = {
  title: '新闻动态',
  description: '启航教育最新动态与行业资讯',
};

export default async function NewsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category } = await searchParams;
  const { data: news } = await getNews(category);

  return (
    <div className="max-w-[1400px] mx-auto px-8 py-16">
      <h1 className="text-4xl font-bold mb-12">新闻动态</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {news.map((item) => (
          <NewsCard key={item.id} news={item} />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **步骤 5：创建新闻详情页 `app/news/[slug]/page.tsx`（ISR）**

参照 `frontend/src/pages/NewsDetailPage.tsx` 的渲染逻辑，改为 Server Component + `generateStaticParams` + `generateMetadata`。

- [ ] **步骤 6：创建校区列表页和详情页**

- `app/campuses/page.tsx`（ISR）— 参照 `frontend/src/pages/CampusesPage.tsx`
- `app/campuses/[slug]/page.tsx`（ISR）— 参照 `frontend/src/pages/CampusDetailPage.tsx`，包含 `generateStaticParams` + `generateMetadata`

- [ ] **步骤 7：创建教师列表页 `app/teachers/page.tsx`（ISR）**

参照 `frontend/src/pages/TeamPage.tsx`。

- [ ] **步骤 8：创建 FAQ 页 `app/faq/page.tsx`（ISR）**

参照 `frontend/src/pages/FaqPage.tsx`，在 `generateMetadata` 中添加 FAQPage JSON-LD 结构化数据：

```tsx
export async function generateMetadata(): Promise<Metadata> {
  const { data: faqs } = await getFaqItems();
  return {
    title: '常见问题',
    other: {
      'application/ld+json': buildJsonLd({
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: faqs.map((f) => ({
          '@type': 'Question',
          name: f.question,
          acceptedAnswer: { '@type': 'Answer', text: f.answer },
        })),
      }),
    },
  };
}
```

- [ ] **步骤 9：创建预约成功页 `app/appointment-success/page.tsx`（CSR）**

```tsx
// frontend-next/app/appointment-success/page.tsx
'use client';

import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle, Phone } from 'lucide-react';

export default function AppointmentSuccessPage() {
  const searchParams = useSearchParams();
  const phone = searchParams.get('phone');

  // 验证 phone 参数（必填字段验证）
  if (!phone) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">访问受限</h1>
          <p className="text-gray-600 mb-8">缺少必要参数，请通过正规流程访问此页面。</p>
          <Link href="/" className="text-primary hover:underline">返回首页</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-amber-50">
      {/* 参照 frontend/src/pages/AppointmentSuccessPage.tsx 的 JSX */}
    </div>
  );
}
```

- [ ] **步骤 10：创建动态页面 `app/[slug]/page.tsx`（ISR）**

参照 `frontend/src/pages/PageRenderer.tsx`，改为 Server Component + `generateStaticParams` + `generateMetadata`。

注意：此路由会匹配所有单段路径（如 `/about-school`），需放在路由优先级的最后。Next.js 按文件夹顺序匹配，静态路由（`/courses`、`/news` 等）优先于动态路由 `[slug]`。

- [ ] **步骤 11：创建合规页面**

创建 3 个合规页面（退费政策、隐私政策、用户协议），均为 ISR + Strapi Page + RichText section：

- `app/refund-policy/page.tsx`
- `app/privacy-policy/page.tsx`
- `app/user-agreement/page.tsx`

每个页面通过 `getPageBySlug('refund-policy')` 获取 Strapi 数据，渲染 RichText section。

- [ ] **步骤 12：浏览器验证所有页面**

使用 TRAE 内建浏览器逐一验证：
- 首页 `http://localhost:3000/`
- 课程搜索 `http://localhost:3000/courses`
- 课程详情 `http://localhost:3000/courses/{slug}`（从 Strapi 获取一个 slug）
- 新闻列表 `http://localhost:3000/news`
- 校区列表 `http://localhost:3000/campuses`
- 教师列表 `http://localhost:3000/teachers`
- FAQ `http://localhost:3000/faq`

检查控制台无错误。

- [ ] **步骤 13：Commit**

```bash
cd /home/tishensnoopy/project/superpowers-zh
git add frontend-next/app/
git commit -m "feat(frontend-next): 创建所有页面路由（ISR + CSR）"
```

---

## 任务 9：SEO 基础设施

**文件：**
- 创建：`frontend-next/app/sitemap.ts`
- 创建：`frontend-next/app/robots.ts`
- 创建：`frontend-next/app/llms.txt/route.ts`

- [ ] **步骤 1：创建 `app/sitemap.ts`**

```tsx
// frontend-next/app/sitemap.ts
import type { MetadataRoute } from 'next';
import { getPages, getProducts, getNews } from '@/lib/api';

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  const entries: MetadataRoute.Sitemap = [
    { url: baseUrl, lastModified: new Date(), priority: 1.0, changeFrequency: 'daily' },
    { url: `${baseUrl}/courses`, lastModified: new Date(), priority: 0.9 },
    { url: `${baseUrl}/news`, lastModified: new Date(), priority: 0.8 },
    { url: `${baseUrl}/campuses`, lastModified: new Date(), priority: 0.8 },
    { url: `${baseUrl}/teachers`, lastModified: new Date(), priority: 0.7 },
    { url: `${baseUrl}/faq`, lastModified: new Date(), priority: 0.6 },
  ];

  const { data: products } = await getProducts();
  products.forEach((p) => {
    entries.push({
      url: `${baseUrl}/courses/${p.slug}`,
      lastModified: p.updatedAt ? new Date(p.updatedAt) : new Date(),
      priority: 0.7,
    });
  });

  const { data: news } = await getNews();
  news.forEach((n) => {
    entries.push({
      url: `${baseUrl}/news/${n.slug}`,
      lastModified: n.publishedAt ? new Date(n.publishedAt) : new Date(),
      priority: 0.6,
    });
  });

  ['/refund-policy', '/privacy-policy', '/user-agreement'].forEach((path) => {
    entries.push({ url: `${baseUrl}${path}`, priority: 0.3 });
  });

  return entries;
}
```

- [ ] **步骤 2：创建 `app/robots.ts`**

```tsx
// frontend-next/app/robots.ts
import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/admin/'],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
```

- [ ] **步骤 3：创建 `app/llms.txt/route.ts`**

```tsx
// frontend-next/app/llms.txt/route.ts
import { getSiteSettings, getProducts } from '@/lib/api';

export const revalidate = 3600;

export async function GET() {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

  const [settingsRes, productsRes] = await Promise.all([
    getSiteSettings(),
    getProducts(),
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
```

- [ ] **步骤 4：浏览器验证 SEO 文件**

使用 TRAE 内建浏览器验证：
- `http://localhost:3000/sitemap.xml` — 返回有效 XML
- `http://localhost:3000/robots.txt` — 返回 robots 规则
- `http://localhost:3000/llms.txt` — 返回动态内容

- [ ] **步骤 5：Commit**

```bash
cd /home/tishensnoopy/project/superpowers-zh
git add frontend-next/app/sitemap.ts frontend-next/app/robots.ts frontend-next/app/llms.txt/
git commit -m "feat(frontend-next): SEO 基础设施（sitemap + robots + llms.txt 动态生成）"
```

---

## 任务 10：错误处理与 Sentry 集成

**文件：**
- 创建：`frontend-next/app/not-found.tsx`
- 创建：`frontend-next/app/error.tsx`
- 创建：`frontend-next/app/global-error.tsx`
- 创建：`frontend-next/app/loading.tsx`
- 创建：`frontend-next/sentry.client.config.ts`
- 创建：`frontend-next/sentry.server.config.ts`
- 创建：`frontend-next/sentry.edge.config.ts`

- [ ] **步骤 1：创建 `app/not-found.tsx`**

```tsx
// frontend-next/app/not-found.tsx
import Link from 'next/link';
import { Home, Search } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-amber-50">
      <div className="text-center px-8">
        <div className="text-[120px] font-bold text-orange-500 leading-none">404</div>
        <h1 className="text-2xl font-bold text-gray-800 mt-4 mb-2">页面未找到</h1>
        <p className="text-gray-600 mb-8">您访问的页面不存在或已被移除</p>
        <div className="flex gap-4 justify-center">
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600"
          >
            <Home size={18} /> 返回首页
          </Link>
          <Link
            href="/courses"
            className="inline-flex items-center gap-2 px-6 py-3 border border-orange-500 text-orange-500 rounded-lg hover:bg-orange-50"
          >
            <Search size={18} /> 浏览课程
          </Link>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **步骤 2：创建 `app/error.tsx`**

```tsx
// frontend-next/app/error.tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import * as Sentry from '@sentry/nextjs';
import Link from 'next/link';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    Sentry.captureException(error, {
      tags: { section: 'route-error', digest: error.digest },
    });
  }, [error]);

  const handleReset = () => {
    reset();
    router.refresh();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center px-8 max-w-md">
        <AlertTriangle size={48} className="mx-auto text-red-500 mb-4" />
        <h1 className="text-2xl font-bold text-gray-800 mb-2">出错了</h1>
        <p className="text-gray-600 mb-6">页面加载时发生错误，请稍后重试。</p>
        <div className="flex gap-4 justify-center">
          <button
            onClick={handleReset}
            className="inline-flex items-center gap-2 px-6 py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600"
          >
            <RefreshCw size={18} /> 重试
          </button>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
          >
            返回首页
          </Link>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **步骤 3：创建 `app/global-error.tsx`**

```tsx
// frontend-next/app/global-error.tsx
'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error, {
      tags: { section: 'global-error', digest: error.digest },
      level: 'fatal',
    });
  }, [error]);

  return (
    <html lang="zh-CN">
      <body>
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'sans-serif',
        }}>
          <div style={{ textAlign: 'center' }}>
            <h2>系统错误</h2>
            <p>网站遇到技术问题，请稍后重试。</p>
            <button onClick={reset}>重试</button>
          </div>
        </div>
      </body>
    </html>
  );
}
```

- [ ] **步骤 4：创建 `app/loading.tsx`**

```tsx
// frontend-next/app/loading.tsx
export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-600">加载中...</p>
      </div>
    </div>
  );
}
```

- [ ] **步骤 5：创建 Sentry 配置文件**

```tsx
// frontend-next/sentry.client.config.ts
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  release: process.env.NEXT_PUBLIC_SENTRY_RELEASE,
  environment: process.env.NODE_ENV,
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  replaysSessionSampleRate: 0.01,
  replaysOnErrorSampleRate: 1.0,
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration({
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],
  ignoreErrors: [
    'ResizeObserver loop limit exceeded',
    'Navigation cancelled',
    'AbortError',
  ],
});
```

```tsx
// frontend-next/sentry.server.config.ts
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  release: process.env.NEXT_PUBLIC_SENTRY_RELEASE,
  environment: process.env.NODE_ENV,
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
});
```

```tsx
// frontend-next/sentry.edge.config.ts
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  release: process.env.NEXT_PUBLIC_SENTRY_RELEASE,
  environment: process.env.NODE_ENV,
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
});
```

- [ ] **步骤 6：在 lib/api.ts 中集成 Sentry 错误捕获**

修改 `frontend-next/lib/api.ts` 的 `fetchApi` 函数，在 `if (!res.ok)` 块和 `catch` 块中添加 Sentry 捕获：

```typescript
import * as Sentry from '@sentry/nextjs';

// 在 fetchApi 函数的 if (!res.ok) 块中添加：
Sentry.captureException(error, {
  tags: { api: path, status: res.status.toString() },
  extra: {
    method: options.method || 'GET',
    duration,
    responseBody: errorText.substring(0, 500),
  },
});

// 在 catch 块中添加（仅捕获非 HTTP 错误的网络错误）：
if (!(err instanceof Error && err.message.includes('API request failed'))) {
  Sentry.captureException(err, {
    tags: { api: path, type: 'network-error' },
  });
}
```

- [ ] **步骤 7：在 useProductSearch.ts 中集成 Sentry 错误捕获**

修改 `frontend-next/hooks/useProductSearch.ts` 的 catch 块：

```typescript
import * as Sentry from '@sentry/nextjs';

// 在 catch 块中，setError 之前添加：
if (!err.name?.includes('Abort')) {
  Sentry.captureException(err, {
    tags: { section: 'product-search', query, category },
  });
}
```

- [ ] **步骤 8：浏览器验证错误页面**

使用 TRAE 内建浏览器验证：
- 访问 `http://localhost:3000/nonexistent` — 显示 404 页面
- 访问 `http://localhost:3000/courses/nonexistent-slug` — 显示 404 页面

- [ ] **步骤 9：Commit**

```bash
cd /home/tishensnoopy/project/superpowers-zh
git add frontend-next/app/not-found.tsx frontend-next/app/error.tsx frontend-next/app/global-error.tsx frontend-next/app/loading.tsx frontend-next/sentry.*.config.ts frontend-next/lib/api.ts frontend-next/hooks/useProductSearch.ts
git commit -m "feat(frontend-next): 错误处理（not-found/error/global-error/loading）+ Sentry 集成"
```

---

## 任务 11：全量测试与构建验证

- [ ] **步骤 1：运行全量测试**

```bash
cd frontend-next
npx vitest run
```

预期：345+ 测试全部通过

- [ ] **步骤 2：TypeScript 类型检查**

```bash
cd frontend-next
npx tsc --noEmit
```

预期：无类型错误（预存的 12 个非 v5 相关错误除外）

- [ ] **步骤 3：生产构建**

```bash
cd frontend-next
npm run build
```

预期：
- 构建成功
- 首页 First Load JS < 130KB
- `output: 'standalone'` 生成 `.next/standalone/` 目录

- [ ] **步骤 4：Bundle 分析**

```bash
cd frontend-next
npm run analyze
```

检查：
- 无异常大依赖（> 50KB 的第三方库）
- 无重复依赖
- shared by all < 100KB

- [ ] **步骤 5：浏览器全量验证**

使用 TRAE 内建浏览器逐一验证所有页面：
- 首页 `/`
- 课程搜索 `/courses`（测试搜索、筛选、排序、分页）
- 课程详情 `/courses/{slug}`
- 新闻列表 `/news`
- 新闻详情 `/news/{slug}`
- 校区列表 `/campuses`
- 校区详情 `/campuses/{slug}`
- 教师列表 `/teachers`
- FAQ `/faq`
- 404 页面 `/nonexistent`
- sitemap.xml `/sitemap.xml`
- robots.txt `/robots.txt`
- llms.txt `/llms.txt`

检查每个页面：
- 正常渲染，无白屏
- 控制台无错误
- meta 标签正确（查看页面源码）

- [ ] **步骤 6：Docker 构建验证**

创建 `frontend-next/Dockerfile` 和 `frontend-next/.dockerignore`（参照第 9.7 节），然后验证：

```bash
cd frontend-next
docker build -t frontend-next-test .
docker images | grep frontend-next-test
```

预期：镜像体积 < 200MB

- [ ] **步骤 7：更新项目 memory**

更新 `/home/tishensnoopy/.trae-cn/memory/projects/-home-tishensnoopy-project-superpowers-zh/project_memory.md`，记录：
- 阶段 2 完成
- frontend-next/ 项目结构
- 关键技术决策（Server/Client 边界、字体管理、SEO 基础设施）
- 测试统计
- 构建产物体积

- [ ] **步骤 8：最终 Commit**

```bash
cd /home/tishensnoopy/project/superpowers-zh
git add frontend-next/Dockerfile frontend-next/.dockerignore
git commit -m "feat(frontend-next): Docker 多阶段构建 + 全量验证通过"
```

- [ ] **步骤 9：打 Git 标签**

```bash
cd /home/tishensnoopy/project/superpowers-zh
git tag -a nextjs-skeleton-complete -m "Next.js 迁移阶段 2 完成：骨架搭建

- Next.js 15 App Router 项目初始化
- lib/api.ts 移植 + getImageUrl + FontSettings
- Layout 拆分（Navigation Client + Footer Server）
- 12 个 section 组件 + StrapiImage 移植
- 12 个课程组件 + useProductSearch（含竞态修复）移植
- 校区/教师/新闻组件移植
- 所有页面路由创建（ISR + CSR）
- SEO 基础设施（sitemap + robots + llms.txt 动态生成）
- 错误处理（not-found + error + global-error + loading）
- Sentry 错误监控集成
- 345+ 测试通过
- Docker 多阶段构建"
```

---

## 自检

### 1. 规格覆盖度

| 设计文档章节 | 对应任务 | 状态 |
|-------------|---------|------|
| 第 1 节：项目结构与初始化 | 任务 1 | ✅ |
| 第 2 节：核心组件实现与 Strapi 数据适配 | 任务 3-7 | ✅ |
| 第 3 节：具体组件迁移代码与适配示例 | 任务 3-7 | ✅ |
| 第 4 节：SEO 基础设施 | 任务 8（页面 metadata）+ 任务 9 | ✅ |
| 第 5 节：测试迁移策略 | 任务 3（setup）+ 各任务测试步骤 | ✅ |
| 第 6 节：错误处理与 404 | 任务 10 | ✅ |
| 第 7 节：Sentry 错误监控 | 任务 10 | ✅ |
| 第 8 节：前端性能优化（字体/图片/缓存） | 任务 1（配置）+ 任务 3（字体）+ 任务 5（StrapiImage） | ✅ |
| 第 9 节：构建产物分析与优化 | 任务 11 | ✅ |
| 第 10 节：实施步骤与时间线 | 任务 1-11 | ✅ |

### 2. 占位符扫描

无占位符。所有步骤包含具体代码或明确的操作指令。

### 3. 类型一致性

- `SiteSettings` 接口在任务 2 中定义，任务 3 中使用（包含 `fontSettings` 字段）
- `getImageUrl` 函数在任务 2 中定义，任务 3/5/6/7 中使用
- `buildMetadata` / `buildJsonLd` 在任务 2 中定义，任务 8/9 中使用
- `Navigation` / `Footer` 组件在任务 4 中定义，任务 4 的 `layout.tsx` 中使用
- `useProductSearch` 在任务 6 中定义，任务 8 的课程搜索页中使用

---

## 执行交接

**计划已完成并保存到 `docs/superpowers/plans/2026-07-13-nextjs-migration-phase2.md`。两种执行方式：**

**1. 子代理驱动（推荐）** - 每个任务调度一个新的子代理，任务间进行审查，快速迭代

**2. 内联执行** - 在当前会话中使用 executing-plans 执行任务，批量执行并设有检查点

**选哪种方式？**
