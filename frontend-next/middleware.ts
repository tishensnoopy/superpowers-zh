import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

export default createMiddleware(routing);

export const config = {
  // Match all pathnames except for
  // - API routes
  // - Next.js internals (_next, _vercel)
  // - Static files (with file extensions)
  // - llms.txt, robots.txt, sitemap.xml
  matcher: ['/((?!api|_next|_vercel|.*\\..*|llms\\.txt|robots\\.txt|sitemap\\.xml).*)'],
};
