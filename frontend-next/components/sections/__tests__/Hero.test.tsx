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

  it('后台提供的 image1/image2 优先于默认占位图', () => {
    render(
      <Hero
        section={
          {
            ...mockSection,
            image1: { url: '/uploads/custom1.png' },
            image2: { url: '/uploads/custom2.png' },
          } as any
        }
      />
    );
    const srcs = screen.getAllByRole('img').map((i) => i.getAttribute('src') || '');
    expect(srcs.some((s) => s.includes('custom1.png'))).toBe(true);
    expect(srcs.some((s) => s.includes('custom2.png'))).toBe(true);
    expect(srcs.some((s) => s.includes('unsplash'))).toBe(false);
  });

  it('后台提供的 badgeText 覆盖默认徽章文案', () => {
    render(<Hero section={{ ...mockSection, badgeText: '金牌师资' } as any} />);
    expect(screen.getByText('金牌师资')).toBeInTheDocument();
  });

  it('后台提供的 stats 覆盖默认统计数字', () => {
    render(
      <Hero
        section={
          {
            ...mockSection,
            stats: [
              { value: '10年+', label: '办学经验' },
              { value: '8所', label: '直营校区' },
            ],
          } as any
        }
      />
    );
    expect(screen.getByText('10年+')).toBeInTheDocument();
    expect(screen.getByText('办学经验')).toBeInTheDocument();
    expect(screen.queryByText('8年+')).not.toBeInTheDocument();
  });
});
