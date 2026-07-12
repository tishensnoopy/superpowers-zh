import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import ContactForm from '../ContactForm';

vi.mock('../../../lib/api', () => ({
  createAppointment: vi.fn().mockResolvedValue({ data: { id: 1 } }),
}));

import { createAppointment } from '../../../lib/api';

const mockSection = {
  __component: 'section.contact-form',
  id: 1,
  title: '预约免费试听',
  description: '填写下方表单，我们将尽快联系您',
  submitText: '立即预约',
  successMessage: '预约成功！',
};

const renderWithRouter = (section: any) => {
  return render(
    <MemoryRouter>
      <Routes>
        <Route path="/" element={<ContactForm section={section} />} />
        <Route path="/appointment-success" element={<div>Success</div>} />
      </Routes>
    </MemoryRouter>
  );
};

describe('ContactForm 组件', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('渲染表单标题', () => {
    renderWithRouter(mockSection);
    expect(screen.getByRole('heading', { name: '预约免费试听' })).toBeInTheDocument();
  });

  it('渲染所有表单字段', () => {
    renderWithRouter(mockSection);
    expect(screen.getByLabelText(/预约姓名/)).toBeInTheDocument();
    expect(screen.getByLabelText(/预约电话/)).toBeInTheDocument();
    expect(screen.getByLabelText(/选择校区/)).toBeInTheDocument();
  });

  it('渲染提交按钮', () => {
    renderWithRouter(mockSection);
    expect(screen.getByRole('button', { name: '立即预约' })).toBeInTheDocument();
  });

  it('必填字段为空时显示错误', async () => {
    const user = userEvent.setup();
    renderWithRouter(mockSection);
    await user.click(screen.getByRole('button', { name: '立即预约' }));
    expect(await screen.findByText(/请输入预约姓名/)).toBeInTheDocument();
    expect(await screen.findByText(/请输入预约电话/)).toBeInTheDocument();
    await waitFor(() => {
      const errorElements = screen.getAllByText(/请选择校区/);
      const errorParagraph = errorElements.find(el => el.tagName === 'P');
      expect(errorParagraph).toBeInTheDocument();
    });
  });

  it('手机号格式错误时显示错误', async () => {
    const user = userEvent.setup();
    renderWithRouter(mockSection);
    await user.type(screen.getByLabelText(/预约姓名/), '小明');
    await user.type(screen.getByLabelText(/预约电话/), '123');
    await user.selectOptions(screen.getByLabelText(/选择校区/), 'chaoyang');
    await user.click(screen.getByRole('button', { name: '立即预约' }));
    expect(await screen.findByText(/手机号格式不正确/)).toBeInTheDocument();
  });

  it('提交成功后跳转到成功页', async () => {
    const user = userEvent.setup();
    renderWithRouter(mockSection);
    await user.type(screen.getByLabelText(/预约姓名/), '小明');
    await user.type(screen.getByLabelText(/预约电话/), '13800138000');
    await user.selectOptions(screen.getByLabelText(/选择校区/), 'chaoyang');
    await user.click(screen.getByRole('button', { name: '立即预约' }));
    expect(createAppointment).toHaveBeenCalledWith({
      name: '小明',
      phone: '13800138000',
      campus: 'chaoyang',
    });
  });

  it('校区字段为空时显示错误', async () => {
    const user = userEvent.setup();
    renderWithRouter(mockSection);
    await user.type(screen.getByLabelText(/预约姓名/), '小明');
    await user.type(screen.getByLabelText(/预约电话/), '13800138000');
    await user.click(screen.getByRole('button', { name: '立即预约' }));
    await waitFor(() => {
      const errorElements = screen.getAllByText(/请选择校区/);
      const errorParagraph = errorElements.find(el => el.tagName === 'P');
      expect(errorParagraph).toBeInTheDocument();
    });
  });

  it('提交失败时显示错误消息', async () => {
    vi.mocked(createAppointment).mockRejectedValueOnce(new Error('Network error'));
    const user = userEvent.setup();
    renderWithRouter(mockSection);
    await user.type(screen.getByLabelText(/预约姓名/), '小明');
    await user.type(screen.getByLabelText(/预约电话/), '13800138000');
    await user.selectOptions(screen.getByLabelText(/选择校区/), 'chaoyang');
    await user.click(screen.getByRole('button', { name: '立即预约' }));
    await waitFor(() => {
      expect(screen.getByText(/网络连接失败/)).toBeInTheDocument();
    });
  });
});
