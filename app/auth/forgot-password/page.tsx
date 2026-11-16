import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { ForgotPasswordForm } from '../forms';

export const metadata: Metadata = { title: 'Mot de passe oublié' };

export default async function ForgotPasswordPage() {
  const t = await getTranslations('auth');
  return (
    <>
      <h1 className="text-2xl font-bold">{t('forgotTitle')}</h1>
      <p className="mt-1 mb-6 text-muted">{t('forgotSubtitle')}</p>
      <ForgotPasswordForm />
      <p className="mt-6 text-center text-sm">
        <Link href="/auth/login" className="link">
          {t('backToLogin')}
        </Link>
      </p>
    </>
  );
}
