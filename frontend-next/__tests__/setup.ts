import { vi } from 'vitest';
import '@testing-library/jest-dom';
import { createElement } from 'react';

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    refresh: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('next-intl', () => ({
  useLocale: () => 'zh-CN',
  useTranslations: () => (key: string) => key,
}));

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: any) =>
    createElement('a', { href, ...props }, children),
}));

vi.mock('next/image', () => ({
  default: ({ src, alt, fill, width, height, priority, className, sizes, ...props }: any) =>
    createElement('img', { src, alt, width, height, className, ...props }),
}));

// Mock scrollIntoView (not available in jsdom)
Element.prototype.scrollIntoView = vi.fn();
