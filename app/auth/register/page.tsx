import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { getSessionUser } from '@/lib/auth';
import { RegisterForm } from '../forms';

export const metadata: Metadata = { title: 'Créer un compte' };

export default async function RegisterPage() {
  const [t, tn, user] = await Promise.all([getTranslations('auth'), getTranslations('nav'), getSessionUser()]);
  if (user) redirect('/dashboard');

  return (
    <>
      <h1 className="text-2xl font-bold">{t('registerTitle')}</h1>
      <p className="mt-1 mb-6 text-muted">{t('registerSubtitle')}</p>
      <RegisterForm />
      <p className="mt-6 text-center text-sm text-muted">
        {t('haveAccount')}{' '}
        <Link href="/auth/login" className="link">
          {tn('login')}
        </Link>
      </p>
    </>
  );
}
