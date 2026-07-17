import { createNavigation } from 'next-intl/navigation';
import { routing } from './routing';

// Localized navigation APIs. With localeCookie disabled, the locale is carried
// by the URL prefix alone, so all internal links MUST use this Link (it
// prepends /en-US automatically when the current locale is en-US, and keeps
// zh-CN unprefixed per localePrefix: 'as-needed').
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
