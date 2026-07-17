import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createElement } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { useLocale, useTranslations } from 'next-intl';
import LanguageSwitcher from '../LanguageSwitcher';

// vi.mock factories prevent vitest from loading the real @/i18n/navigation
// module (its next-intl ESM chain imports 'next/navigation', which vitest
// cannot resolve). vi.hoisted gives us stable references for assertions.
const { replaceMock, pathnameMock } = vi.hoisted(() => ({
  replaceMock: vi.fn(),
  pathnameMock: vi.fn(),
}));

vi.mock('@/i18n/navigation', () => ({
  usePathname: pathnameMock,
  useRouter: () => ({ replace: replaceMock }),
  Link: ({ children, href, ...props }: any) => createElement('a', { href, ...props }, children),
}));

vi.mock('next-intl');

const translations: Record<string, string> = {
  label: '切换语言',
  chinese: '中文',
  english: 'English',
};

describe('LanguageSwitcher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useLocale as any).mockReturnValue('zh-CN');
    (useTranslations as any).mockReturnValue((key: string) => translations[key] || key);
    pathnameMock.mockReturnValue('/courses');
  });

  it('renders with aria-label', () => {
    render(<LanguageSwitcher />);
    expect(screen.getByLabelText('切换语言')).toBeInTheDocument();
  });

  it('highlights current locale zh-CN', () => {
    render(<LanguageSwitcher />);
    const zhButton = screen.getByText('中文');
    expect(zhButton).toHaveAttribute('aria-current', 'true');
  });

  it('router.replace with en-US locale when clicking English', () => {
    render(<LanguageSwitcher />);
    fireEvent.click(screen.getByText('English'));
    expect(replaceMock).toHaveBeenCalledWith('/courses', { locale: 'en-US' });
  });

  it('router.replace with zh-CN locale when clicking 中文 from en-US', () => {
    (useLocale as any).mockReturnValue('en-US');
    render(<LanguageSwitcher />);
    fireEvent.click(screen.getByText('中文'));
    expect(replaceMock).toHaveBeenCalledWith('/courses', { locale: 'zh-CN' });
  });

  it('does not navigate when clicking current locale', () => {
    render(<LanguageSwitcher />);
    fireEvent.click(screen.getByText('中文'));
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it('does not write NEXT_LOCALE cookie (locale carried by URL prefix)', () => {
    render(<LanguageSwitcher />);
    fireEvent.click(screen.getByText('English'));
    expect(document.cookie).not.toContain('NEXT_LOCALE');
  });
});
