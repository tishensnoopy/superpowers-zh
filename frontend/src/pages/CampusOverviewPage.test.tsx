import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders as render, screen, waitFor } from '../test/test-utils';
import { MemoryRouter } from 'react-router-dom';
import CampusOverviewPage from './CampusOverviewPage';

vi.mock('../lib/api', () => ({
  getCampuses: vi.fn(),
}));

import { getCampuses } from '../lib/api';

const mockCampuses = [
  {
    id: 1,
    attributes: {
      name: '朝阳校区',
      slug: 'chaoyang',
      address: '建国路88号 SOHO现代城A座3层',
      phone: '010-8888-0001',
    },
  },
  {
    id: 2,
    attributes: {
      name: '海淀校区',
      slug: 'haidian',
      address: '中关村大街1号 海龙大厦5层',
      phone: '010-8888-0002',
    },
  },
];

describe('CampusOverviewPage 页面', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('加载中显示 loading', () => {
    vi.mocked(getCampuses).mockReturnValue(new Promise(() => {}));
    render(
      <MemoryRouter>
        <CampusOverviewPage />
      </MemoryRouter>
    );
    expect(screen.getByText(/加载中/)).toBeInTheDocument();
  });

  it('渲染主标题"八大校区 任您选择"', async () => {
    vi.mocked(getCampuses).mockResolvedValueOnce({ data: mockCampuses } as any);
    render(
      <MemoryRouter>
        <CampusOverviewPage />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /八大校区 任您选择/ })).toBeInTheDocument();
    });
  });

  it('渲染副标题', async () => {
    vi.mocked(getCampuses).mockResolvedValueOnce({ data: mockCampuses } as any);
    render(
      <MemoryRouter>
        <CampusOverviewPage />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText(/北京城八区|就近选择|遍布/)).toBeInTheDocument();
    });
  });

  it('加载成功后渲染校区卡片', async () => {
    vi.mocked(getCampuses).mockResolvedValueOnce({ data: mockCampuses } as any);
    render(
      <MemoryRouter>
        <CampusOverviewPage />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText('朝阳校区')).toBeInTheDocument();
      expect(screen.getByText('海淀校区')).toBeInTheDocument();
    });
  });

  it('每个校区卡片包含跳转链接', async () => {
    vi.mocked(getCampuses).mockResolvedValueOnce({ data: mockCampuses } as any);
    render(
      <MemoryRouter>
        <CampusOverviewPage />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText('朝阳校区')).toBeInTheDocument();
    });
    const links = screen.getAllByRole('link');
    expect(links.some((l) => l.getAttribute('href') === '/campuses/chaoyang')).toBe(true);
    expect(links.some((l) => l.getAttribute('href') === '/campuses/haidian')).toBe(true);
  });

  it('加载失败显示错误提示', async () => {
    vi.mocked(getCampuses).mockRejectedValueOnce(new Error('Network error'));
    render(
      <MemoryRouter>
        <CampusOverviewPage />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getAllByText(/加载失败|错误|重试/).length).toBeGreaterThan(0);
    });
  });

  it('校区列表为空时显示空状态', async () => {
    vi.mocked(getCampuses).mockResolvedValueOnce({ data: [] } as any);
    render(
      <MemoryRouter>
        <CampusOverviewPage />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText(/暂无|没有|更新中/)).toBeInTheDocument();
    });
  });
});
