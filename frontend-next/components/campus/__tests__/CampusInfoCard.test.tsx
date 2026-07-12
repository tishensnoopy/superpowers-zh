import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import CampusInfoCard from '@/components/campus/CampusInfoCard';

const mockCampus = {
  id: 1,
  name: '朝阳校区',
  slug: 'chaoyang',
  address: '建国路88号 SOHO现代城A座3层',
  phone: '010-8888-0001',
  businessHours: '周一至周日 9:00-21:00',
  transportation: '地铁1号线大望路站C口出，步行300米',
  area: '800㎡',
};

describe('CampusInfoCard 组件', () => {
  it('渲染地址', () => {
    render(<CampusInfoCard campus={mockCampus as any} />);
    expect(screen.getByText('建国路88号 SOHO现代城A座3层')).toBeInTheDocument();
  });

  it('渲染联系电话', () => {
    render(<CampusInfoCard campus={mockCampus as any} />);
    expect(screen.getByText('010-8888-0001')).toBeInTheDocument();
  });

  it('渲染营业时间', () => {
    render(<CampusInfoCard campus={mockCampus as any} />);
    expect(screen.getByText('周一至周日 9:00-21:00')).toBeInTheDocument();
  });

  it('渲染交通信息', () => {
    render(<CampusInfoCard campus={mockCampus as any} />);
    expect(screen.getByText('地铁1号线大望路站C口出，步行300米')).toBeInTheDocument();
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
      name: '海淀校区',
      slug: 'haidian',
      address: '中关村大街1号 海龙大厦5层',
    };
    render(<CampusInfoCard campus={partial as any} />);
    expect(screen.getByText('中关村大街1号 海龙大厦5层')).toBeInTheDocument();
    expect(screen.queryByText('010-')).not.toBeInTheDocument();
    expect(screen.queryByText(/营业时间/)).not.toBeInTheDocument();
    expect(screen.queryByText(/交通/)).not.toBeInTheDocument();
    expect(screen.queryByText(/面积/)).not.toBeInTheDocument();
  });

  it('所有可选字段缺失时仅显示地址', () => {
    const minimal = {
      id: 3,
      name: '西城校区',
      slug: 'xicheng',
      address: '西单北大街110号 西单大悦城6层',
    };
    render(<CampusInfoCard campus={minimal as any} />);
    expect(screen.getByText('西单北大街110号 西单大悦城6层')).toBeInTheDocument();
    const rows = screen.getAllByRole('listitem');
    expect(rows).toHaveLength(1);
  });
});
