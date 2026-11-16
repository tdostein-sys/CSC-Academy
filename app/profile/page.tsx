import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { KeyRound } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { PageHeader } from '@/components/page-header';
import { ProfileForm } from './profile-form';

export const metadata: Metadata = { title: 'Mon profil' };

export default async function ProfilePage() {
  const user = await requireUser('/profile');
  const t = await getTranslations('profile');

  return (
    <div className="container-page max-w-2xl py-8">
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      <div className="card">
        <ProfileForm profile={user.profile} />
      </div>
      <div className="card mt-6">
        <h2 className="font-semibold">{t('securityTitle')}</h2>
        <Link href="/auth/change-password" className="btn-outline mt-3">
          <KeyRound aria-hidden className="size-4" />
          {t('changePassword')}
        </Link>
      </div>
    </div>
  );
}
