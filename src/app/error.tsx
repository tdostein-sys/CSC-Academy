'use client';

import { useTranslations } from 'next-intl';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import { AlertTriangle, ArrowLeft, RefreshCw } from 'lucide-react';
import { Logo } from '@/components/logo';
import { TextLink } from '@/components/ui/links';

/** Page d'erreur : illustration, message simple, bouton « Réessayer ». Aucun détail technique affiché. */
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations('errors');
  return (
    <Box
      component="main"
      sx={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', px: 4, py: 8, bgcolor: 'background.default' }}
    >
      <Box sx={{ mb: 6 }}>
        <Logo size={56} />
      </Box>
      <Box aria-hidden sx={{ width: 56, height: 56, borderRadius: '14px', display: 'grid', placeItems: 'center', bgcolor: 'warning.light', color: 'warning.main' }}>
        <AlertTriangle size={28} strokeWidth={1.75} />
      </Box>
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
      >
        {t('retry')}
      </Button>
      <TextLink href="/" sx={{ mt: 5, display: 'inline-flex', alignItems: 'center', gap: 1, fontWeight: 600, minHeight: 44 }}>
        <ArrowLeft aria-hidden size={16} />
        {t('backHome')}
      </TextLink>
    </Box>
  );
}
