'use client';

import type { ReactNode } from 'react';
import Box from '@mui/material/Box';
import { tok } from '@/@core/theme/tokens';

/**
 * Fond des pages d'authentification : surface unie (direction artistique sobre).
 */
export function AuthBackdrop({ children }: { children: ReactNode }) {
  return (
    <Box
      sx={(theme) => {
        const c = tok(theme);
        return {
          position: 'relative',
          minHeight: '100dvh',
          overflow: 'hidden',
          bgcolor: c.surface,
          color: c.text,
        };
      }}
    >
      {children}
    </Box>
  );
}

/** Carte centrale des pages d'authentification : à plat, bordure fine. */
export function AuthCard({ children }: { children: ReactNode }) {
  return (
    <Box
      sx={(theme) => {
        const c = tok(theme);
        return {
          width: '100%',
          p: { xs: 6, sm: 9 },
          borderRadius: '16px',
          bgcolor: c.bg,
          border: `1px solid ${c.border}`,
          boxShadow: 'none',
        };
      }}
    >
      {children}
    </Box>
  );
}
