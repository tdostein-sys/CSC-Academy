import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import Box from '@mui/material/Box';
import { ArrowLeft } from 'lucide-react';
import { getSessionUser } from '@/lib/auth';
import { AuthHeading } from '@/components/auth-heading';
import { ModuleIcon } from '@/components/module-icon';
import { TextLink } from '@/components/ui/links';
import { ChangePasswordForm } from '../forms';

export const metadata: Metadata = { title: 'Changement de mot de passe' };

export default async function ChangePasswordPage() {
  const [t, user] = await Promise.all([getTranslations('auth'), getSessionUser()]);
  if (!user) redirect('/auth/login?next=/auth/change-password');
  const forced = user.mustChangePassword;

  return (
    <>
      {!forced && (
        <Box sx={{ mb: 4 }}>
          <TextLink href="/profile" sx={{ display: 'inline-flex', alignItems: 'center', gap: 1, fontWeight: 600 }}>
            <ArrowLeft aria-hidden size={16} />
            {t('backToProfile')}
          </TextLink>
        </Box>
      )}
      <Box sx={{ mb: 4 }}>
        <ModuleIcon module="admin" accent />
      </Box>
      <AuthHeading title={forced ? t('changeTitle') : t('changeOwnTitle')} subtitle={forced ? t('changeSubtitle') : t('changeOwnSubtitle')} />
      <ChangePasswordForm forced={forced} />
    </>
  );
}
