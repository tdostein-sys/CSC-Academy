import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import Grid from '@mui/material/Grid';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import { getSessionUser } from '@/lib/auth';
import { ThemedIllustration } from '@/components/themed-illustration';
import { ModuleIcon, type ModuleKey } from '@/components/module-icon';
import { StatusBadge } from '@/components/status-badge';
import { LinkButton, LinkCardArea } from '@/components/ui/links';

export default async function HomePage() {
  const [t, user] = await Promise.all([getTranslations('home'), getSessionUser()]);
  // À l'ouverture de l'application, un visiteur arrive directement sur la connexion.
  if (!user) redirect('/auth/login');

  const modules: { key: ModuleKey; href: string; soon: boolean }[] = [
    { key: 'ambassador', href: '/ambassador', soon: false },
    { key: 'academy', href: '/academy', soon: false },
    { key: 'consulting', href: '/consulting', soon: false },
    { key: 'ga', href: '/ga', soon: true },
  ];

  return (
    <>
      {/* Bandeau d'accueil : carte « Welcome » du tableau de bord Sneat. */}
      <Card sx={{ mb: 6 }}>
        <Grid container>
          <Grid item xs={12} md={7}>
            <CardContent sx={{ p: { xs: 5, sm: 8 } }}>
              <Typography variant="h4" component="h1" sx={{ fontWeight: 700, color: 'primary.main', mb: 3 }}>
                {t('heroTitle')}
              </Typography>
              <Box aria-hidden sx={{ width: 80, height: 6, borderRadius: 3, bgcolor: '#f5c211', mb: 4 }} />
              <Typography sx={{ color: 'text.secondary', fontSize: { sm: '1.0625rem' }, mb: 6 }}>{t('heroSubtitle')}</Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                <LinkButton href={user ? '/dashboard' : '/auth/register'} variant="contained" size="large">
                  {user ? t('ctaDashboard') : t('ctaRegister')}
                </LinkButton>
                <LinkButton href="/academy" variant="outlined" size="large">
                  {t('ctaCourses')}
                </LinkButton>
              </Box>
            </CardContent>
          </Grid>
          <Grid item xs={12} md={5} sx={{ display: { xs: 'none', md: 'flex' }, alignItems: 'flex-end', justifyContent: 'center', pt: 6 }}>
            <ThemedIllustration name="boy-with-laptop" width={300} />
          </Grid>
        </Grid>
      </Card>

      <Typography variant="h5" component="h2" sx={{ fontWeight: 600, mb: 4 }}>
        {t('modulesTitle')}
      </Typography>
      <Grid container spacing={6}>
        {modules.map(({ key, href, soon }) => (
          <Grid item xs={12} sm={6} key={key}>
            <Card sx={{ height: '100%' }}>
              <LinkCardArea href={href} sx={{ height: '100%', alignItems: 'flex-start' }}>
                <CardContent sx={{ display: 'flex', gap: 4 }}>
                  <ModuleIcon module={key} />
                  <Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                      <Typography variant="h6" component="h3">
                        {t(`modules.${key}.title`)}
                      </Typography>
                      {soon && <StatusBadge tone="accentSoft">{t('soonBadge')}</StatusBadge>}
                    </Box>
                    <Typography variant="body2" sx={{ mt: 1, color: 'text.secondary' }}>
                      {t(`modules.${key}.desc`)}
                    </Typography>
                    <Typography variant="body2" sx={{ mt: 3, fontWeight: 600, color: 'primary.main' }}>
                      {t('discover')} →
                    </Typography>
                  </Box>
                </CardContent>
              </LinkCardArea>
            </Card>
          </Grid>
        ))}
      </Grid>
    </>
  );
}
