import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import Typography from '@mui/material/Typography';
import { AuthHeading } from '@/components/auth-heading';
import { ForgotPasswordForm } from '../forms';
import { TextLink } from '@/components/ui/links';

export const metadata: Metadata = { title: 'Mot de passe oublié' };

export default async function ForgotPasswordPage() {
  const t = await getTranslations('auth');
  return (
    <>
      <AuthHeading title={t('forgotTitle')} subtitle={t('forgotSubtitle')} />
      <ForgotPasswordForm />
      <Typography variant="body2" sx={{ mt: 6, textAlign: 'center' }}>
        <TextLink href="/auth/login">
          ← {t('backToLogin')}
        </TextLink>
      </Typography>
    </>
  );
}
