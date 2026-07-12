import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import CourseCTA from '@/components/course/CourseCTA';

describe('CourseCTA 组件', () => {
  it('渲染 CTA 标题', () => {
    render(<CourseCTA courseName="语言启蒙" />);
    expect(screen.getByText(/预约免费试听/)).toBeInTheDocument();
  });

  it('渲染课程名称', () => {
    render(<CourseCTA courseName="语言启蒙" />);
    expect(screen.getByText('语言启蒙')).toBeInTheDocument();
  });

  it('渲染预约按钮', () => {
    render(<CourseCTA courseName="语言启蒙" />);
    expect(screen.getByRole('link', { name: /立即预约/ })).toBeInTheDocument();
  });

  it('预约按钮链接到首页预约表单', () => {
    render(<CourseCTA courseName="语言启蒙" />);
    const link = screen.getByRole('link', { name: /立即预约/ });
    expect(link).toHaveAttribute('href', '/?course=语言启蒙#appointment');
  });

  it('课程名称为空时仍渲染按钮', () => {
    render(<CourseCTA courseName="" />);
    expect(screen.getByRole('link', { name: /立即预约/ })).toBeInTheDocument();
  });
});
