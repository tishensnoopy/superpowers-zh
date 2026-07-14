import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FloatingChat from '@/components/chat/FloatingChat';

// Mock chat API — JSON responses, not SSE
vi.mock('@/lib/chat', () => ({
  startChat: vi.fn().mockResolvedValue({ sessionId: 'sess-test', visitorId: 'vis-test' }),
  sendMessage: vi.fn().mockResolvedValue({ type: 'answer', content: '您好！' }),
  transferToHuman: vi.fn().mockResolvedValue({ success: true, sessionId: 'sess-test', status: 'transferred' }),
  getChatHistory: vi.fn().mockResolvedValue({ messages: [] }),
}));

import { startChat, sendMessage } from '@/lib/chat';

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Helper: open chat and wait for session to be ready
async function openChatAndWaitForSession(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /在线咨询/ }));
  await waitFor(() => expect(startChat).toHaveBeenCalled());
  await screen.findByPlaceholderText(/输入消息/);
  await new Promise(resolve => setTimeout(resolve, 50));
}

describe('FloatingChat 组件', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (startChat as any).mockResolvedValue({ sessionId: 'sess-test', visitorId: 'vis-test' });
    (sendMessage as any).mockResolvedValue({ type: 'answer', content: '您好！有什么可以帮您的吗？' });
    localStorageMock.getItem.mockReturnValue(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('初始状态显示悬浮按钮', () => {
    render(<FloatingChat />);
    expect(screen.getByRole('button', { name: /在线咨询/ })).toBeInTheDocument();
  });

  it('点击悬浮按钮打开聊天窗口', async () => {
    const user = userEvent.setup();
    render(<FloatingChat />);

    await user.click(screen.getByRole('button', { name: /在线咨询/ }));

    expect(await screen.findAllByText(/佑森小课堂/)).toHaveLength(2);
    expect(screen.getByPlaceholderText(/输入消息/)).toBeInTheDocument();
  });

  it('打开聊天窗口时创建会话', async () => {
    const user = userEvent.setup();
    render(<FloatingChat />);

    await user.click(screen.getByRole('button', { name: /在线咨询/ }));

    await waitFor(() => {
      expect(startChat).toHaveBeenCalled();
    });
  });

  it('显示欢迎消息', async () => {
    const user = userEvent.setup();
    render(<FloatingChat />);

    await user.click(screen.getByRole('button', { name: /在线咨询/ }));

    expect(await screen.findByText(/您好.*我是佑森小课堂的AI助手/)).toBeInTheDocument();
  });

  it('输入消息并发送，显示用户消息', async () => {
    const user = userEvent.setup();
    render(<FloatingChat />);

    await openChatAndWaitForSession(user);

    const input = screen.getByPlaceholderText(/输入消息/);
    await user.type(input, '请问课程怎么报名？');
    await user.click(screen.getByRole('button', { name: /发送/ }));

    expect(await screen.findByText('请问课程怎么报名？')).toBeInTheDocument();
  });

  it('发送消息后调用 sendMessage API', async () => {
    const user = userEvent.setup();
    render(<FloatingChat />);

    await openChatAndWaitForSession(user);

    const input = screen.getByPlaceholderText(/输入消息/);
    await user.type(input, '你好');
    await user.click(screen.getByRole('button', { name: /发送/ }));

    await waitFor(() => {
      expect(sendMessage).toHaveBeenCalledWith('sess-test', '你好');
    });
  });

  it('接收 AI 回复并显示', async () => {
    const user = userEvent.setup();
    render(<FloatingChat />);

    await openChatAndWaitForSession(user);

    const input = screen.getByPlaceholderText(/输入消息/);
    await user.type(input, '你好');
    await user.click(screen.getByRole('button', { name: /发送/ }));

    expect(await screen.findByText('您好！有什么可以帮您的吗？')).toBeInTheDocument();
  });

  it('点击关闭按钮关闭聊天窗口', async () => {
    const user = userEvent.setup();
    render(<FloatingChat />);

    await user.click(screen.getByRole('button', { name: /在线咨询/ }));
    await screen.findByPlaceholderText(/输入消息/);

    await user.click(screen.getByRole('button', { name: /关闭/ }));

    expect(screen.queryByPlaceholderText(/输入消息/)).not.toBeInTheDocument();
  });

  it('转人工后显示转人工提示', async () => {
    (sendMessage as any).mockResolvedValue({
      type: 'transfer',
      content: '好的，正在为您转接人工客服，请稍候...',
    });

    const user = userEvent.setup();
    render(<FloatingChat />);

    await openChatAndWaitForSession(user);

    const input = screen.getByPlaceholderText(/输入消息/);
    await user.type(input, '转人工');
    await user.click(screen.getByRole('button', { name: /发送/ }));

    await waitFor(() => {
      expect(screen.getAllByText(/已转人工客服/).length).toBeGreaterThanOrEqual(1);
    });
  });

  it('发送消息时显示 loading 状态', async () => {
    // Make sendMessage hang to keep loading state
    (sendMessage as any).mockImplementation(() => new Promise(() => {}));

    const user = userEvent.setup();
    render(<FloatingChat />);

    await openChatAndWaitForSession(user);

    const input = screen.getByPlaceholderText(/输入消息/);
    await user.type(input, '测试');
    await user.click(screen.getByRole('button', { name: /发送/ }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /发送/ })).toHaveAttribute('aria-busy', 'true');
    });
  });

  it('会话 ID 存储到 localStorage', async () => {
    const user = userEvent.setup();
    render(<FloatingChat />);

    await user.click(screen.getByRole('button', { name: /在线咨询/ }));

    await waitFor(() => {
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'yousen_chat_session',
        expect.stringContaining('sess-test')
      );
    });
  });

  it('从 localStorage 恢复已有会话', async () => {
    localStorageMock.getItem.mockReturnValue(JSON.stringify({
      sessionId: 'sess-restored',
      visitorId: 'vis-restored',
    }));

    const user = userEvent.setup();
    render(<FloatingChat />);

    await user.click(screen.getByRole('button', { name: /在线咨询/ }));

    expect(startChat).not.toHaveBeenCalled();
  });

  it('网络错误时显示错误提示', async () => {
    (sendMessage as any).mockRejectedValue(new Error('Network error'));

    const user = userEvent.setup();
    render(<FloatingChat />);

    await openChatAndWaitForSession(user);

    const input = screen.getByPlaceholderText(/输入消息/);
    await user.type(input, '测试');
    await user.click(screen.getByRole('button', { name: /发送/ }));

    expect(await screen.findByText(/网络出现问题/)).toBeInTheDocument();
  });
});
