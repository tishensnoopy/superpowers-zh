import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import AppointmentSuccess from '../AppointmentSuccess';

describe('AppointmentSuccess 组件', () => {
  const renderWithRouter = () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/appointment-success']}>
        <Routes>
          <Route path="/appointment-success" element={<AppointmentSuccess />} />
        </Routes>
      </MemoryRouter>
    );
    return { container };
  };

  it('渲染成功标题', () => {
    renderWithRouter();
    expect(screen.getByText('预约成功！')).toBeInTheDocument();
  });

  it('渲染预约信息卡片', () => {
    renderWithRouter();
    expect(screen.getByText('预约信息')).toBeInTheDocument();
    expect(screen.getByText('孩子姓名')).toBeInTheDocument();
    expect(screen.getByText('联系电话')).toBeInTheDocument();
  });

  it('渲染返回首页链接', () => {
    renderWithRouter();
    expect(screen.getByText('返回首页')).toBeInTheDocument();
    expect(screen.getByText('继续了解课程')).toBeInTheDocument();
  });

  it('渲染客服热线信息', () => {
    renderWithRouter();
    expect(screen.getByText('400-888-8888')).toBeInTheDocument();
  });

  it('渲染页面内容', () => {
    const { container } = renderWithRouter();
    const paragraphs = container.querySelectorAll('p');
    const texts = Array.from(paragraphs).map(p => p.textContent);
    expect(texts.some(t => t && t.includes('感谢您的信任'))).toBe(true);
    expect(texts.some(t => t && t.includes('24 小时内'))).toBe(true);
  });
});
