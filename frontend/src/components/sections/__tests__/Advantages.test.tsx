import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Advantages from '../Advantages';

// {data: [...]} 格式（Strapi v4 / 旧格式）— v5 扁平化后 items 不再带 attributes 包裹
const mockSectionV4 = {
  __component: 'section.advantages',
  id: 1,
  title: '为什么选择我们',
  description: '我们深知每位家长对孩子教育的期望与用心',
  advantages: {
    data: [
      { id: 1, title: '专业师资', description: '8年幼小衔接教学经验', icon: 'GraduationCap', color: '#F5851F', bgColor: '#FFF3E5' },
      { id: 2, title: '科学课程', description: '对标小学课程标准', icon: 'BookOpen', color: '#2563EB', bgColor: '#EFF6FF' },
      { id: 3, title: '安全环境', description: '全程监控覆盖', icon: 'Shield', color: '#059669', bgColor: '#ECFDF5' },
      { id: 4, title: '小班教学', description: '每班不超过12人', icon: 'Users', color: '#7C3AED', bgColor: '#F5F3FF' },
    ],
  },
};

// 直接数组格式（Strapi v5 repeatable component 实际返回格式）
const mockSectionV5 = {
  __component: 'section.advantages',
  id: 1,
  title: '为什么选择我们',
  description: '我们深知每位家长对孩子教育的期望与用心',
  advantages: [
    { id: 1, title: '专业师资', description: '8年幼小衔接教学经验', icon: 'GraduationCap', color: '#F5851F', bgColor: '#FFF3E5' },
    { id: 2, title: '科学课程', description: '对标小学课程标准', icon: 'BookOpen', color: '#2563EB', bgColor: '#EFF6FF' },
    { id: 3, title: '安全环境', description: '全程监控覆盖', icon: 'Shield', color: '#059669', bgColor: '#ECFDF5' },
    { id: 4, title: '小班教学', description: '每班不超过12人', icon: 'Users', color: '#7C3AED', bgColor: '#F5F3FF' },
  ],
};

describe('Advantages 组件', () => {
  describe('Strapi v4 格式（{data: [...]}）', () => {
    it('渲染区块标题', () => {
      render(<Advantages section={mockSectionV4 as any} />);
      expect(screen.getByRole('heading', { name: '为什么选择我们' })).toBeInTheDocument();
    });

    it('渲染区块描述', () => {
      render(<Advantages section={mockSectionV4 as any} />);
      expect(screen.getByText(/我们深知每位家长/)).toBeInTheDocument();
    });

    it('渲染所有优势项', () => {
      render(<Advantages section={mockSectionV4 as any} />);
      expect(screen.getByText('专业师资')).toBeInTheDocument();
      expect(screen.getByText('科学课程')).toBeInTheDocument();
      expect(screen.getByText('安全环境')).toBeInTheDocument();
      expect(screen.getByText('小班教学')).toBeInTheDocument();
    });
  });

  describe('Strapi v5 格式（直接数组）', () => {
    it('渲染区块标题', () => {
      render(<Advantages section={mockSectionV5 as any} />);
      expect(screen.getByRole('heading', { name: '为什么选择我们' })).toBeInTheDocument();
    });

    it('渲染所有优势项', () => {
      render(<Advantages section={mockSectionV5 as any} />);
      expect(screen.getByText('专业师资')).toBeInTheDocument();
      expect(screen.getByText('科学课程')).toBeInTheDocument();
      expect(screen.getByText('安全环境')).toBeInTheDocument();
      expect(screen.getByText('小班教学')).toBeInTheDocument();
    });
  });

  describe('边界情况', () => {
    it('空数据时显示默认内容', () => {
      const emptySection = { __component: 'section.advantages', id: 2, title: '', description: '', advantages: { data: [] } };
      render(<Advantages section={emptySection as any} />);
      expect(screen.getByText('4大核心优势，给孩子最好的起点')).toBeInTheDocument();
    });

    it('advantages 为 null 时不崩溃', () => {
      const nullSection = { __component: 'section.advantages', id: 3, title: '测试', description: '', advantages: null };
      render(<Advantages section={nullSection as any} />);
      expect(screen.getByText('测试')).toBeInTheDocument();
    });

    it('advantages 为 undefined 时不崩溃', () => {
      const undefinedSection = { __component: 'section.advantages', id: 4, title: '测试2', description: '' };
      render(<Advantages section={undefinedSection as any} />);
      expect(screen.getByText('测试2')).toBeInTheDocument();
    });
  });
});
