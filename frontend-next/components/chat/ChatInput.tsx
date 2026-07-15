'use client';

import { useState, useRef, type KeyboardEvent } from 'react';
import { Send, Loader2 } from 'lucide-react';

const MAX_LENGTH = 500;

interface ChatInputProps {
  onSend: (message: string) => void;
  isLoading: boolean;
  disabled?: boolean;
  locale?: 'zh-CN' | 'en-US';
}

export default function ChatInput({ onSend, isLoading, disabled = false, locale = 'zh-CN' }: ChatInputProps) {
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isDisabled = isLoading || disabled;

  const handleSend = () => {
    const trimmed = value.trim();
    if (!trimmed || isDisabled) return;
    if (trimmed.length > MAX_LENGTH) {
      setError(locale === 'en-US' ? `Message cannot exceed ${MAX_LENGTH} characters` : `消息不能超过 ${MAX_LENGTH} 字符`);
      return;
    }
    setError('');
    onSend(trimmed);
    setValue('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value);
    if (error) setError('');
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  };

  return (
    <div className="border-t border-gray-100 p-3 bg-white">
      {disabled && (
        <div className="mb-2 text-center text-xs text-orange-500 bg-orange-50 rounded-lg py-1.5">
          {locale === 'en-US' ? 'Transferred to human agent, please wait' : '已转人工客服，请等待客服回复'}
        </div>
      )}
      {error && (
        <div className="mb-2 text-center text-xs text-red-500 bg-red-50 rounded-lg py-1.5" role="alert">
          {error}
        </div>
      )}
      <div className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder={locale === 'en-US' ? 'Type your question...' : '请输入您的问题...'}
          disabled={isDisabled}
          maxLength={MAX_LENGTH}
          rows={1}
          className="flex-1 resize-none rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-400 disabled:bg-gray-50 disabled:text-gray-400 max-h-[120px]"
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={isDisabled}
          aria-busy={isLoading}
          aria-label={locale === 'en-US' ? 'Send' : '发送'}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50"
          style={{ background: 'linear-gradient(135deg, #F5851F, #FF6B35)' }}
        >
          {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
        </button>
      </div>
    </div>
  );
}
