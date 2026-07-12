import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderWithProviders as render, screen, waitFor } from '../../test/test-utils';
import { MemoryRouter } from 'react-router-dom';
import CoursesPage from '../CoursesPage';

vi.mock('../../lib/api', () => ({
  searchProducts: vi.fn(),
  getProductCategories: vi.fn(),
}));

import { searchProducts, getProductCategories } from '../../lib/api';

const mockCategories = [
  { id: 1, slug: 'language', name: '语言启蒙' },
];

const mockResults = {
  data: [
    { id: 1, documentId: 'doc-1', name: '拼音启蒙班', slug: 'pinyin-starter', shortDescription: '系统学习汉语拼音', specValues: {} },
  ],
  meta: { total: 1, page: 1, pageSize: 12, pageCount: 1 },
};

describe('CoursesPage 页面', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.head.innerHTML = '';
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    });
    vi.mocked(searchProducts).mockResolvedValue(mockResults);
    vi.mocked(getProductCategories).mockResolvedValue({ data: mockCategories } as any);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('渲染页面标题"课程体系"', async () => {
    render(
      <MemoryRouter>
        <CoursesPage />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: '课程体系' })).toBeInTheDocument();
    });
  });

  it('加载成功后渲染课程卡片', async () => {
    render(
      <MemoryRouter>
        <CoursesPage />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText('拼音启蒙班')).toBeInTheDocument();
    });
  });

  it('课程卡片包含详情链接', async () => {
    render(
      <MemoryRouter>
        <CoursesPage />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText('拼音启蒙班')).toBeInTheDocument();
    });
    const links = screen.getAllByRole('link');
    expect(links.some((l) => l.getAttribute('href') === '/courses/pinyin-starter')).toBe(true);
  });

  it('渲染页面描述文字', async () => {
    render(
      <MemoryRouter>
        <CoursesPage />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText(/教研团队|课程标准|衔接/)).toBeInTheDocument();
    });
  });
});
