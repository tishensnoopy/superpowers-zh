import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Advantages from '../Advantages';

const mockSection = {
  __component: 'section.advantages',
  id: 1,
  title: '为什么选择我们',
  description: '我们深知每位家长对孩子教育的期望与用心',
  advantages: {
    data: [
      { id: 1, attributes: { title: '专业师资', description: '8年幼小衔接教学经验', icon: 'GraduationCap', color: '#F5851F', bgColor: '#FFF3E5' } },
      { id: 2, attributes: { title: '科学课程', description: '对标小学课程标准', icon: 'BookOpen', color: '#2563EB', bgColor: '#EFF6FF' } },
      { id: 3, attributes: { title: '安全环境', description: '全程监控覆盖', icon: 'Shield', color: '#059669', bgColor: '#ECFDF5' } },
      { id: 4, attributes: { title: '小班教学', description: '每班不超过12人', icon: 'Users', color: '#7C3AED', bgColor: '#F5F3FF' } },
    ],
  },
};

describe('Advantages 组件', () => {
  it('渲染区块标题', () => {
    render(<Advantages section={mockSection as any} />);
    expect(screen.getByRole('heading', { name: '为什么选择我们' })).toBeInTheDocument();
  });

  it('渲染区块描述', () => {
    render(<Advantages section={mockSection as any} />);
    expect(screen.getByText(/我们深知每位家长/)).toBeInTheDocument();
  });

  it('渲染所有优势项', () => {
    render(<Advantages section={mockSection as any} />);
    expect(screen.getByText('专业师资')).toBeInTheDocument();
    expect(screen.getByText('科学课程')).toBeInTheDocument();
    expect(screen.getByText('安全环境')).toBeInTheDocument();
    expect(screen.getByText('小班教学')).toBeInTheDocument();
  });

  it('空数据时显示默认内容', () => {
    const emptySection = { __component: 'section.advantages', id: 2, title: '', description: '', advantages: { data: [] } };
    render(<Advantages section={emptySection as any} />);
    expect(screen.getByText('4大核心优势，给孩子最好的起点')).toBeInTheDocument();
  });
});
