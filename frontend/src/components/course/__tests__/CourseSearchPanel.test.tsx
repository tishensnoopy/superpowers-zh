import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderWithProviders as render, screen, waitFor } from '../../../test/test-utils';
import { MemoryRouter } from 'react-router-dom';
import CourseSearchPanel from '../CourseSearchPanel';

vi.mock('../../../lib/api', () => ({
  searchProducts: vi.fn(),
  getProductCategories: vi.fn(),
}));

import { searchProducts, getProductCategories } from '../../../lib/api';

const mockCategories = [
  { id: 1, slug: 'language', name: '语言启蒙' },
  { id: 2, slug: 'math', name: '数学思维' },
];

const mockResults = {
  data: [
    { id: 1, documentId: 'doc-1', name: '语言启蒙基础课', slug: 'language', shortDescription: '培养语言能力', specValues: {} },
  ],
  meta: { total: 1, page: 1, pageSize: 12, pageCount: 1 },
};

describe('CourseSearchPanel 组件', () => {
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

  it('渲染标题和描述', async () => {
    render(
      <MemoryRouter>
        <CourseSearchPanel title="课程体系" description="专业课程" />
      </MemoryRouter>
    );
    expect(screen.getByRole('heading', { name: '课程体系' })).toBeInTheDocument();
    expect(screen.getByText('专业课程')).toBeInTheDocument();
  });

  it('渲染搜索栏和排序控件', async () => {
    render(
      <MemoryRouter>
        <CourseSearchPanel />
      </MemoryRouter>
    );
    expect(screen.getByPlaceholderText('搜索课程...')).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('加载分类后渲染分类筛选', async () => {
    render(
      <MemoryRouter>
        <CourseSearchPanel />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText('语言启蒙')).toBeInTheDocument();
      expect(screen.getByText('数学思维')).toBeInTheDocument();
    });
  });

  it('渲染"全部"分类按钮', async () => {
    render(
      <MemoryRouter>
        <CourseSearchPanel />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText('全部')).toBeInTheDocument();
    });
  });

  it('初始加载触发搜索', async () => {
    render(
      <MemoryRouter>
        <CourseSearchPanel />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(searchProducts).toHaveBeenCalledWith(
        expect.objectContaining({ page: 1, limit: 12 })
      );
    });
  });

  it('渲染搜索结果', async () => {
    render(
      <MemoryRouter>
        <CourseSearchPanel />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText('语言启蒙基础课')).toBeInTheDocument();
    });
  });

  it('注入 SEO title', async () => {
    render(
      <MemoryRouter>
        <CourseSearchPanel title="课程体系" />
      </MemoryRouter>
    );
    const titleEl = document.querySelector('title');
    expect(titleEl?.textContent).toContain('课程体系');
  });
});
