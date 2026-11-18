import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import Box from '@mui/material/Box';
import { getSessionUser } from '@/lib/auth';
import { AuthHeading } from '@/components/auth-heading';
import { ModuleIcon } from '@/components/module-icon';
import { NewPasswordForm } from '../forms';

export const metadata: Metadata = { title: 'Changement de mot de passe' };

export default async function ChangePasswordPage() {
  const [t, user] = await Promise.all([getTranslations('auth'), getSessionUser()]);
  if (!user) redirect('/auth/login');

  return (
    <>
      <Box sx={{ mb: 4 }}>
        <ModuleIcon module="admin" accent />
      </Box>
      <AuthHeading
        title={user.mustChangePassword ? t('changeTitle') : t('resetTitle')}
        subtitle={user.mustChangePassword ? t('changeSubtitle') : t('resetSubtitle')}
      />
      <NewPasswordForm mode="change" />
    </>
  );
}
