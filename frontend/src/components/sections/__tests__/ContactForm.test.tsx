import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ContactForm from '../ContactForm';

// Mock createAppointment
vi.mock('../../../lib/api', () => ({
  createAppointment: vi.fn().mockResolvedValue({ data: { id: 1 } }),
}));

import { createAppointment } from '../../../lib/api';

// 直接数组格式（Strapi v5 实际返回格式）
const mockSectionV5 = {
  __component: 'section.contact-form',
  id: 1,
  title: '预约免费试听',
  description: '填写下方表单，我们将尽快联系您',
  submitText: '立即预约',
  successMessage: '预约成功！',
  fields: [
    { id: 1, label: '孩子姓名', name: 'childName', type: 'text', required: true, placeholder: '请输入孩子姓名', options: null },
    { id: 2, label: '家长姓名', name: 'parentName', type: 'text', required: true, placeholder: '请输入家长姓名', options: null },
    { id: 3, label: '联系电话', name: 'phone', type: 'phone', required: true, placeholder: '请输入手机号码', options: null },
    { id: 4, label: '感兴趣的课程', name: 'course', type: 'select', required: false, placeholder: '请选择', options: JSON.stringify(['语言启蒙', '数学思维']) },
  ],
};

// {data: [...]} 格式（Strapi v4 格式）
const mockSectionV4 = {
  __component: 'section.contact-form',
  id: 1,
  title: '预约免费试听',
  description: '填写下方表单，我们将尽快联系您',
  submitText: '立即预约',
  successMessage: '预约成功！',
  fields: {
    data: [
      { id: 1, attributes: { label: '孩子姓名', name: 'childName', type: 'text', required: true, placeholder: '请输入孩子姓名', options: null } },
      { id: 2, attributes: { label: '家长姓名', name: 'parentName', type: 'text', required: true, placeholder: '请输入家长姓名', options: null } },
      { id: 3, attributes: { label: '联系电话', name: 'phone', type: 'phone', required: true, placeholder: '请输入手机号码', options: null } },
    ],
  },
};

describe('ContactForm 组件', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Strapi v5 格式（直接数组）', () => {
    it('渲染表单标题', () => {
      render(<ContactForm section={mockSectionV5 as any} />);
      expect(screen.getByRole('heading', { name: '预约免费试听' })).toBeInTheDocument();
    });

    it('渲染所有表单字段', () => {
      render(<ContactForm section={mockSectionV5 as any} />);
      expect(screen.getByLabelText(/孩子姓名/)).toBeInTheDocument();
      expect(screen.getByLabelText(/家长姓名/)).toBeInTheDocument();
      expect(screen.getByLabelText(/联系电话/)).toBeInTheDocument();
      expect(screen.getByLabelText(/感兴趣的课程/)).toBeInTheDocument();
    });

    it('渲染提交按钮', () => {
      render(<ContactForm section={mockSectionV5 as any} />);
      expect(screen.getByRole('button', { name: '立即预约' })).toBeInTheDocument();
    });

    it('必填字段为空时显示错误', async () => {
      const user = userEvent.setup();
      render(<ContactForm section={mockSectionV5 as any} />);
      await user.click(screen.getByRole('button', { name: '立即预约' }));
      expect(await screen.findByText(/请输入孩子姓名/)).toBeInTheDocument();
    });

    it('手机号格式错误时显示错误', async () => {
      const user = userEvent.setup();
      render(<ContactForm section={mockSectionV5 as any} />);
      await user.type(screen.getByLabelText(/孩子姓名/), '小明');
      await user.type(screen.getByLabelText(/家长姓名/), '王先生');
      await user.type(screen.getByLabelText(/联系电话/), '123');
      await user.click(screen.getByRole('button', { name: '立即预约' }));
      expect(await screen.findByText(/手机号格式不正确/)).toBeInTheDocument();
    });

    it('提交成功后显示成功消息', async () => {
      const user = userEvent.setup();
      render(<ContactForm section={mockSectionV5 as any} />);
      await user.type(screen.getByLabelText(/孩子姓名/), '小明');
      await user.type(screen.getByLabelText(/家长姓名/), '王先生');
      await user.type(screen.getByLabelText(/联系电话/), '13800138000');
      await user.click(screen.getByRole('button', { name: '立即预约' }));
      expect(await screen.findByText('预约成功！')).toBeInTheDocument();
      expect(createAppointment).toHaveBeenCalledWith({
        childName: '小明',
        parentName: '王先生',
        phone: '13800138000',
        age: undefined,
        course: '',
        preferredTimeSlot: undefined,
        message: undefined,
      });
    });
  });

  describe('Strapi v4 格式（{data: [...]}）', () => {
    it('渲染表单字段', () => {
      render(<ContactForm section={mockSectionV4 as any} />);
      expect(screen.getByLabelText(/孩子姓名/)).toBeInTheDocument();
      expect(screen.getByLabelText(/家长姓名/)).toBeInTheDocument();
      expect(screen.getByLabelText(/联系电话/)).toBeInTheDocument();
    });
  });

  describe('边界情况', () => {
    it('fields 为空数组时不崩溃', () => {
      const emptySection = { __component: 'section.contact-form', id: 2, title: '测试', description: '', fields: [] };
      render(<ContactForm section={emptySection as any} />);
      expect(screen.getByText('测试')).toBeInTheDocument();
    });

    it('fields 为 null 时不崩溃', () => {
      const nullSection = { __component: 'section.contact-form', id: 3, title: '测试2', description: '', fields: null };
      render(<ContactForm section={nullSection as any} />);
      expect(screen.getByText('测试2')).toBeInTheDocument();
    });

    it('提交失败时显示错误消息', async () => {
      vi.mocked(createAppointment).mockRejectedValueOnce(new Error('Network error'));
      const user = userEvent.setup();
      render(<ContactForm section={mockSectionV5 as any} />);
      await user.type(screen.getByLabelText(/孩子姓名/), '小明');
      await user.type(screen.getByLabelText(/家长姓名/), '王先生');
      await user.type(screen.getByLabelText(/联系电话/), '13800138000');
      await user.click(screen.getByRole('button', { name: '立即预约' }));
      expect(await screen.findByText(/提交失败/)).toBeInTheDocument();
    });
  });
});
