import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import Stack from '@mui/material/Stack';
import { getSessionUser } from '@/lib/auth';
import { AuthHeading } from '@/components/auth-heading';
import { Notice } from '@/components/ui/notice';
import { ResetPasswordForm } from '../forms';
import { LinkButton } from '@/components/ui/links';

export const metadata: Metadata = { title: 'Nouveau mot de passe' };

export default async function ResetPasswordPage() {
  const [t, user] = await Promise.all([getTranslations('auth'), getSessionUser()]);

  // Pas de session de récupération : le lien est invalide ou expiré.
  if (!user) {
    return (
      <Stack spacing={4} sx={{ alignItems: 'center' }}>
        <Notice tone="error">{t('linkInvalid')}</Notice>
        <LinkButton href="/auth/forgot-password" variant="outlined">
          {t('forgotTitle')}
        </LinkButton>
      </Stack>
    );
  }

  return (
    <>
      <AuthHeading title={t('resetTitle')} subtitle={t('resetSubtitle')} />
      <ResetPasswordForm />
    </>
  );
}
