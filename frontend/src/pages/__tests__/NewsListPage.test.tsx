import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders as render, screen, waitFor, fireEvent } from '../../test/test-utils';
import { MemoryRouter } from 'react-router-dom';
import NewsListPage from '../NewsListPage';

vi.mock('../../lib/api', () => ({
  getNews: vi.fn(),
  getNewsCategoryLabel: vi.fn(),
}));

import { getNews } from '../../lib/api';

const mockNewsList = [
  {
    id: 1,
    title: '教育峰会圆满举办',
    slug: 'summit-2026',
    excerpt: '峰会汇聚了200余位专家',
    coverImage: { url: '/uploads/a.jpg' },
    category: 'company_news',
    publishedAt: '2026-07-10T10:00:00.000Z',
  },
  {
    id: 2,
    title: '行业最新政策解读',
    slug: 'policy-2026',
    excerpt: '教育部发布最新政策',
    coverImage: { url: '/uploads/b.jpg' },
    category: 'industry_news',
    publishedAt: '2026-07-08T10:00:00.000Z',
  },
  {
    id: 3,
    title: '暑期开放日活动',
    slug: 'open-day-2026',
    excerpt: '欢迎家长参观校区',
    coverImage: { url: '/uploads/c.jpg' },
    category: 'event_notice',
    publishedAt: '2026-07-05T10:00:00.000Z',
  },
];

describe('NewsListPage 页面', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getNews).mockResolvedValue({ data: mockNewsList } as any);
  });

  it('加载中显示 loading', () => {
    vi.mocked(getNews).mockReturnValue(new Promise(() => {}));
    render(
      <MemoryRouter>
        <NewsListPage />
      </MemoryRouter>
    );
    expect(screen.getByText(/加载中/)).toBeInTheDocument();
  });

  it('渲染页面标题', async () => {
    render(
      <MemoryRouter>
        <NewsListPage />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /新闻动态/ })).toBeInTheDocument();
    });
  });

  it('渲染分类筛选标签', async () => {
    render(
      <MemoryRouter>
        <NewsListPage />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText('全部')).toBeInTheDocument();
      expect(screen.getByText('公司动态')).toBeInTheDocument();
      expect(screen.getByText('行业资讯')).toBeInTheDocument();
      expect(screen.getByText('活动通知')).toBeInTheDocument();
    });
  });

  it('渲染新闻卡片', async () => {
    render(
      <MemoryRouter>
        <NewsListPage />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText('教育峰会圆满举办')).toBeInTheDocument();
      expect(screen.getByText('行业最新政策解读')).toBeInTheDocument();
      expect(screen.getByText('暑期开放日活动')).toBeInTheDocument();
    });
  });

  it('默认选中"全部"分类', async () => {
    render(
      <MemoryRouter>
        <NewsListPage />
      </MemoryRouter>
    );
    await waitFor(() => {
      const allButton = screen.getByText('全部');
      expect(allButton.getAttribute('data-active')).toBe('true');
    });
  });

  it('点击分类筛选触发 API 调用', async () => {
    render(
      <MemoryRouter>
        <NewsListPage />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText('教育峰会圆满举办')).toBeInTheDocument();
    });

    vi.clearAllMocks();
    vi.mocked(getNews).mockResolvedValue({ data: [mockNewsList[0]] } as any);

    fireEvent.click(screen.getByText('公司动态'));

    await waitFor(() => {
      expect(getNews).toHaveBeenCalledWith('company_news');
    });
  });

  it('加载失败显示错误提示', async () => {
    vi.mocked(getNews).mockRejectedValueOnce(new Error('Network error'));
    render(
      <MemoryRouter>
        <NewsListPage />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getAllByText(/加载失败|错误|重试/).length).toBeGreaterThan(0);
    });
  });

  it('无新闻时显示空状态', async () => {
    vi.mocked(getNews).mockResolvedValueOnce({ data: [] } as any);
    render(
      <MemoryRouter>
        <NewsListPage />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getAllByText(/暂无|没有|空/).length).toBeGreaterThan(0);
    });
  });
});
