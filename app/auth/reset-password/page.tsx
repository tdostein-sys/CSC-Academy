import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { getSessionUser } from '@/lib/auth';
import { NewPasswordForm } from '../forms';

export const metadata: Metadata = { title: 'Nouveau mot de passe' };

export default async function ResetPasswordPage() {
  const [t, user] = await Promise.all([getTranslations('auth'), getSessionUser()]);

  // Pas de session de récupération : le lien est invalide ou expiré.
  if (!user) {
    return (
      <div className="space-y-4 text-center">
        <p className="rounded-lg bg-error-soft p-3 text-sm text-error">{t('linkInvalid')}</p>
        <Link href="/auth/forgot-password" className="btn-outline">
          {t('forgotTitle')}
        </Link>
      </div>
    );
  }

  return (
    <>
      <h1 className="text-2xl font-bold">{t('resetTitle')}</h1>
      <p className="mt-1 mb-6 text-muted">{t('resetSubtitle')}</p>
      <NewPasswordForm mode="reset" />
    </>
  );
}
