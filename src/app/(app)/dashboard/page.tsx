import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import Grid from '@mui/material/Grid';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import { requireUser } from '@/lib/auth';
import { PageHeader } from '@/components/page-header';
import { StatusBadge } from '@/components/status-badge';
import { ModuleIcon, type ModuleKey } from '@/components/module-icon';
import { LinkCardArea } from '@/components/ui/links';

export const metadata: Metadata = { title: 'Mon espace' };

export default async function DashboardPage() {
  const user = await requireUser('/dashboard');
  const t = await getTranslations('dashboard');

  // Le rôle « utilisateur » est implicite : seuls les rôles distinctifs sont affichés.
  const roles: string[] = [];
  if (user.ambassador) roles.push('ambassador');
  if (user.isAdmin) roles.push('admin');

  const cards: { key: string; href: string; icon: ModuleKey }[] = [
    { key: user.ambassador ? 'ambassadorSpaceCard' : 'ambassadorCard', href: '/ambassador', icon: 'ambassador' },
    { key: 'academyCard', href: '/academy', icon: 'academy' },
    { key: 'studentCard', href: '/student', icon: 'academy' },
    { key: 'notificationsCard', href: '/notifications', icon: 'notifications' },
    { key: 'profileCard', href: '/profile', icon: 'profile' },
    ...(user.isAdmin ? [{ key: 'adminCard', href: '/admin', icon: 'admin' as const }] : []),
  ];

  return (
    <>
      <PageHeader
        title={t('hello', { name: user.profile.first_name || user.profile.username || '' })}
        subtitle={
          roles.length > 0 ? (
            <Box component="span" sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 2 }}>
              {roles.map((r) => (
                <StatusBadge key={r} tone={r === 'admin' ? 'accent' : 'primary'}>
                  {t(`roles.${r}`)}
                </StatusBadge>
              ))}
            </Box>
          ) : undefined
        }
      />
      <Grid container spacing={6}>
        {cards.map(({ key, href, icon }) => (
          <Grid item xs={12} sm={6} lg={4} key={key}>
            <Card sx={{ height: '100%' }}>
              <LinkCardArea href={href} sx={{ height: '100%' }}>
                <CardContent sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                    <ModuleIcon module={icon} accent={key === 'adminCard'} />
                    <Typography variant="h6" component="h2">
                      {t(`${key}.title`)}
                    </Typography>
                  </Box>
                  <Typography variant="body2" sx={{ mt: 3, flex: 1, color: 'text.secondary' }}>
                    {key === 'notificationsCard'
                      ? t(`${key}.desc`, { count: user.unreadNotifications })
                      : key === 'ambassadorSpaceCard'
                        ? t(`${key}.desc`, { code: user.ambassador?.code ?? '' })
                        : t(`${key}.desc`)}
                  </Typography>
                  <Typography variant="body2" sx={{ mt: 4, fontWeight: 600, color: 'primary.main' }}>
                    {t(`${key}.cta`)} →
                  </Typography>
                </CardContent>
              </LinkCardArea>
            </Card>
          </Grid>
        ))}
      </Grid>
    </>
  );
}
