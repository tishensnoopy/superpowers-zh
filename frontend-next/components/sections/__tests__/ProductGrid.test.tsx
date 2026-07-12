import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import ProductGrid from '@/components/sections/ProductGrid';

// Mock api.ts
vi.mock('@/lib/api', () => ({
  getProducts: vi.fn().mockResolvedValue({
    data: [
      {
        id: 1,
        slug: 'language',
        name: '语言启蒙',
        shortDescription: '培养语言表达能力',
        description: '通过绘本阅读培养语言能力',
        specValues: { course_hours: '48课时', class_size: '小班12人', age_range: '4-6岁', duration: '6个月' },
      },
      {
        id: 2,
        slug: 'math',
        name: '数学思维',
        shortDescription: '建立数学概念',
        description: '通过操作教具建立数学概念',
        specValues: { course_hours: '48课时', class_size: '小班12人', age_range: '4-6岁', duration: '6个月' },
      },
    ],
  }),
}));

const mockSection = {
  __component: 'section.product-grid',
  id: 1,
  title: '精品课程体系',
  description: '由资深教研团队研发',
};

describe('ProductGrid 组件', () => {
  it('渲染区块标题', async () => {
    render(<ProductGrid section={mockSection as any} />);
    expect(screen.getByText('精品课程体系')).toBeInTheDocument();
  });

  it('加载并渲染产品名称', async () => {
    render(<ProductGrid section={mockSection as any} />);
    await waitFor(() => {
      expect(screen.getByText('语言启蒙')).toBeInTheDocument();
      expect(screen.getByText('数学思维')).toBeInTheDocument();
    });
  });

  it('渲染产品简短描述', async () => {
    render(<ProductGrid section={mockSection as any} />);
    await waitFor(() => {
      expect(screen.getByText('培养语言表达能力')).toBeInTheDocument();
    });
  });

  it('渲染产品规格（specValues）', async () => {
    render(<ProductGrid section={mockSection as any} />);
    await waitFor(() => {
      expect(screen.getAllByText(/48课时/).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/小班12人/).length).toBeGreaterThan(0);
    });
  });

  it('空数据时显示默认标题', () => {
    const emptySection = { __component: 'section.product-grid', id: 2, title: '', description: '' };
    render(<ProductGrid section={emptySection as any} />);
    expect(screen.getByText('科学课程，全面衔接小学学习')).toBeInTheDocument();
  });
});
