import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FloatingChat from '@/components/chat/FloatingChat';

// Mock chat API
vi.mock('@/lib/chat', () => ({
  startChat: vi.fn().mockResolvedValue({ sessionId: 'sess-test', visitorId: 'vis-test' }),
  sendMessage: vi.fn(),
  transferToHuman: vi.fn().mockResolvedValue({ success: true, sessionId: 'sess-test', status: 'transferred' }),
  getChatHistory: vi.fn().mockResolvedValue({ messages: [] }),
  parseSSEStream: vi.fn(),
}));

import { startChat, sendMessage, transferToHuman, parseSSEStream } from '@/lib/chat';

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
  // Wait for startChat to be called (session initializing)
  await waitFor(() => expect(startChat).toHaveBeenCalled());
  // Wait for input to appear (chat window is open)
  await screen.findByPlaceholderText(/输入消息/);
  // Wait a tick for state to settle after async startChat resolves
  await new Promise(resolve => setTimeout(resolve, 50));
}

describe('FloatingChat 组件', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Re-establish mock implementations after clearAllMocks
    (startChat as any).mockResolvedValue({ sessionId: 'sess-test', visitorId: 'vis-test' });
    (sendMessage as any).mockResolvedValue(new ReadableStream());
    (transferToHuman as any).mockResolvedValue({ success: true, sessionId: 'sess-test', status: 'transferred' });
    (parseSSEStream as any).mockImplementation(async () => {});
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

    // Header title and welcome message both contain "佑森小课堂"
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

  it('SSE 流式接收 AI 回复', async () => {
    (parseSSEStream as any).mockImplementation(async (_stream: unknown, onData: (d: any) => void, onDone: () => void) => {
      onData({ token: '您' });
      onData({ token: '好' });
      onData({ token: '！' });
      onDone();
    });

    const user = userEvent.setup();
    render(<FloatingChat />);

    await openChatAndWaitForSession(user);

    const input = screen.getByPlaceholderText(/输入消息/);
    await user.type(input, '你好');
    await user.click(screen.getByRole('button', { name: /发送/ }));

    expect(await screen.findByText('您好！')).toBeInTheDocument();
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
    (parseSSEStream as any).mockImplementation(async (_stream: unknown, onData: (d: any) => void, onDone: () => void) => {
      onData({ type: 'transfer', message: '正在为您转接人工客服' });
      onDone();
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
    (parseSSEStream as any).mockImplementation(async () => {
      // Never calls onDone, simulating in-flight request
      await new Promise(resolve => setTimeout(resolve, 5000));
    });

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

    // 不应该再次调用 startChat
    expect(startChat).not.toHaveBeenCalled();
  });
});
