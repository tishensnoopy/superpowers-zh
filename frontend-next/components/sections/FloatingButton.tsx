'use client';

import { MessageCircle, Phone, Send, ArrowUpRight } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Section } from '@/lib/api';

const iconMap: Record<string, LucideIcon> = {
  contact: MessageCircle,
  chat: Send,
  phone: Phone,
};

export default function FloatingButton({ section }: { section: Section }) {
  const { label, action = 'contact', position = 'bottom-right' } = section;

  const Icon = iconMap[action] || MessageCircle;

  const positionClasses: Record<string, string> = {
    'bottom-right': 'bottom-6 right-6',
    'bottom-left': 'bottom-6 left-6',
  };

  return (
    <div className={`fixed z-50 ${positionClasses[position] || positionClasses['bottom-right']}`}>
      <button
        className="flex items-center gap-3 px-5 py-3 rounded-full shadow-2xl hover:shadow-3xl transition-all duration-200 hover:scale-105"
        style={{ background: 'linear-gradient(135deg, #F5851F, #FF6B35)' }}
      >
        <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
          <Icon size={20} className="text-white" />
        </div>
        <span className="text-white font-semibold text-sm">{label || '在线咨询'}</span>
        <ArrowUpRight size={16} className="text-white/70" />
      </button>
    </div>
  );
}
