import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders as render, screen, fireEvent } from '../../../test/test-utils';
import { MemoryRouter } from 'react-router-dom';
import SearchResultsGrid from '../SearchResultsGrid';
import type { Product } from '../../../lib/api';

const makeProduct = (id: number, name: string): Product => ({
  id,
  attributes: {
    name,
    slug: `course-${id}`,
    shortDescription: `${name}的简介`,
    description: `${name}的详细描述`,
    specValues: { course_hours: '48课时', class_size: '小班12人' },
  },
});

const mockResults: Product[] = [
  makeProduct(1, '语言启蒙'),
  makeProduct(2, '数学思维'),
  makeProduct(3, '英语口语'),
  makeProduct(4, '综合素养'),
];

describe('SearchResultsGrid 组件', () => {
  it('loading=true 显示 4 个骨架卡片', () => {
    render(
      <MemoryRouter>
        <SearchResultsGrid results={[]} loading={true} error={null} />
      </MemoryRouter>
    );
    const skeletons = document.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThanOrEqual(4);
  });

  it('error 非空显示错误信息和重试按钮', () => {
    render(
      <MemoryRouter>
        <SearchResultsGrid results={[]} loading={false} error="加载失败" />
      </MemoryRouter>
    );
    expect(screen.getByText(/加载失败/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /重试/ })).toBeInTheDocument();
  });

  it('点击重试按钮调用 onRetry', () => {
    const onRetry = vi.fn();
    render(
      <MemoryRouter>
        <SearchResultsGrid results={[]} loading={false} error="加载失败" onRetry={onRetry} />
      </MemoryRouter>
    );
    fireEvent.click(screen.getByRole('button', { name: /重试/ }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('results 为空显示空状态提示', () => {
    render(
      <MemoryRouter>
        <SearchResultsGrid results={[]} loading={false} error={null} />
      </MemoryRouter>
    );
    expect(screen.getByText(/未找到相关课程/)).toBeInTheDocument();
  });

  it('正常渲染课程卡片网格', () => {
    render(
      <MemoryRouter>
        <SearchResultsGrid results={mockResults} loading={false} error={null} />
      </MemoryRouter>
    );
    expect(screen.getByText('语言启蒙')).toBeInTheDocument();
    expect(screen.getByText('数学思维')).toBeInTheDocument();
    expect(screen.getByText('英语口语')).toBeInTheDocument();
    expect(screen.getByText('综合素养')).toBeInTheDocument();
  });

  it('卡片包含课程名称和查看详情链接', () => {
    render(
      <MemoryRouter>
        <SearchResultsGrid results={mockResults} loading={false} error={null} />
      </MemoryRouter>
    );
    const links = screen.getAllByText('查看详情');
    expect(links).toHaveLength(4);
    // 验证链接指向正确的课程详情页
    const linkElements = screen.getAllByRole('link');
    expect(linkElements.some((link) => link.getAttribute('href') === '/courses/course-1')).toBe(true);
  });
});
