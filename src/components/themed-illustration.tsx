'use client';

import Box from '@mui/material/Box';
import { useThemeMode } from '@/components/theme/theme-provider';

/** Illustration du template Sneat (variante claire ou sombre selon le thème). Décorative. */
export function ThemedIllustration({ name, width = 360 }: { name: string; width?: number }) {
  const { mode } = useThemeMode();
  return (
    <Box
      component="img"
      src={`/images/${name}-${mode}.png`}
      alt=""
      aria-hidden
      loading="lazy"
      decoding="async"
      sx={{ width: '100%', maxWidth: width, height: 'auto' }}
    />
  );
}
