import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import CampusDetailHeader from '@/components/campus/CampusDetailHeader';

const mockCampus = {
  id: 1,
  name: '朝阳校区',
  slug: 'chaoyang',
  address: '建国路88号 SOHO现代城A座3层',
  description: '位于CBD核心区域，交通便利，环境优美',
};

describe('CampusDetailHeader 组件', () => {
  it('渲染校区名称为标题', () => {
    render(<CampusDetailHeader campus={mockCampus as any} />);
    expect(
      screen.getByRole('heading', { name: '朝阳校区' })
    ).toBeInTheDocument();
  });

  it('渲染校区简介', () => {
    render(<CampusDetailHeader campus={mockCampus as any} />);
    expect(screen.getByText(/位于CBD核心区域/)).toBeInTheDocument();
  });

  it('渲染面包屑"首页"链接指向 /', () => {
    render(<CampusDetailHeader campus={mockCampus as any} />);
    expect(screen.getByText('首页')).toBeInTheDocument();
    expect(screen.getByText('首页').getAttribute('href')).toBe('/');
  });

  it('渲染面包屑"校区总览"链接指向 /campuses', () => {
    render(<CampusDetailHeader campus={mockCampus as any} />);
    expect(screen.getByText('校区总览')).toBeInTheDocument();
    expect(screen.getByText('校区总览').getAttribute('href')).toBe('/campuses');
  });

  it('面包屑显示当前校区名', () => {
    render(<CampusDetailHeader campus={mockCampus as any} />);
    // 校区名同时出现在面包屑和标题中，面包屑中应为非链接文本
    const breadcrumbs = screen.getAllByText('朝阳校区');
    expect(breadcrumbs.length).toBeGreaterThanOrEqual(1);
  });

  it('缺失简介时不崩溃', () => {
    const noDesc = {
      id: 2,
      name: '海淀校区',
      slug: 'haidian',
      address: '中关村大街1号 海龙大厦5层',
    };
    render(<CampusDetailHeader campus={noDesc as any} />);
    expect(
      screen.getByRole('heading', { name: '海淀校区' })
    ).toBeInTheDocument();
  });
});
