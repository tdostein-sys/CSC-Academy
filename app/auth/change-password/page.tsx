import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { ShieldAlert } from 'lucide-react';
import { getSessionUser } from '@/lib/auth';
import { NewPasswordForm } from '../forms';

export const metadata: Metadata = { title: 'Changement de mot de passe' };

export default async function ChangePasswordPage() {
  const [t, user] = await Promise.all([getTranslations('auth'), getSessionUser()]);
  if (!user) redirect('/auth/login');

  return (
    <>
      <span className="mb-4 flex size-12 items-center justify-center rounded-full bg-accent-soft">
        <ShieldAlert aria-hidden className="size-6" />
      </span>
      <h1 className="text-2xl font-bold">{user.mustChangePassword ? t('changeTitle') : t('resetTitle')}</h1>
      <p className="mt-1 mb-6 text-muted">{user.mustChangePassword ? t('changeSubtitle') : t('resetSubtitle')}</p>
      <NewPasswordForm mode="change" />
    </>
  );
}
