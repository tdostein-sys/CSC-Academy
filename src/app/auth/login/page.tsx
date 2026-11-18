import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { getSessionUser } from '@/lib/auth';
import { safeNextPath } from '@/lib/routes';
import { AuthHeading } from '@/components/auth-heading';
import { Notice } from '@/components/ui/notice';
import { LoginForm } from '../forms';
import { TextLink } from '@/components/ui/links';

export const metadata: Metadata = { title: 'Connexion' };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const [{ next, error }, t, tn, user] = await Promise.all([searchParams, getTranslations('auth'), getTranslations('nav'), getSessionUser()]);
  if (user) redirect(safeNextPath(next));

  return (
    <>
      <AuthHeading title={t('loginTitle')} subtitle={t('loginSubtitle')} />
      {error === 'link' && (
        <Box sx={{ mb: 4 }}>
          <Notice tone="error">{t('linkInvalid')}</Notice>
        </Box>
      )}
      <LoginForm next={next ? safeNextPath(next) : undefined} />
      <Typography variant="body2" sx={{ mt: 6, textAlign: 'center', color: 'text.secondary' }}>
        {t('noAccount')}{' '}
        <TextLink href="/auth/register">
          {tn('register')}
        </TextLink>
      </Typography>
    </>
  );
}
