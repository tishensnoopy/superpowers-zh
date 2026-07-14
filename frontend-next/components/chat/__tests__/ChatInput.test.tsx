import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ChatInput from '@/components/chat/ChatInput';

describe('ChatInput 组件', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('渲染输入框和发送按钮', () => {
    render(<ChatInput onSend={vi.fn()} isLoading={false} />);
    expect(screen.getByPlaceholderText(/请输入您的问题/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /发送/ })).toBeInTheDocument();
  });

  it('输入文字后点击发送按钮调用 onSend', async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();
    render(<ChatInput onSend={onSend} isLoading={false} />);

    const input = screen.getByPlaceholderText(/请输入您的问题/);
    await user.type(input, '你好');
    await user.click(screen.getByRole('button', { name: /发送/ }));

    expect(onSend).toHaveBeenCalledWith('你好');
  });

  it('按 Enter 键发送消息', async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();
    render(<ChatInput onSend={onSend} isLoading={false} />);

    const input = screen.getByPlaceholderText(/请输入您的问题/);
    await user.type(input, '请问课程怎么报名？{Enter}');

    expect(onSend).toHaveBeenCalledWith('请问课程怎么报名？');
  });

  it('Shift+Enter 不发送消息（换行）', async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();
    render(<ChatInput onSend={onSend} isLoading={false} />);

    const input = screen.getByPlaceholderText(/请输入您的问题/) as HTMLTextAreaElement;
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

    const input = screen.getByPlaceholderText(/请输入您的问题/);
    await user.type(input, '   ');
    await user.click(screen.getByRole('button', { name: /发送/ }));
    expect(onSend).not.toHaveBeenCalled();
  });

  it('isLoading 为 true 时禁用输入框和按钮', () => {
    render(<ChatInput onSend={vi.fn()} isLoading={true} />);
    expect(screen.getByPlaceholderText(/请输入您的问题/)).toBeDisabled();
    expect(screen.getByRole('button', { name: /发送/ })).toBeDisabled();
  });

  it('isLoading 为 true 时按钮显示加载状态', () => {
    render(<ChatInput onSend={vi.fn()} isLoading={true} />);
    const button = screen.getByRole('button', { name: /发送/ });
    expect(button).toHaveAttribute('aria-busy', 'true');
  });

  it('disabled 为 true 时禁用输入框和按钮', () => {
    render(<ChatInput onSend={vi.fn()} isLoading={false} disabled={true} />);
    expect(screen.getByPlaceholderText(/请输入您的问题/)).toBeDisabled();
    expect(screen.getByRole('button', { name: /发送/ })).toBeDisabled();
  });

  it('发送后清空输入框', async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();
    render(<ChatInput onSend={onSend} isLoading={false} />);

    const input = screen.getByPlaceholderText(/请输入您的问题/) as HTMLTextAreaElement;
    await user.type(input, '测试消息');
    await user.click(screen.getByRole('button', { name: /发送/ }));

    expect(input.value).toBe('');
  });

  it('disabled 时显示转人工提示文案', () => {
    render(<ChatInput onSend={vi.fn()} isLoading={false} disabled={true} />);
    expect(screen.getByText(/已转人工客服/)).toBeInTheDocument();
  });

  it('超过 500 字符应显示错误提示且不发送', () => {
    const longText = 'a'.repeat(501);
    const onSend = vi.fn();
    render(<ChatInput onSend={onSend} isLoading={false} />);

    const textarea = screen.getByPlaceholderText(/请输入您的问题/);
    fireEvent.change(textarea, { target: { value: longText } });
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });

    expect(onSend).not.toHaveBeenCalled();
    expect(screen.getByText(/不能超过.*500/)).toBeInTheDocument();
  });

  it('不超过 500 字符正常发送', async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();
    render(<ChatInput onSend={onSend} isLoading={false} />);

    const input = screen.getByPlaceholderText(/请输入您的问题/);
    await user.type(input, 'a'.repeat(500));
    await user.click(screen.getByRole('button', { name: /发送/ }));

    expect(onSend).toHaveBeenCalledWith('a'.repeat(500));
  });

  it('错误提示在重新发送合法消息后清除', () => {
    const onSend = vi.fn();
    render(<ChatInput onSend={onSend} isLoading={false} />);

    const textarea = screen.getByPlaceholderText(/请输入您的问题/);
    // 先触发错误
    fireEvent.change(textarea, { target: { value: 'a'.repeat(501) } });
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });
    expect(screen.getByText(/不能超过.*500/)).toBeInTheDocument();

    // 重新输入合法消息发送
    fireEvent.change(textarea, { target: { value: '你好' } });
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });
    expect(onSend).toHaveBeenCalledWith('你好');
    expect(screen.queryByText(/不能超过.*500/)).not.toBeInTheDocument();
  });
});
