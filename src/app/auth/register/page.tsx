import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import Typography from '@mui/material/Typography';
import { getSessionUser } from '@/lib/auth';
import { AuthHeading } from '@/components/auth-heading';
import { RegisterForm } from '../forms';
import { TextLink } from '@/components/ui/links';

export const metadata: Metadata = { title: 'Créer un compte' };

export default async function RegisterPage() {
  const [t, tn, user] = await Promise.all([getTranslations('auth'), getTranslations('nav'), getSessionUser()]);
  if (user) redirect('/dashboard');

  return (
    <>
      <AuthHeading title={t('registerTitle')} subtitle={t('registerSubtitle')} />
      <RegisterForm />
      <Typography variant="body2" sx={{ mt: 6, textAlign: 'center', color: 'text.secondary' }}>
        {t('haveAccount')}{' '}
        <TextLink href="/auth/login">
          {tn('login')}
        </TextLink>
      </Typography>
    </>
  );
}
