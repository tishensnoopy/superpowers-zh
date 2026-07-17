import { vi } from 'vitest';
import '@testing-library/jest-dom';
import { createElement } from 'react';
import zhCNMessages from '../i18n/messages/zh-CN.json';

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

function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((acc, key) => (acc ? acc[key] : undefined), obj);
}

function createTranslator(namespace: string) {
  return (key: string, params?: Record<string, any>) => {
    const fullKey = namespace ? `${namespace}.${key}` : key;
    let value = getNestedValue(zhCNMessages, fullKey);
    if (value === undefined) return key;
    if (params && typeof value === 'string') {
      Object.entries(params).forEach(([k, v]) => {
        value = value.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
      });
    }
    return value;
  };
}

vi.mock('next-intl', () => ({
  useLocale: () => 'zh-CN',
  useTranslations: (namespace: string) => createTranslator(namespace),
}));

vi.mock('next-intl/server', () => ({
  getTranslations: async (namespace: string) => createTranslator(namespace),
}));

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: any) =>
    createElement('a', { href, ...props }, children),
}));

// Mock the localized navigation module globally. It wraps next-intl's
// createNavigation, whose prebuilt ESM imports 'next/navigation' — a bare
// specifier vitest cannot resolve inside node_modules. Providing a factory
// avoids loading the real module entirely.
vi.mock('@/i18n/navigation', () => ({
  Link: ({ children, href, ...props }: any) =>
    createElement('a', { href: typeof href === 'string' ? href : (href?.pathname ?? '#'), ...props }, children),
  usePathname: () => '/',
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  redirect: vi.fn(),
  getPathname: () => '/',
}));

vi.mock('next/image', () => ({
  default: ({ src, alt, fill, width, height, priority, className, sizes, ...props }: any) =>
    createElement('img', { src, alt, width, height, className, ...props }),
}));

// Mock scrollIntoView (not available in jsdom)
Element.prototype.scrollIntoView = vi.fn();
