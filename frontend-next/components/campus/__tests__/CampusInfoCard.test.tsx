import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import CampusInfoCard from '@/components/campus/CampusInfoCard';

const mockCampus = {
  id: 1,
  name: '百步亭校区',
  slug: 'yousen-baibuting',
  address: '武汉市江岸区百步亭',
  phone: '027-8888-0001',
  businessHours: '周一至周日 9:00-21:00',
  transportation: '地铁1号线丹水池站D口出，步行300米',
  area: '800㎡',
};

describe('CampusInfoCard 组件', () => {
  it('渲染地址', () => {
    render(<CampusInfoCard campus={mockCampus as any} />);
    expect(screen.getByText('武汉市江岸区百步亭')).toBeInTheDocument();
  });

  it('渲染联系电话', () => {
    render(<CampusInfoCard campus={mockCampus as any} />);
    expect(screen.getByText('027-8888-0001')).toBeInTheDocument();
  });

  it('渲染营业时间', () => {
    render(<CampusInfoCard campus={mockCampus as any} />);
    expect(screen.getByText('周一至周日 9:00-21:00')).toBeInTheDocument();
  });

  it('渲染交通信息', () => {
    render(<CampusInfoCard campus={mockCampus as any} />);
    expect(screen.getByText('地铁1号线丹水池站D口出，步行300米')).toBeInTheDocument();
  });

  it('渲染教学面积', () => {
    render(<CampusInfoCard campus={mockCampus as any} />);
    expect(screen.getByText('800㎡')).toBeInTheDocument();
  });

  it('渲染标题', () => {
    render(<CampusInfoCard campus={mockCampus as any} />);
    expect(screen.getByRole('heading', { name: '校区信息' })).toBeInTheDocument();
  });

  it('缺失可选字段时不显示对应行', () => {
    const partial = {
      id: 2,
      name: '三阳路校区',
      slug: 'yousen-sanyanglu',
      address: '武汉市江岸区三阳路',
    };
    render(<CampusInfoCard campus={partial as any} />);
    expect(screen.getByText('武汉市江岸区三阳路')).toBeInTheDocument();
    expect(screen.queryByText('027-')).not.toBeInTheDocument();
    expect(screen.queryByText(/营业时间/)).not.toBeInTheDocument();
    expect(screen.queryByText(/交通/)).not.toBeInTheDocument();
    expect(screen.queryByText(/面积/)).not.toBeInTheDocument();
  });

  it('所有可选字段缺失时仅显示地址', () => {
    const minimal = {
      id: 3,
      name: '动物园校区',
      slug: 'yousen-dongwuyuan',
      address: '武汉市汉阳区动物园附近',
    };
    render(<CampusInfoCard campus={minimal as any} />);
    expect(screen.getByText('武汉市汉阳区动物园附近')).toBeInTheDocument();
    const rows = screen.getAllByRole('listitem');
    expect(rows).toHaveLength(1);
  });
});
