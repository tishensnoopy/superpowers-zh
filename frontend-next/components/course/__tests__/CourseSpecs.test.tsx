import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import CourseSpecs from '@/components/course/CourseSpecs';

describe('CourseSpecs 组件', () => {
  const mockProduct = {
    id: 1,
    name: '幼小衔接全能班',
    slug: 'yousen-youxiao-xianjie',
    specValues: {
      course_hours: '160课时',
      class_size: '16-20人',
      age_range: '5-6岁',
      duration: '8个月',
    },
    price: 9800,
    originalPrice: 12800,
  };

  it('specValues 有值时渲染网格', () => {
    render(<CourseSpecs product={mockProduct as any} />);
    expect(screen.getByText('160课时')).toBeInTheDocument();
    expect(screen.getByText('16-20人')).toBeInTheDocument();
    expect(screen.getByText('5-6岁')).toBeInTheDocument();
    expect(screen.getByText('8个月')).toBeInTheDocument();
  });

  it('specValues 网格渲染标签', () => {
    render(<CourseSpecs product={mockProduct as any} />);
    expect(screen.getByText('课时')).toBeInTheDocument();
    expect(screen.getByText('班额')).toBeInTheDocument();
    expect(screen.getByText('年龄')).toBeInTheDocument();
    expect(screen.getByText('周期')).toBeInTheDocument();
  });

  it('渲染价格独立区块（现价 + 原价划线）', () => {
    render(<CourseSpecs product={mockProduct as any} />);
    expect(screen.getByText('¥9,800')).toBeInTheDocument();
    expect(screen.getByText('¥12,800')).toBeInTheDocument();
  });

  it('原价等于现价时不渲染划线价', () => {
    const product = { ...mockProduct, originalPrice: 9800 };
    render(<CourseSpecs product={product as any} />);
    expect(screen.getByText('¥9,800')).toBeInTheDocument();
    expect(screen.queryByText('¥9,800')).toBeInTheDocument();
  });

  it('价格为 0 或 undefined 时不渲染价格区块', () => {
    const product = { ...mockProduct, price: 0, originalPrice: undefined };
    render(<CourseSpecs product={product as any} />);
    expect(screen.queryByText(/¥/)).not.toBeInTheDocument();
  });

  it('specValues 为空时不渲染网格但渲染价格区块', () => {
    const product = { ...mockProduct, specValues: {} };
    render(<CourseSpecs product={product as any} />);
    expect(screen.getByText('¥9,800')).toBeInTheDocument();
    expect(screen.queryByText('160课时')).not.toBeInTheDocument();
  });

  it('渲染容器有规格标题', () => {
    render(<CourseSpecs product={mockProduct as any} />);
    expect(screen.getByText(/课程规格/)).toBeInTheDocument();
  });
});
