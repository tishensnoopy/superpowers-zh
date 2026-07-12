import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import CampusCard from '@/components/campus/CampusCard';

const mockCampus = {
  id: 1,
  name: '朝阳校区',
  slug: 'chaoyang',
  address: '建国路88号 SOHO现代城A座3层',
  phone: '010-8888-0001',
  coverImage: { url: '/uploads/chaoyang.jpg' },
};

describe('CampusCard 组件', () => {
  it('渲染校区名称', () => {
    render(<CampusCard campus={mockCampus as any} />);
    expect(screen.getByText('朝阳校区')).toBeInTheDocument();
  });

  it('渲染校区地址', () => {
    render(<CampusCard campus={mockCampus as any} />);
    expect(screen.getByText('建国路88号 SOHO现代城A座3层')).toBeInTheDocument();
  });

  it('渲染校区电话', () => {
    render(<CampusCard campus={mockCampus as any} />);
    expect(screen.getByText('010-8888-0001')).toBeInTheDocument();
  });

  it('渲染封面图', () => {
    render(<CampusCard campus={mockCampus as any} />);
    const img = screen.getByRole('img', { name: '朝阳校区' });
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', expect.stringContaining('/uploads/chaoyang.jpg'));
  });

  it('点击跳转链接指向 /campuses/:slug', () => {
    render(<CampusCard campus={mockCampus as any} />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/campuses/chaoyang');
  });

  it('无封面图时不崩溃（显示占位）', () => {
    const noImage = {
      id: 2,
      name: '海淀校区',
      slug: 'haidian',
      address: '中关村大街1号 海龙大厦5层',
      phone: '010-8888-0002',
    };
    render(<CampusCard campus={noImage as any} />);
    expect(screen.getByText('海淀校区')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('缺失电话时不崩溃', () => {
    const noPhone = {
      id: 3,
      name: '西城校区',
      slug: 'xicheng',
      address: '西单北大街110号 西单大悦城6层',
    };
    render(<CampusCard campus={noPhone as any} />);
    expect(screen.getByText('西城校区')).toBeInTheDocument();
    expect(screen.queryByText('010-')).not.toBeInTheDocument();
  });
});
