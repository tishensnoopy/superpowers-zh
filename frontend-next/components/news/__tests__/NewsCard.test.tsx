import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import NewsCard from '@/components/news/NewsCard';
import type { NewsArticle } from '@/lib/api';

vi.mock('@/lib/api', () => ({
  getNewsCategoryLabel: vi.fn((cat: string) => {
    const labels: Record<string, string> = {
      company_news: '公司动态',
      industry_news: '行业资讯',
      event_notice: '活动通知',
    };
    return labels[cat] || cat;
  }),
  getImageUrl: vi.fn((image: any) => {
    if (!image?.url) return null;
    if (image.url.startsWith('http')) return image.url;
    return `http://localhost:1337${image.url}`;
  }),
}));

const mockNews: NewsArticle = {
  id: 1,
  title: '2026年教育峰会圆满举办',
  slug: 'education-summit-2026',
  excerpt: '本次峰会汇聚了全国200余位教育专家',
  coverImage: { url: '/uploads/cover.jpg' },
  category: 'company_news',
  publishedAt: '2026-07-10T10:00:00.000Z',
  viewCount: 1234,
};

describe('NewsCard 组件', () => {
  it('渲染新闻标题', () => {
    render(<NewsCard news={mockNews} />);
    expect(screen.getByText('2026年教育峰会圆满举办')).toBeInTheDocument();
  });

  it('渲染摘要', () => {
    render(<NewsCard news={mockNews} />);
    expect(screen.getByText(/本次峰会汇聚了全国200余位教育专家/)).toBeInTheDocument();
  });

  it('渲染分类标签', () => {
    render(<NewsCard news={mockNews} />);
    expect(screen.getByText('公司动态')).toBeInTheDocument();
  });

  it('渲染发布日期', () => {
    render(<NewsCard news={mockNews} />);
    expect(screen.getByText(/2026年7月10日/)).toBeInTheDocument();
  });

  it('渲染封面图', () => {
    render(<NewsCard news={mockNews} />);
    const img = screen.getByRole('img');
    expect(img).toBeInTheDocument();
    expect(img.getAttribute('src')).toContain('/uploads/cover.jpg');
  });

  it('标题链接到详情页', () => {
    render(<NewsCard news={mockNews} />);
    const link = screen.getByRole('link');
    expect(link.getAttribute('href')).toBe('/news/education-summit-2026');
  });

  it('无封面图时不渲染图片', () => {
    const noCover: NewsArticle = {
      ...mockNews,
      coverImage: undefined,
    };
    render(<NewsCard news={noCover} />);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('无摘要不渲染摘要区域', () => {
    const noExcerpt: NewsArticle = {
      ...mockNews,
      excerpt: undefined,
    };
    render(<NewsCard news={noExcerpt} />);
    expect(screen.queryByText(/本次峰会汇聚了/)).not.toBeInTheDocument();
  });
});
