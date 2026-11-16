'use client';

import { useTranslations } from 'next-intl';

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations('errors');
  return (
    <div className="container-page py-20 text-center">
      <h1 className="text-2xl font-bold">{t('errorTitle')}</h1>
      <p className="mt-2 text-muted">{t('generic')}</p>
      <button type="button" onClick={reset} className="btn-primary mt-6">
        {t('retry')}
      </button>
    </div>
  );
}
