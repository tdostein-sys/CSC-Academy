import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

export default async function NotFound() {
  const [t, ts] = await Promise.all([getTranslations('errors'), getTranslations('soon')]);
  return (
    <div className="container-page py-20 text-center">
      <p className="text-5xl font-extrabold text-primary">404</p>
      <h1 className="mt-3 text-2xl font-bold">{t('notFoundTitle')}</h1>
      <p className="mt-2 text-muted">{t('notFoundBody')}</p>
      <Link href="/" className="btn-primary mt-6">
        {ts('backHome')}
      </Link>
    </div>
  );
}
