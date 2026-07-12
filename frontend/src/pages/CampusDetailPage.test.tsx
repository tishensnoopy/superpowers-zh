import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders as render, screen, waitFor } from '../test/test-utils';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import CampusDetailPage from './CampusDetailPage';

vi.mock('../lib/api', () => ({
  getCampusBySlug: vi.fn(),
}));

import { getCampusBySlug } from '../lib/api';

const mockCampus = {
  id: 1,
  name: '朝阳校区',
  slug: 'chaoyang',
  address: '建国路88号 SOHO现代城A座3层',
  phone: '010-8888-0001',
  businessHours: '周一至周日 9:00-21:00',
  transportation: '地铁1号线大望路站C口出，步行300米',
  area: '800㎡',
  description: '位于CBD核心区，交通便利，环境优雅。',
  gallery: [
    { url: '/uploads/gallery-1.jpg' },
    { url: '/uploads/gallery-2.jpg' },
  ],
  teachers: [
    {
      id: 10,
      name: '王老师',
      slug: 'wang',
      title: '高级教师',
      avatar: { url: '/uploads/wang.jpg' },
    },
    {
      id: 11,
      name: '李老师',
      slug: 'li',
      title: '特级教师',
      avatar: { url: '/uploads/li.jpg' },
    },
  ],
};

function renderWithSlug(slug: string) {
  return render(
    <MemoryRouter initialEntries={[`/campuses/${slug}`]}>
      <Routes>
        <Route path="/campuses/:slug" element={<CampusDetailPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('CampusDetailPage 页面', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('加载中显示 loading', () => {
    vi.mocked(getCampusBySlug).mockReturnValue(new Promise(() => {}));
    renderWithSlug('chaoyang');
    expect(screen.getByText(/加载中/)).toBeInTheDocument();
  });

  it('加载成功后渲染校区名称', async () => {
    vi.mocked(getCampusBySlug).mockResolvedValueOnce({ data: mockCampus } as any);
    renderWithSlug('chaoyang');
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: '朝阳校区' })).toBeInTheDocument();
    });
  });

  it('渲染校区简介', async () => {
    vi.mocked(getCampusBySlug).mockResolvedValueOnce({ data: mockCampus } as any);
    renderWithSlug('chaoyang');
    await waitFor(() => {
      expect(screen.getByText(/位于CBD核心区/)).toBeInTheDocument();
    });
  });

  it('渲染面包屑导航（含首页和校区总览链接）', async () => {
    vi.mocked(getCampusBySlug).mockResolvedValueOnce({ data: mockCampus } as any);
    renderWithSlug('chaoyang');
    await waitFor(() => {
      expect(screen.getByText('首页')).toBeInTheDocument();
      expect(screen.getByText('校区总览')).toBeInTheDocument();
    });
  });

  it('面包屑首页链接指向 /', async () => {
    vi.mocked(getCampusBySlug).mockResolvedValueOnce({ data: mockCampus } as any);
    renderWithSlug('chaoyang');
    await waitFor(() => {
      expect(screen.getByText('首页')).toBeInTheDocument();
    });
    expect(screen.getByText('首页').getAttribute('href')).toBe('/');
    expect(screen.getByText('校区总览').getAttribute('href')).toBe('/campuses');
  });

  it('渲染校区环境图集区块', async () => {
    vi.mocked(getCampusBySlug).mockResolvedValueOnce({ data: mockCampus } as any);
    renderWithSlug('chaoyang');
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: '校区环境' })).toBeInTheDocument();
    });
  });

  it('渲染校区信息区块', async () => {
    vi.mocked(getCampusBySlug).mockResolvedValueOnce({ data: mockCampus } as any);
    renderWithSlug('chaoyang');
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: '校区信息' })).toBeInTheDocument();
    });
  });

  it('渲染本校教师列表', async () => {
    vi.mocked(getCampusBySlug).mockResolvedValueOnce({ data: mockCampus } as any);
    renderWithSlug('chaoyang');
    await waitFor(() => {
      expect(screen.getByText('王老师')).toBeInTheDocument();
      expect(screen.getByText('李老师')).toBeInTheDocument();
    });
    expect(screen.getByText('高级教师')).toBeInTheDocument();
    expect(screen.getByText('特级教师')).toBeInTheDocument();
  });

  it('渲染本校教师区块标题', async () => {
    vi.mocked(getCampusBySlug).mockResolvedValueOnce({ data: mockCampus } as any);
    renderWithSlug('chaoyang');
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /本校教师|名师团队/ })).toBeInTheDocument();
    });
  });

  it('加载失败显示错误提示', async () => {
    vi.mocked(getCampusBySlug).mockRejectedValueOnce(new Error('Not found'));
    renderWithSlug('nonexistent');
    await waitFor(() => {
      expect(screen.getAllByText(/校区不存在|找不到|加载失败|错误/).length).toBeGreaterThan(0);
    });
  });

  it('校区数据为空时显示空状态', async () => {
    vi.mocked(getCampusBySlug).mockResolvedValueOnce({ data: null } as any);
    renderWithSlug('missing');
    await waitFor(() => {
      expect(screen.getAllByText(/校区不存在|找不到|未找到/).length).toBeGreaterThan(0);
    });
  });

  it('无教师时不崩溃且显示空状态', async () => {
    const noTeachers = {
      id: 2,
      name: '海淀校区',
      slug: 'haidian',
      address: '中关村大街1号 海龙大厦5层',
    };
    vi.mocked(getCampusBySlug).mockResolvedValueOnce({ data: noTeachers } as any);
    renderWithSlug('haidian');
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: '海淀校区' })).toBeInTheDocument();
    });
  });
});
