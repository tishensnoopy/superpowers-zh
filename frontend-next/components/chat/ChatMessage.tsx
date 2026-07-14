import { User, Bot } from 'lucide-react';

export type ChatRole = 'user' | 'assistant' | 'system';
export type MessageType = 'text' | 'transfer';

interface ChatMessageProps {
  role: ChatRole;
  content: string;
  timestamp?: string;
  streaming?: boolean;
  type?: MessageType;
}

function formatTime(timestamp: string): string {
  try {
    const d = new Date(timestamp);
    return d.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  } catch {
    return '';
  }
}

export default function ChatMessage({
  role,
  content,
  timestamp,
  streaming = false,
  type = 'text',
}: ChatMessageProps) {
  if (role === 'system') {
    return (
      <div data-role="system" data-type={type} className="flex justify-center py-2">
        <div
          className={`rounded-lg px-3 py-1.5 text-xs text-center max-w-[80%] ${
            type === 'transfer'
              ? 'bg-orange-50 text-orange-600 border border-orange-200'
              : 'bg-gray-100 text-gray-500'
          }`}
        >
          {content}
        </div>
      </div>
    );
  }

  const isUser = role === 'user';

  return (
    <div
      data-role={role}
      data-type={type}
      className={`flex gap-2 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
    >
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
          isUser ? 'bg-gray-100' : 'text-white'
        }`}
        style={!isUser ? { background: 'linear-gradient(135deg, #F5851F, #FF6B35)' } : undefined}
        aria-label={isUser ? '用户' : 'AI助手'}
      >
        {isUser ? <User size={16} className="text-gray-600" /> : <Bot size={16} />}
      </div>
      <div className={`flex flex-col gap-0.5 max-w-[75%] ${isUser ? 'items-end' : 'items-start'}`}>
        <div
          className={`rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap break-words ${
            isUser
              ? 'bg-orange-500 text-white rounded-tr-sm'
              : 'bg-gray-100 text-gray-800 rounded-tl-sm'
          }`}
        >
          {content}
          {streaming && (
            <span data-testid="typing-cursor" className="inline-block w-0.5 h-4 ml-0.5 bg-current animate-pulse align-middle" />
          )}
        </div>
        {timestamp && (
          <span className="text-[10px] text-gray-400 px-1">{formatTime(timestamp)}</span>
        )}
      </div>
    </div>
  );
}
