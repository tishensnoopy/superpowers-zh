'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import * as Sentry from '@sentry/nextjs';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('errors');

  useEffect(() => {
    Sentry.captureException(error, {
      tags: { section: 'global-error', digest: error.digest },
      level: 'fatal',
    });
  }, [error]);

  return (
    <html lang="zh-CN">
      <body>
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'sans-serif',
        }}>
          <div style={{ textAlign: 'center' }}>
            <h2>{t('systemErrorTitle')}</h2>
            <p>{t('systemErrorMessage')}</p>
            <button onClick={reset}>{t('retry')}</button>
          </div>
        </div>
      </body>
    </html>
  );
}
