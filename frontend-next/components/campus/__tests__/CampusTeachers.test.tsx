import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import CampusTeachers from '@/components/campus/CampusTeachers';

const mockTeachers = [
  {
    id: 10,
    name: '王老师',
    slug: 'wang',
    title: '高级教师',
    avatar: { url: '/uploads/wang.jpg' },
  },
  {
    id: 11,
    name: '李老师',
    slug: 'li',
    title: '特级教师',
    avatar: null,
  },
];

describe('CampusTeachers 组件', () => {
  it('渲染区块标题"本校教师"', () => {
    render(<CampusTeachers teachers={mockTeachers as any} />);
    expect(
      screen.getByRole('heading', { name: /本校教师/ })
    ).toBeInTheDocument();
  });

  it('渲染所有教师姓名', () => {
    render(<CampusTeachers teachers={mockTeachers as any} />);
    expect(screen.getByText('王老师')).toBeInTheDocument();
    expect(screen.getByText('李老师')).toBeInTheDocument();
  });

  it('渲染教师职称', () => {
    render(<CampusTeachers teachers={mockTeachers as any} />);
    expect(screen.getByText('高级教师')).toBeInTheDocument();
    expect(screen.getByText('特级教师')).toBeInTheDocument();
  });

  it('无教师时显示空状态', () => {
    render(<CampusTeachers teachers={undefined} />);
    expect(screen.getByText(/暂无|更新中|没有/)).toBeInTheDocument();
  });

  it('教师列表为空数组时显示空状态', () => {
    render(<CampusTeachers teachers={[]} />);
    expect(screen.getByText(/暂无|更新中|没有/)).toBeInTheDocument();
  });

  it('每个教师生成详情链接', () => {
    render(<CampusTeachers teachers={mockTeachers as any} />);
    const links = screen.getAllByRole('link');
    expect(links.some((l) => l.getAttribute('href') === '/teachers/wang')).toBe(true);
    expect(links.some((l) => l.getAttribute('href') === '/teachers/li')).toBe(true);
  });
});
