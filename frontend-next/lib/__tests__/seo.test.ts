import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { buildMetadata } from '../seo';

describe('buildMetadata hreflang injection', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://example.com';
  });

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
  });

  it('injects alternates.languages with zh-CN + en-US URLs', () => {
    const metadata = buildMetadata(undefined, {
      title: 'Courses',
      canonicalUrl: 'https://example.com/courses',
    }, { locale: 'zh-CN', path: '/courses' });

    expect(metadata.alternates?.languages).toEqual({
      'zh-CN': 'https://example.com/courses',
      'en-US': 'https://example.com/en-US/courses',
    });
  });

  it('injects alternates.languages for en-US locale', () => {
    const metadata = buildMetadata(undefined, {
      title: 'Courses',
      canonicalUrl: 'https://example.com/en-US/courses',
    }, { locale: 'en-US', path: '/courses' });

    expect(metadata.alternates?.languages).toEqual({
      'zh-CN': 'https://example.com/courses',
      'en-US': 'https://example.com/en-US/courses',
    });
  });

  it('does not inject alternates.languages when i18n missing', () => {
    const metadata = buildMetadata(undefined, { title: 'Home' });
    expect(metadata.alternates?.languages).toBeUndefined();
  });
});
