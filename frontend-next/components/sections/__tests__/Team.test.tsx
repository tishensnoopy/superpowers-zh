import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Team from '@/components/sections/Team';

// {data: [...]} 格式（Strapi v4 / 旧格式）— v5 扁平化后 items 不再带 attributes 包裹
const mockSectionV4 = {
  __component: 'section.team',
  id: 1,
  title: '资深教师团队',
  description: '8年沉淀，打造出一支专业教师队伍',
  members: {
    data: [
      { id: 1, name: '王老师', position: '教学总监', bio: '北京师范大学学前教育硕士' },
      { id: 2, name: '李老师', position: '语言启蒙组组长', bio: '8年儿童语言教学经验' },
    ],
  },
};

// 直接数组格式（Strapi v5 repeatable component 实际返回格式）
const mockSectionV5 = {
  __component: 'section.team',
  id: 1,
  title: '资深教师团队',
  description: '8年沉淀，打造出一支专业教师队伍',
  members: [
    { id: 1, name: '王老师', position: '教学总监', bio: '北京师范大学学前教育硕士' },
    { id: 2, name: '李老师', position: '语言启蒙组组长', bio: '8年儿童语言教学经验' },
  ],
};

describe('Team 组件', () => {
  describe('Strapi v4 格式（{data: [...]}）', () => {
    it('渲染区块标题', () => {
      render(<Team section={mockSectionV4 as any} />);
      expect(screen.getByText('资深教师团队')).toBeInTheDocument();
    });

    it('渲染成员姓名', () => {
      render(<Team section={mockSectionV4 as any} />);
      expect(screen.getByText('王老师')).toBeInTheDocument();
      expect(screen.getByText('李老师')).toBeInTheDocument();
    });

    it('渲染成员职位', () => {
      render(<Team section={mockSectionV4 as any} />);
      expect(screen.getByText('教学总监')).toBeInTheDocument();
      expect(screen.getByText('语言启蒙组组长')).toBeInTheDocument();
    });

    it('渲染成员简介', () => {
      render(<Team section={mockSectionV4 as any} />);
      expect(screen.getByText(/北京师范大学/)).toBeInTheDocument();
    });
  });

  describe('Strapi v5 格式（直接数组）', () => {
    it('渲染区块标题', () => {
      render(<Team section={mockSectionV5 as any} />);
      expect(screen.getByText('资深教师团队')).toBeInTheDocument();
    });

    it('渲染成员姓名', () => {
      render(<Team section={mockSectionV5 as any} />);
      expect(screen.getByText('王老师')).toBeInTheDocument();
      expect(screen.getByText('李老师')).toBeInTheDocument();
    });

    it('渲染成员职位', () => {
      render(<Team section={mockSectionV5 as any} />);
      expect(screen.getByText('教学总监')).toBeInTheDocument();
      expect(screen.getByText('语言启蒙组组长')).toBeInTheDocument();
    });

    it('渲染成员简介', () => {
      render(<Team section={mockSectionV5 as any} />);
      expect(screen.getByText(/北京师范大学/)).toBeInTheDocument();
    });
  });

  describe('边界情况', () => {
    it('空数据时显示默认内容', () => {
      const emptySection = { __component: 'section.team', id: 2, title: '', description: '', members: { data: [] } };
      render(<Team section={emptySection as any} />);
      expect(screen.getByText('资深教师团队')).toBeInTheDocument();
    });

    it('members 为 null 时不崩溃', () => {
      const nullSection = { __component: 'section.team', id: 3, title: '测试', description: '', members: null };
      render(<Team section={nullSection as any} />);
      expect(screen.getByText('测试')).toBeInTheDocument();
    });

    it('members 为 undefined 时不崩溃', () => {
      const undefinedSection = { __component: 'section.team', id: 4, title: '测试2', description: '' };
      render(<Team section={undefinedSection as any} />);
      expect(screen.getByText('测试2')).toBeInTheDocument();
    });
  });
});
