import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Team from '../Team';

const mockSection = {
  __component: 'section.team',
  id: 1,
  title: '资深教师团队',
  description: '8年沉淀，打造出一支专业教师队伍',
  members: {
    data: [
      { id: 1, attributes: { name: '王老师', position: '教学总监', bio: '北京师范大学学前教育硕士' } },
      { id: 2, attributes: { name: '李老师', position: '语言启蒙组组长', bio: '8年儿童语言教学经验' } },
    ],
  },
};

describe('Team 组件', () => {
  it('渲染区块标题', () => {
    render(<Team section={mockSection as any} />);
    expect(screen.getByText('资深教师团队')).toBeInTheDocument();
  });

  it('渲染成员姓名', () => {
    render(<Team section={mockSection as any} />);
    expect(screen.getByText('王老师')).toBeInTheDocument();
    expect(screen.getByText('李老师')).toBeInTheDocument();
  });

  it('渲染成员职位', () => {
    render(<Team section={mockSection as any} />);
    expect(screen.getByText('教学总监')).toBeInTheDocument();
    expect(screen.getByText('语言启蒙组组长')).toBeInTheDocument();
  });

  it('渲染成员简介', () => {
    render(<Team section={mockSection as any} />);
    expect(screen.getByText(/北京师范大学/)).toBeInTheDocument();
  });

  it('空数据时显示默认内容', () => {
    const emptySection = { __component: 'section.team', id: 2, title: '', description: '', members: { data: [] } };
    render(<Team section={emptySection as any} />);
    expect(screen.getByText('资深教师团队')).toBeInTheDocument();
  });
});
