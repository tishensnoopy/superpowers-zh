import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CampusTeachers from '../CampusTeachers';

const mockTeachers = {
  data: [
    {
      id: 10,
      attributes: {
        name: '王老师',
        slug: 'wang',
        title: '高级教师',
        avatar: { data: { attributes: { url: '/uploads/wang.jpg' } } },
      },
    },
    {
      id: 11,
      attributes: {
        name: '李老师',
        slug: 'li',
        title: '特级教师',
        avatar: { data: null },
      },
    },
  ],
};

describe('CampusTeachers 组件', () => {
  it('渲染区块标题"本校教师"', () => {
    render(
      <MemoryRouter>
        <CampusTeachers teachers={mockTeachers as any} />
      </MemoryRouter>
    );
    expect(
      screen.getByRole('heading', { name: /本校教师/ })
    ).toBeInTheDocument();
  });

  it('渲染所有教师姓名', () => {
    render(
      <MemoryRouter>
        <CampusTeachers teachers={mockTeachers as any} />
      </MemoryRouter>
    );
    expect(screen.getByText('王老师')).toBeInTheDocument();
    expect(screen.getByText('李老师')).toBeInTheDocument();
  });

  it('渲染教师职称', () => {
    render(
      <MemoryRouter>
        <CampusTeachers teachers={mockTeachers as any} />
      </MemoryRouter>
    );
    expect(screen.getByText('高级教师')).toBeInTheDocument();
    expect(screen.getByText('特级教师')).toBeInTheDocument();
  });

  it('无教师时显示空状态', () => {
    render(
      <MemoryRouter>
        <CampusTeachers teachers={undefined} />
      </MemoryRouter>
    );
    expect(screen.getByText(/暂无|更新中|没有/)).toBeInTheDocument();
  });

  it('教师列表为空数组时显示空状态', () => {
    render(
      <MemoryRouter>
        <CampusTeachers teachers={{ data: [] } as any} />
      </MemoryRouter>
    );
    expect(screen.getByText(/暂无|更新中|没有/)).toBeInTheDocument();
  });

  it('每个教师生成详情链接', () => {
    render(
      <MemoryRouter>
        <CampusTeachers teachers={mockTeachers as any} />
      </MemoryRouter>
    );
    const links = screen.getAllByRole('link');
    expect(links.some((l) => l.getAttribute('href') === '/teachers/wang')).toBe(true);
    expect(links.some((l) => l.getAttribute('href') === '/teachers/li')).toBe(true);
  });
});
