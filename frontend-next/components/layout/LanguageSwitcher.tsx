'use client';

import { useState, useRef, useEffect } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Globe, ChevronDown } from 'lucide-react';
import { usePathname, useRouter } from '@/i18n/navigation';

export default function LanguageSwitcher() {
  const locale = useLocale() as 'zh-CN' | 'en-US';
  const t = useTranslations('languageSwitcher');
  // next-intl usePathname returns the pathname WITHOUT the locale prefix,
  // so it can be handed straight to router.replace with a target locale.
  const pathname = usePathname();
  const router = useRouter();
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
    setIsOpen(false);
    if (targetLocale === locale) return;
    // Locale is carried by the URL prefix (localeCookie is disabled — see
    // i18n/routing.ts). router.replace with a locale option navigates to the
    // prefixed/unprefixed URL client-side; no middleware round-trip needed.
    // Full reload is unnecessary and would only slow the switch down.
    router.replace(pathname, { locale: targetLocale });
  }

  return (
    <div ref={dropdownRef} className="relative">
      <button
        type="button"
        aria-label={t('label')}
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
          {t('chinese')}
        </button>
        <button
          type="button"
          aria-current={locale === 'en-US' ? 'true' : 'false'}
          onClick={() => switchTo('en-US')}
          className="block w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors"
        >
          {t('english')}
        </button>
      </div>
    </div>
  );
}
