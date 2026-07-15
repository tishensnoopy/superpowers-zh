import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import TeamHeader from '../TeamHeader';

describe('TeamHeader 组件', () => {
  it('渲染标题"师资团队"', () => {
    render(<TeamHeader />);
    expect(
      screen.getByRole('heading', { name: '师资团队' })
    ).toBeInTheDocument();
  });

  it('渲染副标题', () => {
    render(<TeamHeader />);
    expect(
      screen.getByText('专业教师阵容 用心陪伴成长')
    ).toBeInTheDocument();
  });

  it('渲染 4 项统计数据', () => {
    render(<TeamHeader />);
    expect(screen.getByText('50+ 专业教师')).toBeInTheDocument();
    expect(screen.getByText('8 校区覆盖')).toBeInTheDocument();
    expect(screen.getByText('10年+ 平均教龄')).toBeInTheDocument();
    expect(screen.getByText('98% 家长好评')).toBeInTheDocument();
  });

  it('统计数据包含关键数字', () => {
    render(<TeamHeader />);
    expect(screen.getByText(/50\+/)).toBeInTheDocument();
    expect(screen.getByText(/8\s*校区覆盖/)).toBeInTheDocument();
    expect(screen.getByText(/10年\+/)).toBeInTheDocument();
    expect(screen.getByText(/98%/)).toBeInTheDocument();
  });
});
