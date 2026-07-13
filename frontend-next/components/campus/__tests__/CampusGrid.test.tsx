import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import CampusGrid from '@/components/campus/CampusGrid';

const mockCampuses = [
  {
    id: 1,
    name: '百步亭校区',
    slug: 'yousen-baibuting',
    address: '武汉市江岸区百步亭',
    phone: '027-8888-0001',
  },
  {
    id: 2,
    name: '三阳路校区',
    slug: 'yousen-sanyanglu',
    address: '武汉市江岸区三阳路',
    phone: '027-8888-0002',
  },
  {
    id: 3,
    name: '动物园校区',
    slug: 'yousen-dongwuyuan',
    address: '武汉市汉阳区动物园附近',
    phone: '027-8888-0003',
  },
];

describe('CampusGrid 组件', () => {
  it('渲染所有传入的校区卡片', () => {
    render(<CampusGrid campuses={mockCampuses as any} />);
    expect(screen.getByText('百步亭校区')).toBeInTheDocument();
    expect(screen.getByText('三阳路校区')).toBeInTheDocument();
    expect(screen.getByText('动物园校区')).toBeInTheDocument();
  });

  it('每个校区生成跳转链接', () => {
    render(<CampusGrid campuses={mockCampuses as any} />);
    const links = screen.getAllByRole('link');
    expect(links.some((l) => l.getAttribute('href') === '/campuses/yousen-baibuting')).toBe(true);
    expect(links.some((l) => l.getAttribute('href') === '/campuses/yousen-sanyanglu')).toBe(true);
    expect(links.some((l) => l.getAttribute('href') === '/campuses/yousen-dongwuyuan')).toBe(true);
  });

  it('校区列表为空时显示空状态', () => {
    render(<CampusGrid campuses={[]} />);
    expect(screen.getByText(/暂无|更新中|没有/)).toBeInTheDocument();
  });
});
