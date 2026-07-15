import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import CampusCard from '@/components/campus/CampusCard';

const mockCampus = {
  id: 1,
  name: '百步亭校区',
  slug: 'yousen-baibuting',
  address: '武汉市江岸区百步亭',
  phone: '027-8888-0001',
  coverImage: { url: '/uploads/baibuting.jpg' },
};

describe('CampusCard 组件', () => {
  it('渲染校区名称', () => {
    render(<CampusCard campus={mockCampus as any} />);
    expect(screen.getByText('百步亭校区')).toBeInTheDocument();
  });

  it('渲染校区地址', () => {
    render(<CampusCard campus={mockCampus as any} />);
    expect(screen.getByText('武汉市江岸区百步亭')).toBeInTheDocument();
  });

  it('渲染校区电话', () => {
    render(<CampusCard campus={mockCampus as any} />);
    expect(screen.getByText('027-8888-0001')).toBeInTheDocument();
  });

  it('渲染封面图', () => {
    render(<CampusCard campus={mockCampus as any} />);
    const img = screen.getByRole('img', { name: '百步亭校区' });
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', expect.stringContaining('/uploads/baibuting.jpg'));
  });

  it('点击跳转链接指向 /campuses/:slug', () => {
    render(<CampusCard campus={mockCampus as any} />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/campuses/yousen-baibuting');
  });

  it('无封面图时不崩溃（显示占位）', () => {
    const noImage = {
      id: 2,
      name: '三阳路校区',
      slug: 'yousen-sanyanglu',
      address: '武汉市江岸区三阳路',
      phone: '027-8888-0002',
    };
    render(<CampusCard campus={noImage as any} />);
    expect(screen.getByText('三阳路校区')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('缺失电话时不崩溃', () => {
    const noPhone = {
      id: 3,
      name: '动物园校区',
      slug: 'yousen-dongwuyuan',
      address: '武汉市汉阳区动物园附近',
    };
    render(<CampusCard campus={noPhone as any} />);
    expect(screen.getByText('动物园校区')).toBeInTheDocument();
    expect(screen.queryByText('027-')).not.toBeInTheDocument();
  });
});
