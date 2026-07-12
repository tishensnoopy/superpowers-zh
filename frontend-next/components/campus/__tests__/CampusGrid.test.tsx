import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import CampusGrid from '@/components/campus/CampusGrid';

const mockCampuses = [
  {
    id: 1,
    name: '朝阳校区',
    slug: 'chaoyang',
    address: '建国路88号 SOHO现代城A座3层',
    phone: '010-8888-0001',
  },
  {
    id: 2,
    name: '海淀校区',
    slug: 'haidian',
    address: '中关村大街1号 海龙大厦5层',
    phone: '010-8888-0002',
  },
  {
    id: 3,
    name: '西城校区',
    slug: 'xicheng',
    address: '西单北大街110号 西单大悦城6层',
    phone: '010-8888-0003',
  },
];

describe('CampusGrid 组件', () => {
  it('渲染所有传入的校区卡片', () => {
    render(<CampusGrid campuses={mockCampuses as any} />);
    expect(screen.getByText('朝阳校区')).toBeInTheDocument();
    expect(screen.getByText('海淀校区')).toBeInTheDocument();
    expect(screen.getByText('西城校区')).toBeInTheDocument();
  });

  it('每个校区生成跳转链接', () => {
    render(<CampusGrid campuses={mockCampuses as any} />);
    const links = screen.getAllByRole('link');
    expect(links.some((l) => l.getAttribute('href') === '/campuses/chaoyang')).toBe(true);
    expect(links.some((l) => l.getAttribute('href') === '/campuses/haidian')).toBe(true);
    expect(links.some((l) => l.getAttribute('href') === '/campuses/xicheng')).toBe(true);
  });

  it('校区列表为空时显示空状态', () => {
    render(<CampusGrid campuses={[]} />);
    expect(screen.getByText(/暂无|更新中|没有/)).toBeInTheDocument();
  });
});
