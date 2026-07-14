import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ChatInput from '@/components/chat/ChatInput';

describe('ChatInput 组件', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('渲染输入框和发送按钮', () => {
    render(<ChatInput onSend={vi.fn()} isLoading={false} />);
    expect(screen.getByPlaceholderText(/输入消息/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /发送/ })).toBeInTheDocument();
  });

  it('输入文字后点击发送按钮调用 onSend', async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();
    render(<ChatInput onSend={onSend} isLoading={false} />);

    const input = screen.getByPlaceholderText(/输入消息/);
    await user.type(input, '你好');
    await user.click(screen.getByRole('button', { name: /发送/ }));

    expect(onSend).toHaveBeenCalledWith('你好');
  });

  it('按 Enter 键发送消息', async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();
    render(<ChatInput onSend={onSend} isLoading={false} />);

    const input = screen.getByPlaceholderText(/输入消息/);
    await user.type(input, '请问课程怎么报名？{Enter}');

    expect(onSend).toHaveBeenCalledWith('请问课程怎么报名？');
  });

  it('Shift+Enter 不发送消息（换行）', async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();
    render(<ChatInput onSend={onSend} isLoading={false} />);

    const input = screen.getByPlaceholderText(/输入消息/) as HTMLTextAreaElement;
    await user.type(input, '第一行{Shift>}{Enter}{/Shift}第二行');

    expect(onSend).not.toHaveBeenCalled();
  });

  it('空消息不发送', async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();
    render(<ChatInput onSend={onSend} isLoading={false} />);

    await user.click(screen.getByRole('button', { name: /发送/ }));
    expect(onSend).not.toHaveBeenCalled();
  });

  it('只有空格的消息不发送', async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();
    render(<ChatInput onSend={onSend} isLoading={false} />);

    const input = screen.getByPlaceholderText(/输入消息/);
    await user.type(input, '   ');
    await user.click(screen.getByRole('button', { name: /发送/ }));
    expect(onSend).not.toHaveBeenCalled();
  });

  it('isLoading 为 true 时禁用输入框和按钮', () => {
    render(<ChatInput onSend={vi.fn()} isLoading={true} />);
    expect(screen.getByPlaceholderText(/输入消息/)).toBeDisabled();
    expect(screen.getByRole('button', { name: /发送/ })).toBeDisabled();
  });

  it('isLoading 为 true 时按钮显示加载状态', () => {
    render(<ChatInput onSend={vi.fn()} isLoading={true} />);
    const button = screen.getByRole('button', { name: /发送/ });
    expect(button).toHaveAttribute('aria-busy', 'true');
  });

  it('disabled 为 true 时禁用输入框和按钮', () => {
    render(<ChatInput onSend={vi.fn()} isLoading={false} disabled={true} />);
    expect(screen.getByPlaceholderText(/输入消息/)).toBeDisabled();
    expect(screen.getByRole('button', { name: /发送/ })).toBeDisabled();
  });

  it('发送后清空输入框', async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();
    render(<ChatInput onSend={onSend} isLoading={false} />);

    const input = screen.getByPlaceholderText(/输入消息/) as HTMLTextAreaElement;
    await user.type(input, '测试消息');
    await user.click(screen.getByRole('button', { name: /发送/ }));

    expect(input.value).toBe('');
  });

  it('disabled 时显示转人工提示文案', () => {
    render(<ChatInput onSend={vi.fn()} isLoading={false} disabled={true} />);
    expect(screen.getByText(/已转人工客服/)).toBeInTheDocument();
  });
});
