import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { usePathname } from 'next/navigation';
import { useLocale } from 'next-intl';
import LanguageSwitcher from '../LanguageSwitcher';

vi.mock('next/navigation');
vi.mock('next-intl');

describe('LanguageSwitcher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders with aria-label', () => {
    (useLocale as any).mockReturnValue('zh-CN');
    (usePathname as any).mockReturnValue('/courses');

    render(<LanguageSwitcher />);
    expect(screen.getByLabelText('切换语言')).toBeInTheDocument();
  });

  it('highlights current locale zh-CN', () => {
    (useLocale as any).mockReturnValue('zh-CN');
    (usePathname as any).mockReturnValue('/courses');

    render(<LanguageSwitcher />);
    const zhButton = screen.getByText('中文');
    expect(zhButton).toHaveAttribute('aria-current', 'true');
  });

  it('sets window.location.href when clicking English', () => {
    (useLocale as any).mockReturnValue('zh-CN');
    (usePathname as any).mockReturnValue('/courses');

    // Mock window.location.href setter
    const hrefSetter = vi.fn();
    Object.defineProperty(window, 'location', {
      value: { href: '' },
      writable: true,
    });
    const locationDesc = Object.getOwnPropertyDescriptor(window, 'location');
    Object.defineProperty(window.location, 'href', {
      set: hrefSetter,
      get: () => '',
      configurable: true,
    });

    render(<LanguageSwitcher />);
    fireEvent.click(screen.getByText('English'));
    expect(hrefSetter).toHaveBeenCalledWith('/courses');
  });

  it('writes NEXT_LOCALE cookie on switch', () => {
    (useLocale as any).mockReturnValue('zh-CN');
    (usePathname as any).mockReturnValue('/courses');

    render(<LanguageSwitcher />);
    fireEvent.click(screen.getByText('English'));
    expect(document.cookie).toContain('NEXT_LOCALE=en-US');
  });
});
