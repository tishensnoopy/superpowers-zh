import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderWithProviders as render, screen, waitFor } from '../../test/test-utils';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import NewsDetailPage from '../NewsDetailPage';

vi.mock('../../lib/api', () => ({
  getNewsBySlug: vi.fn(),
  getNewsCategoryLabel: vi.fn(),
}));

import { getNewsBySlug, getNewsCategoryLabel } from '../../lib/api';

function renderWithRouter(slug = 'test-article') {
  return render(
    <MemoryRouter initialEntries={[`/news/${slug}`]}>
      <Routes>
        <Route path="/news/:slug" element={<NewsDetailPage />} />
      </Routes>
    </MemoryRouter>
  );
}

const mockNews = {
  id: 1,
  title: '2026年幼小衔接教育峰会圆满举办',
  slug: 'education-summit-2026',
  excerpt: '本次峰会汇聚了全国200余位教育专家',
  content: '<p>7月10日，2026年幼小衔接教育峰会在北京国际会议中心圆满举办。</p><h2>峰会亮点</h2><p>本次峰会设置了主题演讲、圆桌论坛等环节。</p>',
  coverImage: { url: '/uploads/news-cover.jpg' },
  category: 'company_news',
  publishedAt: '2026-07-10T10:00:00.000Z',
  viewCount: 1234,
  seo: {
    metaTitle: '2026幼小衔接教育峰会专题报道',
    metaDescription: '全国200余位教育专家齐聚北京',
    ogTitle: '2026年幼小衔接教育峰会圆满举办',
    ogDescription: '本次峰会汇聚了全国200余位教育专家',
  },
};

describe('NewsDetailPage 页面', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.head.innerHTML = '';
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    });
    vi.mocked(getNewsCategoryLabel).mockImplementation((cat: string) => {
      const labels: Record<string, string> = {
        company_news: '公司动态',
        industry_news: '行业资讯',
        event_notice: '活动通知',
      };
      return labels[cat] || cat;
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('加载中显示 loading', () => {
    vi.mocked(getNewsBySlug).mockReturnValue(new Promise(() => {}));
    renderWithRouter();
    expect(screen.getByText(/加载中/)).toBeInTheDocument();
  });

  it('渲染新闻标题', async () => {
    vi.mocked(getNewsBySlug).mockResolvedValueOnce({ data: mockNews } as any);
    renderWithRouter();
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /2026年幼小衔接教育峰会圆满举办/ })).toBeInTheDocument();
    });
  });

  it('渲染分类标签', async () => {
    vi.mocked(getNewsBySlug).mockResolvedValueOnce({ data: mockNews } as any);
    vi.mocked(getNewsCategoryLabel).mockReturnValue('公司动态');
    renderWithRouter();
    await waitFor(() => {
      expect(vi.mocked(getNewsCategoryLabel)).toHaveBeenCalledWith('company_news');
      expect(screen.getAllByText('公司动态').length).toBeGreaterThan(0);
    });
  });

  it('渲染发布日期', async () => {
    vi.mocked(getNewsBySlug).mockResolvedValueOnce({ data: mockNews } as any);
    renderWithRouter();
    await waitFor(() => {
      expect(screen.getByText(/2026年7月10日|2026-07-10/)).toBeInTheDocument();
    });
  });

  it('渲染封面图', async () => {
    vi.mocked(getNewsBySlug).mockResolvedValueOnce({ data: mockNews } as any);
    renderWithRouter();
    await waitFor(() => {
      const img = screen.getByRole('img');
      expect(img).toBeInTheDocument();
    });
  });

  it('渲染正文内容', async () => {
    vi.mocked(getNewsBySlug).mockResolvedValueOnce({ data: mockNews } as any);
    const { container } = renderWithRouter();
    await waitFor(() => {
      expect(container.innerHTML).toContain('7月10日');
      expect(container.innerHTML).toContain('峰会亮点');
    });
  });

  it('渲染返回新闻列表链接', async () => {
    vi.mocked(getNewsBySlug).mockResolvedValueOnce({ data: mockNews } as any);
    renderWithRouter();
    await waitFor(() => {
      const link = screen.getByRole('link', { name: /返回新闻列表/ });
      expect(link).toBeInTheDocument();
      expect(link.getAttribute('href')).toBe('/news');
    });
  });

  it('渲染面包屑导航', async () => {
    vi.mocked(getNewsBySlug).mockResolvedValueOnce({ data: mockNews } as any);
    renderWithRouter();
    await waitFor(() => {
      expect(screen.getByText('首页')).toBeInTheDocument();
      expect(screen.getByText('新闻动态')).toBeInTheDocument();
    });
  });

  it('加载失败显示错误提示', async () => {
    vi.mocked(getNewsBySlug).mockRejectedValueOnce(new Error('Network error'));
    renderWithRouter();
    await waitFor(() => {
      expect(screen.getAllByText(/加载失败|错误|重试/).length).toBeGreaterThan(0);
    });
  });

  it('渲染阅读量', async () => {
    vi.mocked(getNewsBySlug).mockResolvedValueOnce({ data: mockNews } as any);
    renderWithRouter();
    await waitFor(() => {
      expect(screen.getByText(/1,234|1234/)).toBeInTheDocument();
    });
  });

  it('渲染 SEO meta 标签和 NewsArticle 结构化数据', async () => {
    vi.mocked(getNewsBySlug).mockResolvedValueOnce({ data: mockNews } as any);
    renderWithRouter();
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /2026年幼小衔接教育峰会/ })).toBeInTheDocument();
    });
    const titleEl = document.querySelector('title');
    expect(titleEl?.textContent).toContain('2026幼小衔接教育峰会专题报道');
    const metaDesc = document.querySelector('meta[name="description"]');
    expect(metaDesc?.getAttribute('content')).toBe('全国200余位教育专家齐聚北京');
    const ogTitle = document.querySelector('meta[property="og:title"]');
    expect(ogTitle?.getAttribute('content')).toBe('2026年幼小衔接教育峰会圆满举办');
    const jsonLd = document.querySelector('script[type="application/ld+json"]');
    expect(jsonLd).toBeTruthy();
    const parsed = JSON.parse(jsonLd!.textContent || '{}');
    expect(parsed['@type']).toBe('NewsArticle');
    expect(parsed.headline).toBe('2026年幼小衔接教育峰会圆满举办');
  });
});
