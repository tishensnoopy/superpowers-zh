'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import * as Sentry from '@sentry/nextjs';
import Link from 'next/link';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('errors');
  const router = useRouter();

  useEffect(() => {
    if (error.message.includes('API request failed')) return;
    Sentry.captureException(error, {
      tags: { section: 'route-error', digest: error.digest },
    });
  }, [error]);

  const handleReset = () => {
    reset();
    router.refresh();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center px-8 max-w-md">
        <AlertTriangle size={48} className="mx-auto text-red-500 mb-4" />
        <h1 className="text-2xl font-bold text-gray-800 mb-2">{t('errorTitle')}</h1>
        <p className="text-gray-600 mb-6">{t('errorMessage')}</p>
        <div className="flex gap-4 justify-center">
          <button
            onClick={handleReset}
            className="inline-flex items-center gap-2 px-6 py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600"
          >
            <RefreshCw size={18} /> {t('retry')}
          </button>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
          >
            {t('backToHome')}
          </Link>
        </div>
      </div>
    </div>
  );
}
