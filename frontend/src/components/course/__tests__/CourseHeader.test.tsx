import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import CourseHeader from '../CourseHeader';

const mockProduct = {
  id: 1,
  documentId: 'abc123',
  name: '语言启蒙',
  slug: 'language',
  shortDescription: '培养孩子语言表达能力与阅读兴趣',
  specValues: {
    course_hours: '48课时',
    class_size: '小班12人',
    age_range: '4-6岁',
    duration: '6个月',
  },
};

describe('CourseHeader 组件', () => {
  it('渲染课程名称', () => {
    render(<CourseHeader product={mockProduct as any} />);
    expect(screen.getByRole('heading', { name: '语言启蒙' })).toBeInTheDocument();
  });

  it('渲染课程简短描述', () => {
    render(<CourseHeader product={mockProduct as any} />);
    expect(screen.getByText('培养孩子语言表达能力与阅读兴趣')).toBeInTheDocument();
  });

  it('渲染规格标签', () => {
    render(<CourseHeader product={mockProduct as any} />);
    expect(screen.getByText('48课时')).toBeInTheDocument();
    expect(screen.getByText('小班12人')).toBeInTheDocument();
    expect(screen.getByText('4-6岁')).toBeInTheDocument();
    expect(screen.getByText('6个月')).toBeInTheDocument();
  });

  it('缺失 specValues 时不崩溃', () => {
    const noSpecs = { id: 2, name: '测试课程', slug: 'test' };
    render(<CourseHeader product={noSpecs as any} />);
    expect(screen.getByRole('heading', { name: '测试课程' })).toBeInTheDocument();
  });

  it('缺失 shortDescription 时不崩溃', () => {
    const noDesc = { id: 3, name: '无描述课程', slug: 'nodesc', specValues: {} };
    render(<CourseHeader product={noDesc as any} />);
    expect(screen.getByRole('heading', { name: '无描述课程' })).toBeInTheDocument();
  });

  it('渲染价格和原价（含删除线）', () => {
    const withPrice = {
      id: 4,
      name: '带价格课程',
      slug: 'priced',
      price: 2999,
      originalPrice: 3999,
    };
    render(<CourseHeader product={withPrice as any} />);
    expect(screen.getByText('¥2999')).toBeInTheDocument();
    expect(screen.getByText('¥3999')).toBeInTheDocument();
  });

  it('仅渲染价格无原价时不显示删除线', () => {
    const onlyPrice = {
      id: 5,
      name: '仅价格课程',
      slug: 'only-price',
      price: 1999,
    };
    render(<CourseHeader product={onlyPrice as any} />);
    expect(screen.getByText('¥1999')).toBeInTheDocument();
  });
});
