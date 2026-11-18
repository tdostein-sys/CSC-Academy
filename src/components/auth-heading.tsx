import type { ReactNode } from 'react';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';

/** Titre + sous-titre des pages d'authentification, centrés dans la carte. */
export function AuthHeading({ title, subtitle }: { title: ReactNode; subtitle?: ReactNode }) {
  return (
    <Box sx={{ mb: 6, textAlign: 'center' }}>
      <Typography variant="h5" component="h1" sx={{ fontWeight: 700, mb: 1.5 }}>
        {title}
      </Typography>
      {subtitle && <Typography sx={{ color: 'text.secondary' }}>{subtitle}</Typography>}
    </Box>
  );
}
