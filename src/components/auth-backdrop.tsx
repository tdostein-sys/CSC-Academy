'use client';

import type { ReactNode } from 'react';
import Box from '@mui/material/Box';
import { tok } from '@/@core/theme/tokens';

/**
 * Fond des pages d'authentification : dégradé doux et halos bleu / violet,
 * décoratifs (ignorés par les lecteurs d'écran).
 */
export function AuthBackdrop({ children }: { children: ReactNode }) {
  return (
    <Box
      sx={(theme) => {
        const c = tok(theme);
        const dark = theme.palette.mode === 'dark';
        return {
          position: 'relative',
          minHeight: '100dvh',
          overflow: 'hidden',
          bgcolor: c.surface,
          backgroundImage: dark
            ? 'radial-gradient(1200px 600px at 10% -10%, rgba(29,95,214,.35), transparent 60%), radial-gradient(900px 500px at 110% 110%, rgba(91,63,196,.30), transparent 60%)'
            : 'radial-gradient(1200px 600px at 10% -10%, rgba(29,95,214,.16), transparent 60%), radial-gradient(900px 500px at 110% 110%, rgba(91,63,196,.14), transparent 60%)',
        };
      }}
    >
      {children}
    </Box>
  );
}

/** Carte centrale « verre dépoli » des pages d'authentification. */
export function AuthCard({ children }: { children: ReactNode }) {
  return (
    <Box
      sx={(theme) => {
        const c = tok(theme);
        const dark = theme.palette.mode === 'dark';
        return {
          width: '100%',
          p: { xs: 6, sm: 9 },
          borderRadius: 4,
          bgcolor: c.bg,
          border: `1px solid ${c.border}`,
          boxShadow: dark ? '0 24px 60px rgba(0,0,0,.45)' : '0 24px 60px rgba(22,33,58,.12)',
        };
      }}
    >
      {children}
    </Box>
  );
}
