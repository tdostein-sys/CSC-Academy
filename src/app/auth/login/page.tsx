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
import { IDLE_MINUTES, MAX_SESSION_DAYS } from '@/lib/session-policy';

export const metadata: Metadata = { title: 'Connexion' };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string; raison?: string }> }) {
  const [{ next, error, raison }, t, tn, user] = await Promise.all([searchParams, getTranslations('auth'), getTranslations('nav'), getSessionUser()]);
  if (user) redirect(safeNextPath(next));

  return (
    <>
      <AuthHeading title={t('loginTitle')} subtitle={t('loginSubtitle')} />
      {/* Déconnexion automatique : on explique pourquoi (protection du compte). */}
      {(raison === 'inactivite' || raison === 'expiree') && (
        <Box sx={{ mb: 4 }}>
          <Notice tone="info">{raison === 'inactivite' ? t('loggedOutIdle', { minutes: IDLE_MINUTES }) : t('loggedOutExpired', { days: MAX_SESSION_DAYS })}</Notice>
        </Box>
      )}
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
