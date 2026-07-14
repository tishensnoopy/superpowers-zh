import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ChatMessage from '@/components/chat/ChatMessage';

describe('ChatMessage 组件', () => {
  it('渲染用户消息（右侧对齐）', () => {
    render(<ChatMessage role="user" content="你好" />);
    const msg = screen.getByText('你好');
    expect(msg).toBeInTheDocument();
    expect(msg.closest('[data-role]')).toHaveAttribute('data-role', 'user');
  });

  it('渲染 AI 消息（左侧对齐）', () => {
    render(<ChatMessage role="assistant" content="您好，有什么可以帮您？" />);
    const msg = screen.getByText('您好，有什么可以帮您？');
    expect(msg).toBeInTheDocument();
    expect(msg.closest('[data-role]')).toHaveAttribute('data-role', 'assistant');
  });

  it('渲染系统消息（居中灰色）', () => {
    render(<ChatMessage role="system" content="会话已转接人工客服" />);
    const msg = screen.getByText('会话已转接人工客服');
    expect(msg).toBeInTheDocument();
    expect(msg.closest('[data-role]')).toHaveAttribute('data-role', 'system');
  });

  it('渲染多行文本内容', () => {
    const content = '第一行\n第二行\n第三行';
    render(<ChatMessage role="assistant" content={content} />);
    expect(screen.getByText(/第一行/)).toBeInTheDocument();
    expect(screen.getByText(/第三行/)).toBeInTheDocument();
  });

  it('渲染带时间戳的消息', () => {
    const timestamp = '2026-07-14T10:30:00Z';
    render(<ChatMessage role="user" content="测试" timestamp={timestamp} />);
    // 时间戳会渲染为 HH:MM 格式（时区可能不同，只验证格式）
    expect(screen.getByText(/\d{2}:\d{2}/)).toBeInTheDocument();
  });

  it('不带时间戳时不渲染时间', () => {
    render(<ChatMessage role="user" content="测试" />);
    // 没有时间戳时，不应出现纯时间格式的文本
    const allText = document.body.textContent || '';
    // 排除 "测试" 后不应有 HH:MM 格式
    expect(allText.replace('测试', '')).not.toMatch(/\d{2}:\d{2}/);
  });

  it('用户消息显示用户头像图标', () => {
    render(<ChatMessage role="user" content="你好" />);
    const avatar = screen.getByLabelText('用户');
    expect(avatar).toBeInTheDocument();
  });

  it('AI 消息显示 AI 头像图标', () => {
    render(<ChatMessage role="assistant" content="您好" />);
    const avatar = screen.getByLabelText('AI助手');
    expect(avatar).toBeInTheDocument();
  });

  it('系统消息不显示头像', () => {
    render(<ChatMessage role="system" content="系统提示" />);
    expect(screen.queryByLabelText('用户')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('AI助手')).not.toBeInTheDocument();
  });

  it('流式消息显示打字光标', () => {
    render(<ChatMessage role="assistant" content="正在输入" streaming={true} />);
    expect(screen.getByTestId('typing-cursor')).toBeInTheDocument();
  });

  it('非流式消息不显示打字光标', () => {
    render(<ChatMessage role="assistant" content="已完成" streaming={false} />);
    expect(screen.queryByTestId('typing-cursor')).not.toBeInTheDocument();
  });

  it('转人工消息显示特殊样式', () => {
    render(<ChatMessage role="system" content="正在为您转接人工客服..." type="transfer" />);
    const msg = screen.getByText('正在为您转接人工客服...');
    expect(msg.closest('[data-type]')).toHaveAttribute('data-type', 'transfer');
  });
});
