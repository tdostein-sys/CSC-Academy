import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import Card from '@mui/material/Card';
import CardHeader from '@mui/material/CardHeader';
import CardContent from '@mui/material/CardContent';
import Box from '@mui/material/Box';
import { KeyRound } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { PageHeader } from '@/components/page-header';
import { ProfileForm } from './profile-form';
import { LinkButton } from '@/components/ui/links';
import { Notice } from '@/components/ui/notice';

export const metadata: Metadata = { title: 'Mon profil' };

/** Profil : mise en page « Paramètres du compte » de Sneat. */
export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ password?: string }> }) {
  const user = await requireUser('/profile');
  const [t, sp] = await Promise.all([getTranslations('profile'), searchParams]);

  return (
    <Box sx={{ maxWidth: 760 }}>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      {sp.password === 'changed' && (
        <Box sx={{ mb: 6 }}>
          <Notice tone="success">{t('passwordChangedOthers')}</Notice>
        </Box>
      )}
      <Card>
        <CardContent sx={{ pt: 6 }}>
          <ProfileForm profile={user.profile} />
        </CardContent>
      </Card>
      <Card sx={{ mt: 6 }}>
        <CardHeader title={t('securityTitle')} />
        <CardContent>
          <LinkButton href="/auth/change-password" variant="outlined" startIcon={<KeyRound aria-hidden size={18} />}>
            {t('changePassword')}
          </LinkButton>
        </CardContent>
      </Card>
    </Box>
  );
}
