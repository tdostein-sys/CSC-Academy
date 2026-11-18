import { getTranslations } from 'next-intl/server';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { ThemedIllustration } from '@/components/themed-illustration';
import { LinkButton } from '@/components/ui/links';

/** Page « Bientôt disponible » (modèle « Coming soon » de Sneat). */
export async function ComingSoon({ title, description }: { title: string; description: string }) {
  const t = await getTranslations('soon');
  return (
    <Box sx={{ py: { xs: 6, md: 10 }, textAlign: 'center', maxWidth: 640, mx: 'auto' }}>
      <Typography variant="overline" sx={{ color: 'primary.main', fontWeight: 700, letterSpacing: 1 }}>
        {t('title')}
      </Typography>
      <Typography variant="h4" component="h1" sx={{ mt: 1, mb: 3, fontWeight: 600 }}>
        {title}
      </Typography>
      <Typography sx={{ color: 'text.secondary' }}>{description}</Typography>
      <Typography variant="body2" sx={{ mt: 2, color: 'text.secondary' }}>
        {t('notify')}
      </Typography>
      <LinkButton href="/" variant="contained" sx={{ mt: 6 }}>
        {t('backHome')}
      </LinkButton>
      <Box sx={{ mt: 8 }}>
        <ThemedIllustration name="boy-with-rocket" width={320} />
      </Box>
    </Box>
  );
}
