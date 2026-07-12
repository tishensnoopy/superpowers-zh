import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders as render, screen, waitFor, fireEvent } from '../../test/test-utils';
import { MemoryRouter } from 'react-router-dom';
import FaqPage from '../FaqPage';

vi.mock('../../lib/api', () => ({
  getFaqItems: vi.fn(),
}));

import { getFaqItems } from '../../lib/api';

const mockFaqs = [
  {
    id: 1,
    attributes: {
      question: '你们提供哪些课程？',
      answer: '我们提供语言启蒙、数学思维、英语口语和综合素养四大课程体系。',
      category: '课程相关',
      isActive: true,
      sortOrder: 1,
    },
  },
  {
    id: 2,
    attributes: {
      question: '如何预约参观校区？',
      answer: '您可以通过联系我们页面填写预约表单，或直接拨打校区电话预约。',
      category: '报名咨询',
      isActive: true,
      sortOrder: 2,
    },
  },
  {
    id: 3,
    attributes: {
      question: '学费是多少？',
      answer: '学费因课程和校区不同而异，请咨询具体校区获取详细价格。',
      category: '课程相关',
      isActive: true,
      sortOrder: 3,
    },
  },
];

describe('FaqPage 页面', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getFaqItems).mockResolvedValue({ data: mockFaqs } as any);
  });

  it('加载中显示 loading', () => {
    vi.mocked(getFaqItems).mockReturnValue(new Promise(() => {}));
    render(
      <MemoryRouter>
        <FaqPage />
      </MemoryRouter>
    );
    expect(screen.getByText(/加载中/)).toBeInTheDocument();
  });

  it('渲染页面标题', async () => {
    render(
      <MemoryRouter>
        <FaqPage />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /常见问题/ })).toBeInTheDocument();
    });
  });

  it('渲染 FAQ 问题列表', async () => {
    render(
      <MemoryRouter>
        <FaqPage />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText('你们提供哪些课程？')).toBeInTheDocument();
      expect(screen.getByText('如何预约参观校区？')).toBeInTheDocument();
      expect(screen.getByText('学费是多少？')).toBeInTheDocument();
    });
  });

  it('点击问题展开答案', async () => {
    render(
      <MemoryRouter>
        <FaqPage />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText('你们提供哪些课程？')).toBeInTheDocument();
    });

    // 初始状态答案不可见
    expect(screen.queryByText(/语言启蒙、数学思维/)).not.toBeInTheDocument();

    // 点击问题
    fireEvent.click(screen.getByText('你们提供哪些课程？'));

    // 答案显示
    expect(screen.getByText(/语言启蒙、数学思维/)).toBeInTheDocument();
  });

  it('再次点击同一问题收起答案', async () => {
    render(
      <MemoryRouter>
        <FaqPage />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText('你们提供哪些课程？')).toBeInTheDocument();
    });

    // 展开
    fireEvent.click(screen.getByText('你们提供哪些课程？'));
    expect(screen.getByText(/语言启蒙、数学思维/)).toBeInTheDocument();

    // 收起
    fireEvent.click(screen.getByText('你们提供哪些课程？'));
    expect(screen.queryByText(/语言启蒙、数学思维/)).not.toBeInTheDocument();
  });

  it('渲染分类筛选标签', async () => {
    render(
      <MemoryRouter>
        <FaqPage />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText('全部')).toBeInTheDocument();
      expect(screen.getByText('课程相关')).toBeInTheDocument();
      expect(screen.getByText('报名咨询')).toBeInTheDocument();
    });
  });

  it('点击分类筛选触发 API 调用', async () => {
    render(
      <MemoryRouter>
        <FaqPage />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText('课程相关')).toBeInTheDocument();
    });

    vi.clearAllMocks();
    vi.mocked(getFaqItems).mockResolvedValue({ data: [mockFaqs[0], mockFaqs[2]] } as any);

    fireEvent.click(screen.getByText('课程相关'));

    await waitFor(() => {
      expect(getFaqItems).toHaveBeenCalledWith('课程相关');
    });
  });

  it('加载失败显示错误提示', async () => {
    vi.mocked(getFaqItems).mockRejectedValueOnce(new Error('Network error'));
    render(
      <MemoryRouter>
        <FaqPage />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getAllByText(/加载失败|错误|重试/).length).toBeGreaterThan(0);
    });
  });

  it('无 FAQ 时显示空状态', async () => {
    vi.mocked(getFaqItems).mockResolvedValueOnce({ data: [] } as any);
    render(
      <MemoryRouter>
        <FaqPage />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getAllByText(/暂无|没有|空/).length).toBeGreaterThan(0);
    });
  });
});
