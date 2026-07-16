'use client';

import { useState, useRef, type KeyboardEvent } from 'react';
import { Send, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

const MAX_LENGTH = 500;

interface ChatInputProps {
  onSend: (message: string) => void;
  isLoading: boolean;
  disabled?: boolean;
  locale?: 'zh-CN' | 'en-US';
}

export default function ChatInput({ onSend, isLoading, disabled = false }: ChatInputProps) {
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const t = useTranslations('chat');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isDisabled = isLoading || disabled;

  const handleSend = (overrideValue?: string) => {
    // overrideValue 用于 keydown 事件直接从 DOM 读取值，
    // 避免 React 18 批量更新导致 state 尚未同步的问题
    const trimmed = (overrideValue ?? value).trim();
    if (!trimmed || isDisabled) return;
    if (trimmed.length > MAX_LENGTH) {
      setError(t('messageTooLong', { max: MAX_LENGTH }));
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
      // 直接从 DOM 元素读取当前值，不依赖 React state 的同步性
      handleSend(e.currentTarget.value);
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
          {t('transferredNotice')}
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
          placeholder={t('inputPlaceholder')}
          disabled={isDisabled}
          maxLength={MAX_LENGTH}
          rows={1}
          className="flex-1 resize-none rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-400 disabled:bg-gray-50 disabled:text-gray-400 max-h-[120px]"
        />
        <button
          type="button"
          onClick={() => handleSend()}
          disabled={isDisabled}
          aria-busy={isLoading}
          aria-label={t('sendButton')}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50"
          style={{ background: 'linear-gradient(135deg, #F5851F, #FF6B35)' }}
        >
          {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
        </button>
      </div>
    </div>
  );
}
