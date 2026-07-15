import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import AppointmentSuccess from '../AppointmentSuccess';

describe('AppointmentSuccess 组件', () => {
  const renderWithRouter = (state?: any) => {
    const routeProps = state ? { state } : {};
    const { container } = render(
      <MemoryRouter initialEntries={[{ pathname: '/appointment-success', ...routeProps }]}>
        <Routes>
          <Route path="/appointment-success" element={<AppointmentSuccess />} />
        </Routes>
      </MemoryRouter>
    );
    return { container };
  };

  describe('有预约数据时', () => {
    it('渲染成功标题', () => {
      renderWithRouter({ appointment: { phone: '13800138000', name: '小明' } });
      expect(screen.getByText('预约成功！')).toBeInTheDocument();
    });

    it('渲染预约信息卡片', () => {
      renderWithRouter({ appointment: { phone: '13800138000', name: '小明' } });
      expect(screen.getByText('预约信息')).toBeInTheDocument();
      expect(screen.getByText('预约姓名')).toBeInTheDocument();
      expect(screen.getByText('联系电话')).toBeInTheDocument();
      expect(screen.getByText('选择校区')).toBeInTheDocument();
    });

    it('渲染返回首页链接', () => {
      renderWithRouter({ appointment: { phone: '13800138000', name: '小明' } });
      expect(screen.getByText('返回首页')).toBeInTheDocument();
      expect(screen.getByText('继续了解课程')).toBeInTheDocument();
    });

    it('渲染客服热线信息', () => {
      renderWithRouter({ appointment: { phone: '13800138000', name: '小明' } });
      expect(screen.getByText('400-888-8888')).toBeInTheDocument();
    });

    it('渲染页面内容', () => {
      const { container } = renderWithRouter({ appointment: { phone: '13800138000', name: '小明' } });
      const paragraphs = container.querySelectorAll('p');
      const texts = Array.from(paragraphs).map(p => p.textContent);
      expect(texts.some(t => t && t.includes('感谢您的信任'))).toBe(true);
      expect(texts.some(t => t && t.includes('24 小时内'))).toBe(true);
    });

    it('显示预约数据', () => {
      renderWithRouter({ 
        appointment: { 
          phone: '13800138000', 
          name: '小明',
          campus: 'chaoyang'
        } 
      });
      expect(screen.getByText('小明')).toBeInTheDocument();
      expect(screen.getByText('13800138000')).toBeInTheDocument();
      expect(screen.getByText('朝阳校区')).toBeInTheDocument();
    });
  });

  describe('无预约数据时', () => {
    it('显示访问受限页面', () => {
      renderWithRouter();
      expect(screen.getByText('访问受限')).toBeInTheDocument();
    });

    it('显示返回首页预约按钮', () => {
      renderWithRouter();
      expect(screen.getByText('返回首页预约')).toBeInTheDocument();
    });

    it('不显示预约成功标题', () => {
      renderWithRouter();
      expect(screen.queryByText('预约成功！')).not.toBeInTheDocument();
    });
  });
});
