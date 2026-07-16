import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import Hero from '@/components/sections/Hero';

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: any) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

const mockSection = {
  id: 1,
  __component: 'section.hero',
  title: '让每个孩子自信迈入小学大门',
  subtitle: '2026年秋季班正在招生',
  description: '专注幼小衔接教育8年',
  buttonText: '立即预约试听',
};

describe('Hero 组件', () => {
  it('渲染标题', () => {
    render(<Hero section={mockSection as any} />);
    expect(screen.getByText(/让每个孩子/)).toBeInTheDocument();
  });

  it('渲染副标题', () => {
    render(<Hero section={mockSection as any} />);
    expect(screen.getByText(/2026年秋季班/)).toBeInTheDocument();
  });

  it('渲染 4 项统计数据', () => {
    render(<Hero section={mockSection as any} />);
    expect(screen.getByText('8年+')).toBeInTheDocument();
    expect(screen.getByText('3000+')).toBeInTheDocument();
    expect(screen.getByText('98%')).toBeInTheDocument();
    expect(screen.getByText('6所')).toBeInTheDocument();
  });

  it('立即预约试听按钮链接到 /appointment', () => {
    render(<Hero section={mockSection as any} />);
    const link = screen.getByRole('link', { name: /立即预约试听/ });
    expect(link).toHaveAttribute('href', '/appointment');
  });

  it('了解课程体系按钮链接到 /courses', () => {
    render(<Hero section={mockSection as any} />);
    const link = screen.getByRole('link', { name: /了解课程体系/ });
    expect(link).toHaveAttribute('href', '/courses');
  });
});
