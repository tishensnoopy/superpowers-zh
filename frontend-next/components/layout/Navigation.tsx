'use client';

import { useState, useEffect } from 'react';
import { Link } from '@/i18n/navigation';
import { usePathname, useRouter } from '@/i18n/navigation';
import { Phone, Menu, X, ChevronDown } from 'lucide-react';
import type { NavigationItem, SiteSettings } from '@/lib/api';
import { getImageUrl } from '@/lib/api';
import LanguageSwitcher from './LanguageSwitcher';
import { useTranslations } from 'next-intl';

export default function Navigation({
  navigation,
  settings,
}: {
  navigation: NavigationItem[];
  settings: SiteSettings;
}) {
  const t = useTranslations('navigation');
  const pathname = usePathname();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState<number | null>(null);

  useEffect(() => {
    setMobileMenuOpen(false);
    setDropdownOpen(null);
  }, [pathname]);

  const isActive = (url: string) => {
    if (url === '/') return pathname === '/';
    // 精确匹配：pathname 等于 url 或以 url + '/' 开头
    // 避免 /about 错误匹配 /about-us 等
    return pathname === url || pathname.startsWith(url + '/');
  };

  const handleMobileNavClick = (url: string) => {
    setMobileMenuOpen(false);
    setDropdownOpen(null);
    router.push(url);
  };

  const handleDropdownToggle = (id: number) => {
    setDropdownOpen(dropdownOpen === id ? null : id);
  };

  const handleDropdownMouseEnter = (id: number) => {
    setDropdownOpen(id);
  };

  const handleDropdownMouseLeave = () => {
    setDropdownOpen(null);
  };

  const logoUrl = getImageUrl(settings.logo);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm border-b border-border shadow-sm">
      <div className="max-w-[1400px] mx-auto px-8 h-[72px] flex items-center justify-between">
        <div className="flex items-center gap-3 shrink-0">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={settings.name || t('brandNameFallback')}
              className="w-10 h-10 rounded-xl object-cover"
            />
          ) : (
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-lg font-black shadow-sm"
              style={{ background: 'linear-gradient(135deg, var(--brand-primary,#F5851F), #FF6B35)' }}
            >
              {settings.name?.[0] || t('brandNameFallback')[0]}
            </div>
          )}
          <div>
            <div
              className="font-black text-[18px] leading-tight text-[var(--brand-dark,#1C2B3A)]"
              style={{ fontFamily: "'Nunito', sans-serif" }}
            >
              {settings.name || t('brandNameFallback')}
            </div>
            <div className="text-[10px] text-muted-foreground tracking-widest">{settings.slogan || t('sloganFallback')}</div>
          </div>
        </div>

        <nav className="hidden lg:flex items-center gap-1">
          {navigation.map((item) => {
            const hasChildren = item.children && item.children.length > 0;
            const active = isActive(item.url);

            if (hasChildren) {
              return (
                <div
                  key={item.id}
                  className="relative"
                  onMouseEnter={() => handleDropdownMouseEnter(item.id)}
                  onMouseLeave={handleDropdownMouseLeave}
                >
                  <button
                    className={`flex items-center gap-1 px-4 py-2 text-sm rounded-lg transition-all duration-200 ${
                      active
                        ? 'text-[var(--brand-primary,#F5851F)] bg-[#FFF3E5]'
                        : 'text-[#4A5568] hover:text-[var(--brand-primary,#F5851F)] hover:bg-[#FFF3E5]'
                    }`}
                    onClick={() => handleDropdownToggle(item.id)}
                  >
                    {item.name}
                    <ChevronDown
                      size={14}
                      className={`transition-transform duration-200 ${dropdownOpen === item.id ? 'rotate-180' : ''}`}
                    />
                  </button>
                  {dropdownOpen === item.id && (
                    <div className="absolute top-full left-0 pt-1 min-w-[180px] z-50">
                      <div className="bg-white rounded-xl shadow-xl border border-border py-2 animate-in fade-in slide-in-from-top-2 duration-150">
                        {item.children?.map((child) => (
                          <Link
                            key={child.id}
                            href={child.url}
                            className={`block px-4 py-2.5 text-sm transition-all duration-200 ${
                              isActive(child.url)
                                ? 'text-[var(--brand-primary,#F5851F)] bg-[#FFF3E5]'
                                : 'text-[#4A5568] hover:text-[var(--brand-primary,#F5851F)] hover:bg-[#FFF3E5]'
                            }`}
                          >
                            {child.name}
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            }

            return (
              <Link
                key={item.id}
                href={item.url}
                className={`px-4 py-2 text-sm rounded-lg transition-all duration-200 ${
                  active
                    ? 'text-[var(--brand-primary,#F5851F)] bg-[#FFF3E5] font-medium'
                    : 'text-[#4A5568] hover:text-[var(--brand-primary,#F5851F)] hover:bg-[#FFF3E5]'
                }`}
              >
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-3">
          <LanguageSwitcher />
          {settings.phone && settings.showPhoneInNav !== false && (
            <a
              href={`tel:${settings.phone}`}
              className="hidden md:flex items-center gap-2 text-sm text-[#4A5568]"
            >
              <Phone size={15} className="text-[var(--brand-primary,#F5851F)]" />
              <span className="font-medium">{settings.phone}</span>
            </a>
          )}
          <Link
            href="/appointment"
            className="hidden md:flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-semibold shadow-md hover:shadow-lg transition-all duration-200 hover:scale-[1.03]"
            style={{ background: 'linear-gradient(135deg, var(--brand-primary,#F5851F), #FF6B35)' }}
          >
            {t('bookFreeTrial')}
          </Link>
          <button
            className="lg:hidden p-2 rounded-lg text-foreground"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label={mobileMenuOpen ? t('closeMenu') : t('openMenu')}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="lg:hidden bg-white border-t border-border px-8 py-4 flex flex-col gap-1">
          {navigation.map((item) => {
            const hasChildren = item.children && item.children.length > 0;
            const active = isActive(item.url);

            if (hasChildren) {
              return (
                <div key={item.id} className="relative">
                  <button
                    className={`flex items-center justify-between w-full py-2.5 text-sm transition-colors ${
                      active ? 'text-[var(--brand-primary,#F5851F)] font-medium' : 'text-foreground'
                    }`}
                    onClick={() => handleDropdownToggle(item.id)}
                  >
                    <span>{item.name}</span>
                    <ChevronDown
                      size={16}
                      className={`transition-transform duration-200 ${dropdownOpen === item.id ? 'rotate-180' : ''}`}
                    />
                  </button>
                  {dropdownOpen === item.id && (
                    <div className="pl-6 mt-1 space-y-1">
                      {item.children?.map((child) => (
                        <button
                          key={child.id}
                          onClick={() => handleMobileNavClick(child.url)}
                          className={`block w-full text-left py-2 text-sm transition-colors ${
                            isActive(child.url)
                              ? 'text-[var(--brand-primary,#F5851F)] font-medium'
                              : 'text-muted-foreground hover:text-[var(--brand-primary,#F5851F)]'
                          }`}
                        >
                          {child.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            }

            return (
              <button
                key={item.id}
                onClick={() => handleMobileNavClick(item.url)}
                className={`block w-full text-left py-2.5 text-sm transition-colors ${
                  active ? 'text-[var(--brand-primary,#F5851F)] font-medium' : 'text-foreground hover:text-[var(--brand-primary,#F5851F)]'
                }`}
              >
                {item.name}
              </button>
            );
          })}
          <button
            onClick={() => handleMobileNavClick('/appointment')}
            className="mt-3 py-3 rounded-xl text-white text-sm font-semibold text-center"
            style={{ background: 'linear-gradient(135deg, var(--brand-primary,#F5851F), #FF6B35)' }}
          >
            {t('bookFreeTrial')}
          </button>
        </div>
      )}
    </header>
  );
}
