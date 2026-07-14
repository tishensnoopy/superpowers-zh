import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useRouter, usePathname } from 'next/navigation';
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
    (useRouter as any).mockReturnValue({ replace: vi.fn() });
    (usePathname as any).mockReturnValue('/courses');

    render(<LanguageSwitcher />);
    expect(screen.getByLabelText('切换语言')).toBeInTheDocument();
  });

  it('highlights current locale zh-CN', () => {
    (useLocale as any).mockReturnValue('zh-CN');
    (useRouter as any).mockReturnValue({ replace: vi.fn() });
    (usePathname as any).mockReturnValue('/courses');

    render(<LanguageSwitcher />);
    const zhButton = screen.getByText('中文');
    expect(zhButton).toHaveAttribute('aria-current', 'true');
  });

  it('calls router.replace with en-US when clicking English', () => {
    (useLocale as any).mockReturnValue('zh-CN');
    const mockReplace = vi.fn();
    (useRouter as any).mockReturnValue({ replace: mockReplace });
    (usePathname as any).mockReturnValue('/courses');

    render(<LanguageSwitcher />);
    fireEvent.click(screen.getByText('English'));
    expect(mockReplace).toHaveBeenCalledWith('/courses', { locale: 'en-US' });
  });

  it('writes NEXT_LOCALE cookie on switch', () => {
    (useLocale as any).mockReturnValue('zh-CN');
    (useRouter as any).mockReturnValue({ replace: vi.fn() });
    (usePathname as any).mockReturnValue('/courses');

    render(<LanguageSwitcher />);
    fireEvent.click(screen.getByText('English'));
    expect(document.cookie).toContain('NEXT_LOCALE=en-US');
  });
});
