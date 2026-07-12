import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Features from '../Features';

const mockFeatures = [
  { id: 1, title: '办学许可证', description: '北京市教育委员会颁发的正规办学许可证', icon: 'Award' },
  { id: 2, title: 'ISO9001认证', description: '通过国际质量管理体系认证', icon: 'CheckCircle' },
  { id: 3, title: '优秀培训机构', description: '2024年度北京市优秀教育培训机构评选获奖', icon: 'Star' },
  { id: 4, title: '家长信赖品牌', description: '连续3年获得家长信赖教育品牌称号', icon: 'Heart' },
  { id: 5, title: '教师认证', description: '所有教师均持有教师资格证', icon: 'GraduationCap' },
  { id: 6, title: '安全认证', description: '通过消防安全、卫生防疫等多项安全认证', icon: 'Shield' },
];

// Strapi v4 格式（{data: [...]}）
const mockSectionV4 = {
  __component: 'section.features',
  id: 1,
  title: '资质荣誉',
  description: '我们以专业品质赢得信赖',
  features: { data: mockFeatures },
};

// Strapi v5 repeatable component 实际返回格式（直接数组）
const mockSectionV5 = {
  __component: 'section.features',
  id: 1,
  title: '资质荣誉',
  description: '我们以专业品质赢得信赖',
  features: mockFeatures,
};

describe('Features 组件', () => {
  describe('Strapi v4 格式（{data: [...]}）', () => {
    it('渲染区块标题', () => {
      render(<Features section={mockSectionV4 as any} />);
      expect(screen.getByRole('heading', { name: '资质荣誉' })).toBeInTheDocument();
    });

    it('渲染所有荣誉卡片', () => {
      render(<Features section={mockSectionV4 as any} />);
      expect(screen.getByText('办学许可证')).toBeInTheDocument();
      expect(screen.getByText('ISO9001认证')).toBeInTheDocument();
      expect(screen.getByText('优秀培训机构')).toBeInTheDocument();
      expect(screen.getByText('家长信赖品牌')).toBeInTheDocument();
      expect(screen.getByText('教师认证')).toBeInTheDocument();
      expect(screen.getByText('安全认证')).toBeInTheDocument();
    });
  });

  describe('Strapi v5 格式（直接数组）', () => {
    it('渲染区块标题', () => {
      render(<Features section={mockSectionV5 as any} />);
      expect(screen.getByRole('heading', { name: '资质荣誉' })).toBeInTheDocument();
    });

    it('渲染所有荣誉卡片', () => {
      render(<Features section={mockSectionV5 as any} />);
      expect(screen.getByText('办学许可证')).toBeInTheDocument();
      expect(screen.getByText('ISO9001认证')).toBeInTheDocument();
      expect(screen.getByText('优秀培训机构')).toBeInTheDocument();
      expect(screen.getByText('家长信赖品牌')).toBeInTheDocument();
      expect(screen.getByText('教师认证')).toBeInTheDocument();
      expect(screen.getByText('安全认证')).toBeInTheDocument();
    });
  });

  describe('边界情况', () => {
    it('features 为 null 时不崩溃', () => {
      const nullSection = { __component: 'section.features', id: 2, title: '测试', description: '', features: null };
      render(<Features section={nullSection as any} />);
      expect(screen.getByText('测试')).toBeInTheDocument();
    });

    it('features 为 undefined 时不崩溃', () => {
      const undefinedSection = { __component: 'section.features', id: 3, title: '测试2', description: '' };
      render(<Features section={undefinedSection as any} />);
      expect(screen.getByText('测试2')).toBeInTheDocument();
    });

    it('空数组时不崩溃', () => {
      const emptySection = { __component: 'section.features', id: 4, title: '空测试', description: '', features: [] };
      render(<Features section={emptySection as any} />);
      expect(screen.getByText('空测试')).toBeInTheDocument();
    });
  });
});
