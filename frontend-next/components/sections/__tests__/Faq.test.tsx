import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Faq from '@/components/sections/Faq';

vi.mock('@/lib/api', () => ({
  submitFaqFeedback: vi.fn().mockResolvedValue({ data: { id: 1 } }),
}));

import { submitFaqFeedback } from '@/lib/api';

const mockFaqs = [
  { id: 1, question: '幼小衔接有必要上吗？', answer: '非常有必要', category: 'course' },
  { id: 2, question: '校区地址在哪里？', answer: '武汉三镇6大校区', category: 'service' },
  { id: 3, question: '退费政策是什么？', answer: '开课前全额退', category: 'policy' },
  { id: 4, question: '班额是多少？', answer: '16-20人', category: 'course' },
];

const mockSection = {
  id: 0,
  __component: 'section.faq',
  title: '常见问题',
  faqs: { data: mockFaqs },
  showSearch: true,
};

describe('Faq 组件', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('渲染标题和所有 FAQ 项', () => {
    render(<Faq section={mockSection as any} />);
    expect(screen.getByRole('heading', { name: '常见问题' })).toBeInTheDocument();
    expect(screen.getByText('幼小衔接有必要上吗？')).toBeInTheDocument();
    expect(screen.getByText('校区地址在哪里？')).toBeInTheDocument();
    expect(screen.getByText('退费政策是什么？')).toBeInTheDocument();
    expect(screen.getByText('班额是多少？')).toBeInTheDocument();
  });

  it('渲染 4 个分类筛选 pill（全部/课程咨询/服务相关/政策规定）', () => {
    render(<Faq section={mockSection as any} />);
    expect(screen.getByRole('button', { name: /全部/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /课程咨询/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /服务相关/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /政策规定/ })).toBeInTheDocument();
  });

  it('点击"课程咨询"pill 只显示 course 类 FAQ', async () => {
    const user = userEvent.setup();
    render(<Faq section={mockSection as any} />);
    await user.click(screen.getByRole('button', { name: /课程咨询/ }));
    expect(screen.getByText('幼小衔接有必要上吗？')).toBeInTheDocument();
    expect(screen.getByText('班额是多少？')).toBeInTheDocument();
    expect(screen.queryByText('校区地址在哪里？')).not.toBeInTheDocument();
    expect(screen.queryByText('退费政策是什么？')).not.toBeInTheDocument();
  });

  it('点击"服务相关"pill 只显示 service 类 FAQ', async () => {
    const user = userEvent.setup();
    render(<Faq section={mockSection as any} />);
    await user.click(screen.getByRole('button', { name: /服务相关/ }));
    expect(screen.getByText('校区地址在哪里？')).toBeInTheDocument();
    expect(screen.queryByText('幼小衔接有必要上吗？')).not.toBeInTheDocument();
    expect(screen.queryByText('退费政策是什么？')).not.toBeInTheDocument();
  });

  it('点击"政策规定"pill 只显示 policy 类 FAQ', async () => {
    const user = userEvent.setup();
    render(<Faq section={mockSection as any} />);
    await user.click(screen.getByRole('button', { name: /政策规定/ }));
    expect(screen.getByText('退费政策是什么？')).toBeInTheDocument();
    expect(screen.queryByText('幼小衔接有必要上吗？')).not.toBeInTheDocument();
    expect(screen.queryByText('校区地址在哪里？')).not.toBeInTheDocument();
  });

  it('点击"全部"pill 恢复显示所有 FAQ', async () => {
    const user = userEvent.setup();
    render(<Faq section={mockSection as any} />);
    await user.click(screen.getByRole('button', { name: /课程咨询/ }));
    expect(screen.queryByText('校区地址在哪里？')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^全部$/ }));
    expect(screen.getByText('校区地址在哪里？')).toBeInTheDocument();
    expect(screen.getByText('退费政策是什么？')).toBeInTheDocument();
  });

  it('展开 FAQ 后显示"有用/没用"反馈按钮', async () => {
    const user = userEvent.setup();
    render(<Faq section={mockSection as any} />);
    await user.click(screen.getByText('幼小衔接有必要上吗？'));
    expect(await screen.findByText(/有用/)).toBeInTheDocument();
    expect(screen.getByText(/没用/)).toBeInTheDocument();
  });

  it('点击"有用"按钮调用 submitFaqFeedback({ helpful: true })', async () => {
    const user = userEvent.setup();
    render(<Faq section={mockSection as any} />);
    await user.click(screen.getByText('幼小衔接有必要上吗？'));
    const helpfulButton = await screen.findByRole('button', { name: /有用/ });
    await user.click(helpfulButton);
    await waitFor(() => {
      expect(submitFaqFeedback).toHaveBeenCalledWith('1', expect.objectContaining({ helpful: true }));
    });
  });

  it('点击"没用"按钮调用 submitFaqFeedback({ helpful: false })', async () => {
    const user = userEvent.setup();
    render(<Faq section={mockSection as any} />);
    await user.click(screen.getByText('退费政策是什么？'));
    const notHelpfulButton = await screen.findByRole('button', { name: /没用/ });
    await user.click(notHelpfulButton);
    await waitFor(() => {
      expect(submitFaqFeedback).toHaveBeenCalledWith('3', expect.objectContaining({ helpful: false }));
    });
  });

  it('反馈提交后显示感谢提示', async () => {
    const user = userEvent.setup();
    render(<Faq section={mockSection as any} />);
    await user.click(screen.getByText('幼小衔接有必要上吗？'));
    const helpfulButton = await screen.findByRole('button', { name: /有用/ });
    await user.click(helpfulButton);
    expect(await screen.findByText(/感谢反馈/)).toBeInTheDocument();
  });

  it('搜索与分类筛选可组合使用', async () => {
    const user = userEvent.setup();
    render(<Faq section={mockSection as any} />);
    await user.click(screen.getByRole('button', { name: /课程咨询/ }));
    await user.type(screen.getByPlaceholderText(/搜索常见问题/), '班额');
    expect(screen.getByText('班额是多少？')).toBeInTheDocument();
    expect(screen.queryByText('幼小衔接有必要上吗？')).not.toBeInTheDocument();
  });
});
