import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders as render, screen, waitFor } from '../../test/test-utils';
import { MemoryRouter } from 'react-router-dom';
import CoursesPage from '../CoursesPage';

vi.mock('../../lib/api', () => ({
  getProducts: vi.fn(),
}));

import { getProducts } from '../../lib/api';

const mockProducts = [
  {
    id: 1,
    attributes: {
      name: '拼音启蒙班',
      slug: 'pinyin-starter',
      shortDescription: '系统学习汉语拼音',
      specValues: { course_hours: '48', age_range: '5-6岁' },
    },
  },
  {
    id: 2,
    attributes: {
      name: '数学思维班',
      slug: 'math-thinking',
      shortDescription: '培养逻辑思维能力',
      specValues: { course_hours: '36', age_range: '5-7岁' },
    },
  },
];

describe('CoursesPage 页面', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('加载中显示 loading', () => {
    vi.mocked(getProducts).mockReturnValue(new Promise(() => {}));
    render(
      <MemoryRouter>
        <CoursesPage />
      </MemoryRouter>
    );
    expect(screen.getByText(/加载中/)).toBeInTheDocument();
  });

  it('渲染页面标题"课程体系"', async () => {
    vi.mocked(getProducts).mockResolvedValueOnce({ data: mockProducts } as any);
    render(
      <MemoryRouter>
        <CoursesPage />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /课程体系/ })).toBeInTheDocument();
    });
  });

  it('加载成功后渲染课程卡片', async () => {
    vi.mocked(getProducts).mockResolvedValueOnce({ data: mockProducts } as any);
    render(
      <MemoryRouter>
        <CoursesPage />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText('拼音启蒙班')).toBeInTheDocument();
      expect(screen.getByText('数学思维班')).toBeInTheDocument();
    });
  });

  it('课程卡片包含详情链接', async () => {
    vi.mocked(getProducts).mockResolvedValueOnce({ data: mockProducts } as any);
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
    expect(links.some((l) => l.getAttribute('href') === '/courses/math-thinking')).toBe(true);
  });

  it('课程列表为空时不崩溃', async () => {
    vi.mocked(getProducts).mockResolvedValueOnce({ data: [] } as any);
    render(
      <MemoryRouter>
        <CoursesPage />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.queryByText('拼音启蒙班')).not.toBeInTheDocument();
    });
  });

  it('渲染页面描述文字', async () => {
    vi.mocked(getProducts).mockResolvedValueOnce({ data: mockProducts } as any);
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
