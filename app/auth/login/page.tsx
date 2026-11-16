import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { getSessionUser } from '@/lib/auth';
import { safeNextPath } from '@/lib/routes';
import { LoginForm } from '../forms';

export const metadata: Metadata = { title: 'Connexion' };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const [{ next, error }, t, user] = await Promise.all([searchParams, getTranslations('auth'), getSessionUser()]);
  if (user) redirect(safeNextPath(next));

  return (
    <>
      <h1 className="text-2xl font-bold">{t('loginTitle')}</h1>
      <p className="mt-1 mb-6 text-muted">{t('loginSubtitle')}</p>
      {error === 'link' && <p className="mb-4 rounded-lg bg-error-soft p-3 text-sm text-error">{t('linkInvalid')}</p>}
      <LoginForm next={next ? safeNextPath(next) : undefined} />
      <p className="mt-6 text-center text-sm text-muted">
        {t('noAccount')}{' '}
        <Link href="/auth/register" className="link">
          {(await getTranslations('nav'))('register')}
        </Link>
      </p>
    </>
  );
}
