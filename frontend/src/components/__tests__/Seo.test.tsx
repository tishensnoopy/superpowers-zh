import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render } from '@testing-library/react';
import { HelmetProvider } from 'react-helmet-async';
import Seo from '../Seo';
import type { Seo as SeoData } from '../../lib/api';

function renderWithProvider(ui: React.ReactElement) {
  return render(<HelmetProvider>{ui}</HelmetProvider>);
}

function getMeta(name: string): string | null {
  const el = document.querySelector(`meta[name="${name}"]`);
  return el?.getAttribute('content') ?? null;
}

function getOgMeta(property: string): string | null {
  const el = document.querySelector(`meta[property="${property}"]`);
  return el?.getAttribute('content') ?? null;
}

const mockSeo: SeoData = {
  metaTitle: '课程详情页 SEO 标题',
  metaDescription: '这是课程详情页的 SEO 描述，用于搜索引擎展示',
  metaKeywords: '幼小衔接,课程,培训',
  canonicalUrl: 'https://example.com/courses/language',
  ogTitle: 'OG 分享标题',
  ogDescription: 'OG 分享描述',
  ogImage: { url: '/uploads/og-image.jpg' },
};

beforeEach(() => {
  document.head.innerHTML = '';
  // react-helmet-async defers DOM updates via requestAnimationFrame;
  // make it synchronous so assertions can run immediately after render
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    cb(0);
    return 0;
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Seo 组件', () => {
  it('使用 seo.metaTitle 渲染标题并附加站点名', () => {
    renderWithProvider(<Seo seo={mockSeo} />);
    expect(document.querySelector('title')?.textContent).toBe('课程详情页 SEO 标题 | 幼小衔接教育');
  });

  it('无 seo 数据时回退到 title prop', () => {
    renderWithProvider(<Seo title="关于我们" />);
    expect(document.querySelector('title')?.textContent).toBe('关于我们 | 幼小衔接教育');
  });

  it('无 seo 且无 title 时只显示站点名', () => {
    renderWithProvider(<Seo />);
    expect(document.querySelector('title')?.textContent).toBe('幼小衔接教育');
  });

  it('渲染 meta description', () => {
    renderWithProvider(<Seo seo={mockSeo} />);
    expect(getMeta('description')).toBe('这是课程详情页的 SEO 描述，用于搜索引擎展示');
  });

  it('无 seo.metaDescription 时回退到 description prop', () => {
    renderWithProvider(<Seo title="测试" description="回退描述" />);
    expect(getMeta('description')).toBe('回退描述');
  });

  it('渲染 meta keywords', () => {
    renderWithProvider(<Seo seo={mockSeo} />);
    expect(getMeta('keywords')).toBe('幼小衔接,课程,培训');
  });

  it('无 keywords 时不渲染 keywords meta', () => {
    renderWithProvider(<Seo title="测试" />);
    expect(document.querySelector('meta[name="keywords"]')).toBeNull();
  });

  it('渲染 canonical link', () => {
    renderWithProvider(<Seo seo={mockSeo} />);
    const canonical = document.querySelector('link[rel="canonical"]');
    expect(canonical?.getAttribute('href')).toBe('https://example.com/courses/language');
  });

  it('无 canonicalUrl 时不渲染 canonical link', () => {
    renderWithProvider(<Seo title="测试" />);
    expect(document.querySelector('link[rel="canonical"]')).toBeNull();
  });

  it('渲染 Open Graph 标签', () => {
    renderWithProvider(<Seo seo={mockSeo} />);
    expect(getOgMeta('og:title')).toBe('OG 分享标题');
    expect(getOgMeta('og:description')).toBe('OG 分享描述');
    expect(getOgMeta('og:type')).toBe('website');
    expect(getOgMeta('og:image')).toContain('/uploads/og-image.jpg');
  });

  it('OG 标签回退到 meta 值', () => {
    renderWithProvider(<Seo title="页面标题" description="页面描述" />);
    expect(getOgMeta('og:title')).toBe('页面标题');
    expect(getOgMeta('og:description')).toBe('页面描述');
  });

  it('ogImage 相对 URL 拼接 API 基础地址', () => {
    renderWithProvider(<Seo seo={mockSeo} />);
    const ogImage = getOgMeta('og:image');
    expect(ogImage).toMatch(/^https?:\/\/.+\/uploads\/og-image\.jpg$/);
  });

  it('ogImage 绝对 URL 直接使用', () => {
    const seoWithAbsoluteImage: SeoData = {
      ...mockSeo,
      ogImage: { url: 'https://cdn.example.com/image.png' },
    };
    renderWithProvider(<Seo seo={seoWithAbsoluteImage} />);
    expect(getOgMeta('og:image')).toBe('https://cdn.example.com/image.png');
  });

  it('渲染 Twitter Card 标签', () => {
    renderWithProvider(<Seo seo={mockSeo} />);
    expect(getMeta('twitter:card')).toBe('summary_large_image');
    expect(getMeta('twitter:title')).toBe('OG 分享标题');
    expect(getMeta('twitter:description')).toBe('OG 分享描述');
  });

  it('渲染 JSON-LD 结构化数据', () => {
    const structuredData = {
      '@type': 'Course',
      name: '语言启蒙',
      description: '培养语言表达能力',
    };
    renderWithProvider(<Seo title="测试" structuredData={structuredData} />);
    const script = document.querySelector('script[type="application/ld+json"]');
    expect(script).not.toBeNull();
    const parsed = JSON.parse(script?.textContent || '{}');
    expect(parsed['@type']).toBe('Course');
    expect(parsed.name).toBe('语言启蒙');
  });

  it('无 structuredData 时不渲染 JSON-LD script', () => {
    renderWithProvider(<Seo title="测试" />);
    expect(document.querySelector('script[type="application/ld+json"]')).toBeNull();
  });

  it('支持自定义站点名', () => {
    renderWithProvider(<Seo title="测试" siteName="自定义站点" />);
    expect(document.querySelector('title')?.textContent).toBe('测试 | 自定义站点');
  });

  it('支持自定义 OG type', () => {
    renderWithProvider(<Seo title="测试" type="article" />);
    expect(getOgMeta('og:type')).toBe('article');
  });

  it('image prop 作为 OG image 回退', () => {
    renderWithProvider(<Seo title="测试" image="https://example.com/fallback.jpg" />);
    expect(getOgMeta('og:image')).toBe('https://example.com/fallback.jpg');
  });
});
