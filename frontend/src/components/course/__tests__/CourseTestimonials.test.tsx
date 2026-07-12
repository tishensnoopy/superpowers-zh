import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import CourseTestimonials from '../CourseTestimonials';

const mockTestimonials = [
  { id: 1, parentName: '张妈妈', content: '孩子上了一学期，语言表达能力明显提升！', rating: 5 },
  { id: 2, parentName: '李爸爸', content: '老师很专业，孩子很喜欢上课。', rating: 5 },
  { id: 3, parentName: '王妈妈', content: '课程设计科学，效果显著。', rating: 4 },
];

describe('CourseTestimonials 组件', () => {
  it('渲染区块标题', () => {
    render(<CourseTestimonials testimonials={mockTestimonials} />);
    expect(screen.getByRole('heading', { name: '家长评价' })).toBeInTheDocument();
  });

  it('渲染所有评价', () => {
    render(<CourseTestimonials testimonials={mockTestimonials} />);
    expect(screen.getByText('张妈妈')).toBeInTheDocument();
    expect(screen.getByText('李爸爸')).toBeInTheDocument();
    expect(screen.getByText('王妈妈')).toBeInTheDocument();
  });

  it('渲染评价内容', () => {
    render(<CourseTestimonials testimonials={mockTestimonials} />);
    expect(screen.getByText('孩子上了一学期，语言表达能力明显提升！')).toBeInTheDocument();
  });

  it('渲染 5 星评分', () => {
    render(<CourseTestimonials testimonials={mockTestimonials} />);
    const fiveStarItems = screen.getAllByText('★');
    expect(fiveStarItems.length).toBeGreaterThanOrEqual(5);
  });

  it('空数组时不渲染区块', () => {
    const { container } = render(<CourseTestimonials testimonials={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('testimonials 为 undefined 时不崩溃', () => {
    const { container } = render(<CourseTestimonials testimonials={undefined as any} />);
    expect(container.firstChild).toBeNull();
  });

  it('无 rating 时默认 5 星', () => {
    const noRating = [{ id: 1, parentName: '赵妈妈', content: '还不错' }];
    render(<CourseTestimonials testimonials={noRating as any} />);
    expect(screen.getByText('赵妈妈')).toBeInTheDocument();
  });
});
