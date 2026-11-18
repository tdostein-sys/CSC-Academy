'use client';

import { useTranslations } from 'next-intl';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import { RefreshCw } from 'lucide-react';
import { ErrorIllustration } from '@/components/error-illustration';

/** Page d'erreur : illustration, message simple, bouton « Réessayer ». Aucun détail technique affiché. */
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations('errors');
  return (
    <Box
      component="main"
      sx={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', px: 4, py: 8, bgcolor: 'background.default' }}
    >
      <ErrorIllustration />
      <Typography variant="h4" component="h1" sx={{ mt: 6, mb: 2, fontWeight: 700 }}>
        {t('errorTitle')}
      </Typography>
      <Typography sx={{ mb: 7, color: 'text.secondary', fontSize: { sm: '1.125rem' } }}>{t('generic')}</Typography>
      <Button
        type="button"
        onClick={reset}
        variant="contained"
        size="large"
        startIcon={<RefreshCw aria-hidden size={20} />}
        sx={{ px: 7, py: 2, borderRadius: 3, textTransform: 'none', fontSize: '1rem', fontWeight: 600, boxShadow: '0 8px 20px rgba(29,95,214,.3)' }}
      >
        {t('retry')}
      </Button>
    </Box>
  );
}
