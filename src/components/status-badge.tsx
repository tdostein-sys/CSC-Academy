'use client';

import type { ReactNode } from 'react';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import { tok, type TokenName } from '@/@core/theme/tokens';

/**
 * Pastilles de statut (Chip MUI) : fond teinté, texte de la même famille,
 * point de couleur ; casse normale. Couleurs testées WCAG AA dans les deux thèmes.
 */
const TONES = {
  pending: ['warning-soft', 'warning'],
  validated: ['success-soft', 'success'],
  rejected: ['error-soft', 'error'],
  draft: ['neutral-soft', 'neutral'],
  launched: ['success-soft', 'success'],
  closed: ['info-soft', 'info'],
  active: ['success-soft', 'success'],
  suspended: ['error-soft', 'error'],
  info: ['info-soft', 'info'],
  neutral: ['neutral-soft', 'neutral'],
  primary: ['primary-soft', 'primary-hover'],
  accent: ['accent', 'accent-fg'],
  accentSoft: ['accent-soft', 'text'],
} as const satisfies Record<string, readonly [TokenName, TokenName]>;

export type BadgeTone = keyof typeof TONES;

export function StatusBadge({ tone, children, size = 'small' }: { tone: BadgeTone; children: ReactNode; size?: 'small' | 'medium' }) {
  const [bg, fg] = TONES[tone];
  return (
    <Chip
      label={children}
      size={size}
      icon={<Box component="span" aria-hidden sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: 'currentColor', flex: '0 0 auto' }} />}
      sx={(theme) => ({
        bgcolor: tok(theme)[bg],
        color: tok(theme)[fg],
        fontWeight: 600,
        borderRadius: 999,
        maxWidth: '100%',
        '& .MuiChip-icon': { color: 'inherit', ml: '10px', mr: '-4px' },
        '& .MuiChip-label': { whiteSpace: 'normal' },
      })}
    />
  );
}
