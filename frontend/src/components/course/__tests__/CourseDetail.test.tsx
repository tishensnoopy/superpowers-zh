import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders as render, screen, waitFor } from '../../../test/test-utils';
import { MemoryRouter } from 'react-router-dom';
import CourseDetail from '../CourseDetail';

vi.mock('../../../lib/api', () => ({
  getProductBySlug: vi.fn(),
}));

import { getProductBySlug } from '../../../lib/api';

const mockProduct = {
  id: 1,
  attributes: {
    name: '语言启蒙',
    slug: 'language',
    description: '通过绘本阅读、儿歌律动等方式培养语言能力。',
    shortDescription: '培养孩子语言表达能力与阅读兴趣',
    specValues: { course_hours: '48课时', class_size: '小班12人', age_range: '4-6岁', duration: '6个月' },
    teachingMethod: '采用沉浸式教学法，结合绘本和游戏。',
    objectives: [
      { id: 1, title: '掌握 500+ 词汇量', description: '通过绘本积累词汇' },
    ],
    outline: [
      { id: 1, title: '第 1-12 课：基础词汇', description: '认识基础汉字', lessonCount: 12 },
    ],
    testimonials: [
      { id: 1, parentName: '张妈妈', content: '效果很好！', rating: 5 },
    ],
  },
};

describe('CourseDetail 页面', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('加载中显示 loading', () => {
    vi.mocked(getProductBySlug).mockReturnValue(new Promise(() => {}));
    render(
      <MemoryRouter>
        <CourseDetail slug="language" />
      </MemoryRouter>
    );
    expect(screen.getByText(/加载中/)).toBeInTheDocument();
  });

  it('加载成功后渲染课程名称', async () => {
    vi.mocked(getProductBySlug).mockResolvedValueOnce({ data: mockProduct } as any);
    render(
      <MemoryRouter>
        <CourseDetail slug="language" />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: '语言启蒙' })).toBeInTheDocument();
    });
  });

  it('渲染课程描述', async () => {
    vi.mocked(getProductBySlug).mockResolvedValueOnce({ data: mockProduct } as any);
    render(
      <MemoryRouter>
        <CourseDetail slug="language" />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText(/通过绘本阅读/)).toBeInTheDocument();
    });
  });

  it('渲染学习目标区块', async () => {
    vi.mocked(getProductBySlug).mockResolvedValueOnce({ data: mockProduct } as any);
    render(
      <MemoryRouter>
        <CourseDetail slug="language" />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: '学习目标' })).toBeInTheDocument();
    });
  });

  it('渲染课程大纲区块', async () => {
    vi.mocked(getProductBySlug).mockResolvedValueOnce({ data: mockProduct } as any);
    render(
      <MemoryRouter>
        <CourseDetail slug="language" />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: '课程大纲' })).toBeInTheDocument();
    });
  });

  it('渲染家长评价区块', async () => {
    vi.mocked(getProductBySlug).mockResolvedValueOnce({ data: mockProduct } as any);
    render(
      <MemoryRouter>
        <CourseDetail slug="language" />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: '家长评价' })).toBeInTheDocument();
    });
  });

  it('渲染预约 CTA 按钮', async () => {
    vi.mocked(getProductBySlug).mockResolvedValueOnce({ data: mockProduct } as any);
    render(
      <MemoryRouter>
        <CourseDetail slug="language" />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByRole('link', { name: /立即预约/ })).toBeInTheDocument();
    });
  });

  it('课程不存在时显示 404', async () => {
    vi.mocked(getProductBySlug).mockRejectedValueOnce(new Error('Not found'));
    render(
      <MemoryRouter>
        <CourseDetail slug="nonexistent" />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText(/课程不存在|找不到/)).toBeInTheDocument();
    });
  });
});
