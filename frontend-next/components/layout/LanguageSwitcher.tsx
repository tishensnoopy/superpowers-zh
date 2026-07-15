'use client';

import { useState, useRef, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useLocale } from 'next-intl';
import { Globe, ChevronDown } from 'lucide-react';

export default function LanguageSwitcher() {
  const locale = useLocale() as 'zh-CN' | 'en-US';
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function switchTo(targetLocale: 'zh-CN' | 'en-US') {
    if (targetLocale === locale) {
      setIsOpen(false);
      return;
    }
    // Locale switch relies on NEXT_LOCALE cookie + next-intl middleware redirect.
    // Must use window.location (full page load) instead of router.replace
    // (client-side navigation) because the middleware only runs on server-side
    // requests — client-side router.replace bypasses it entirely.
    document.cookie = `NEXT_LOCALE=${targetLocale}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    // Strip current locale prefix from pathname for next-intl middleware redirect
    const cleanPath = pathname.replace(/^\/en-US/, '') || '/';
    window.location.href = cleanPath;
    setIsOpen(false);
  }

  return (
    <div ref={dropdownRef} className="relative">
      <button
        type="button"
        aria-label="切换语言"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <Globe className="w-4 h-4" />
        <ChevronDown className="w-3 h-3" />
      </button>
      <div className={`absolute right-0 mt-2 w-32 bg-white border border-border rounded-md shadow-lg z-50 ${!isOpen ? 'hidden' : ''}`}>
        <button
          type="button"
          aria-current={locale === 'zh-CN' ? 'true' : 'false'}
          onClick={() => switchTo('zh-CN')}
          className="block w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors"
        >
          中文
        </button>
        <button
          type="button"
          aria-current={locale === 'en-US' ? 'true' : 'false'}
          onClick={() => switchTo('en-US')}
          className="block w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors"
        >
          English
        </button>
      </div>
    </div>
  );
}
