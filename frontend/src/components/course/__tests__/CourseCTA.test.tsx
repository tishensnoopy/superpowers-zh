import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import CourseCTA from '../CourseCTA';

const renderWithRouter = (courseName: string) => {
  return render(
    <MemoryRouter>
      <Routes>
        <Route path="/" element={<CourseCTA courseName={courseName} />} />
        <Route path="/appointment-success" element={<div>预约页面</div>} />
      </Routes>
    </MemoryRouter>
  );
};

describe('CourseCTA 组件', () => {
  it('渲染 CTA 标题', () => {
    renderWithRouter('语言启蒙');
    expect(screen.getByText(/预约免费试听/)).toBeInTheDocument();
  });

  it('渲染课程名称', () => {
    renderWithRouter('语言启蒙');
    expect(screen.getByText('语言启蒙')).toBeInTheDocument();
  });

  it('渲染预约按钮', () => {
    renderWithRouter('语言启蒙');
    expect(screen.getByRole('link', { name: /立即预约/ })).toBeInTheDocument();
  });

  it('预约按钮链接到首页预约表单', () => {
    renderWithRouter('语言启蒙');
    const link = screen.getByRole('link', { name: /立即预约/ });
    expect(link).toHaveAttribute('href', '/?course=语言启蒙#appointment');
  });

  it('课程名称为空时仍渲染按钮', () => {
    renderWithRouter('');
    expect(screen.getByRole('link', { name: /立即预约/ })).toBeInTheDocument();
  });
});
