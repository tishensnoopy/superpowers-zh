'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
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
            <h2>系统错误</h2>
            <p>网站遇到技术问题，请稍后重试。</p>
            <button onClick={reset}>重试</button>
          </div>
        </div>
      </body>
    </html>
  );
}
