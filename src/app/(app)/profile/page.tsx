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

export const metadata: Metadata = { title: 'Mon profil' };

/** Profil : mise en page « Paramètres du compte » de Sneat. */
export default async function ProfilePage() {
  const user = await requireUser('/profile');
  const t = await getTranslations('profile');

  return (
    <Box sx={{ maxWidth: 760 }}>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
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
