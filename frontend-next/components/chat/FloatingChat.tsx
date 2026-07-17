'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Link } from '@/i18n/navigation';
import { MessageCircle, X, Bot } from 'lucide-react';
import { useTranslations } from 'next-intl';
import ChatMessage, { type ChatRole } from './ChatMessage';
import ChatInput from './ChatInput';
import {
  startChat,
  sendMessage,
  type ChatMessageData,
} from '@/lib/chat';

const STORAGE_KEY = 'yousen_chat_session';

interface StoredSession {
  sessionId: string;
  visitorId: string;
}

export default function FloatingChat({ locale = 'zh-CN' }: { locale?: 'zh-CN' | 'en-US' }) {
  const t = useTranslations('chat');
  const WELCOME_MESSAGE = t('welcome');
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessageData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isTransferred, setIsTransferred] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageIdRef = useRef(0);
  // 当 session 尚未就绪时，暂存用户消息；session 就绪后自动发送
  const pendingMessageRef = useRef<string | null>(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const initializeSession = useCallback(async () => {
    // Try to restore from localStorage
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed: StoredSession = JSON.parse(stored);
        if (parsed.sessionId) {
          setSessionId(parsed.sessionId);
          return;
        }
      }
    } catch {
      // Ignore parse errors
    }

    // Create new session
    try {
      const result = await startChat({
        sourcePage: typeof window !== 'undefined' ? window.location.pathname : '/',
        locale,
      });
      setSessionId(result.sessionId);
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ sessionId: result.sessionId, visitorId: result.visitorId })
      );
    } catch (err) {
      console.error('[FloatingChat] Failed to start chat:', err);
    }
  }, [locale]);

  const handleOpen = useCallback(() => {
    setIsOpen(true);
    if (messages.length === 0) {
      // Add welcome message
      setMessages([
        { id: `msg-${++messageIdRef.current}`, role: 'assistant' as ChatRole, content: WELCOME_MESSAGE, timestamp: new Date().toISOString() },
      ]);
    }
    if (!sessionId) {
      initializeSession();
    }
  }, [messages.length, sessionId, initializeSession]);

  const handleClose = useCallback(() => {
    setIsOpen(false);
  }, []);

  const handleSend = useCallback(
    async (message: string, isPending = false) => {
      if (isLoading) return;

      // 乐观渲染：用户消息立即显示在 UI 中，不等待 sessionId 就绪
      // isPending=true 表示消息已在 UI 中，仅执行 API 调用（由 useEffect 触发）
      if (!isPending) {
        const userMessage: ChatMessageData = {
          id: `msg-${++messageIdRef.current}`,
          role: 'user',
          content: message,
          timestamp: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, userMessage]);
      }

      // session 尚未就绪：暂存消息，等 sessionId 设置后由 useEffect 自动发送
      if (!sessionId) {
        pendingMessageRef.current = message;
        return;
      }

      setIsLoading(true);

      // Add "thinking" AI message
      const aiMessageIndex = messages.length + (isPending ? 0 : 1);
      setMessages((prev) => [
        ...prev,
        { id: `msg-${++messageIdRef.current}`, role: 'assistant', content: '', timestamp: new Date().toISOString(), streaming: true },
      ]);

      try {
        const response = await sendMessage(sessionId, message);

        if (response.type === 'transfer') {
          setIsTransferred(true);
          setMessages((prev) => {
            const updated = [...prev];
            if (updated[aiMessageIndex]) {
              updated[aiMessageIndex] = {
                ...updated[aiMessageIndex],
                content: response.content,
                streaming: false,
                actionUrl: response.actionUrl,
              };
            }
            return [...updated, {
              id: `msg-${++messageIdRef.current}`,
              role: 'system',
              content: t('transferredNotice'),
              timestamp: new Date().toISOString(),
              type: 'transfer',
            }];
          });
        } else {
          // type === 'answer'
          setMessages((prev) => {
            const updated = [...prev];
            if (updated[aiMessageIndex]) {
              updated[aiMessageIndex] = {
                ...updated[aiMessageIndex],
                content: response.content || t('noAnswerFallback'),
                streaming: false,
              };
            }
            return updated;
          });
        }
      } catch (err) {
        console.error('[FloatingChat] Failed to send message:', err);
        setMessages((prev) => {
          const updated = [...prev];
          if (updated[aiMessageIndex]) {
            updated[aiMessageIndex] = {
              ...updated[aiMessageIndex],
              content: t('networkError'),
              streaming: false,
            };
          }
          return updated;
        });
      } finally {
        setIsLoading(false);
      }
    },
    [sessionId, isLoading, messages.length, locale, t]
  );

  // session 就绪后，自动发送暂存的待发消息
  useEffect(() => {
    if (sessionId && pendingMessageRef.current && !isLoading) {
      const msg = pendingMessageRef.current;
      pendingMessageRef.current = null;
      void handleSend(msg, true);
    }
  }, [sessionId, isLoading, handleSend]);

  if (!isOpen) {
    return (
      <button
        onClick={handleOpen}
        aria-label={t('onlineConsult')}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-5 py-3 rounded-full shadow-2xl hover:shadow-3xl transition-all duration-200 hover:scale-105"
        style={{ background: 'linear-gradient(135deg, #F5851F, #FF6B35)' }}
      >
        <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
          <MessageCircle size={20} className="text-white" />
        </div>
        <span className="text-white font-semibold text-sm">{t('chat')}</span>
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 w-[360px] max-w-[calc(100vw-3rem)] h-[500px] max-h-[calc(100vh-3rem)] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-gray-200">
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 text-white"
        style={{ background: 'linear-gradient(135deg, #F5851F, #FF6B35)' }}
      >
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
            <Bot size={18} />
          </div>
          <div>
            <div className="font-semibold text-sm">{t('assistantTitle')}</div>
            <div className="text-[10px] text-white/80">
              {isTransferred ? t('humanModeStatus') : t('onlineStatus')}
            </div>
          </div>
        </div>
        <button
          onClick={handleClose}
          aria-label={t('close')}
          className="p-1 rounded-lg hover:bg-white/20 transition-colors"
        >
          <X size={20} />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-gray-50" aria-live="polite" aria-label={t('chatMessages')}>
        {messages.map((msg) => (
          <div key={msg.id}>
            <ChatMessage
              role={msg.role as ChatRole}
              content={msg.content}
              timestamp={msg.timestamp}
              streaming={msg.streaming}
              type={msg.type as 'text' | 'transfer' | undefined}
            />
            {msg.actionUrl && (
              <div className="flex justify-center mt-2 mb-2">
                <Link
                  href={msg.actionUrl}
                  className="px-4 py-2 rounded-lg text-white text-sm font-semibold"
                  style={{ background: 'linear-gradient(135deg, #F5851F, #FF6B35)' }}
                >
                  {t('bookNow')}
                </Link>
              </div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <ChatInput onSend={handleSend} isLoading={isLoading} disabled={isTransferred} locale={locale} />
    </div>
  );
}
