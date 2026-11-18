import { getTranslations } from 'next-intl/server';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { ThemedIllustration } from '@/components/themed-illustration';
import { LinkButton } from '@/components/ui/links';

/** Page 404 (modèle « Page Not Found » de Sneat). */
export default async function NotFound() {
  const [t, ts] = await Promise.all([getTranslations('errors'), getTranslations('soon')]);
  return (
    <Box component="main" sx={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', p: 5 }}>
      <Typography variant="h1" component="p" aria-hidden sx={{ fontWeight: 700, color: 'primary.main', fontSize: { xs: '4rem', sm: '6rem' } }}>
        404
      </Typography>
      <Typography variant="h5" component="h1" sx={{ mb: 2, fontWeight: 600 }}>
        {t('notFoundTitle')}
      </Typography>
      <Typography sx={{ mb: 6, color: 'text.secondary' }}>{t('notFoundBody')}</Typography>
      <LinkButton href="/" variant="contained">
        {ts('backHome')}
      </LinkButton>
      <Box sx={{ mt: 10 }}>
        <ThemedIllustration name="page-misc-error" width={360} />
      </Box>
    </Box>
  );
}
