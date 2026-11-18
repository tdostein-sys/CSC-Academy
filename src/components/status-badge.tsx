'use client';

import type { ReactNode } from 'react';
import Chip from '@mui/material/Chip';
import { tok, type TokenName } from '@/@core/theme/tokens';

/** Pastilles de statut (Chip MUI ; couleurs testées WCAG AA dans les deux thèmes). */
const TONES = {
  pending: ['warning-soft', 'warning'],
  validated: ['success-soft', 'success'],
  rejected: ['error-soft', 'error'],
  draft: ['surface-2', 'muted'],
  launched: ['success-soft', 'success'],
  closed: ['info-soft', 'info'],
  active: ['success-soft', 'success'],
  suspended: ['error-soft', 'error'],
  info: ['info-soft', 'info'],
  neutral: ['surface-2', 'muted'],
  primary: ['primary-soft', 'primary'],
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
      sx={(theme) => ({
        bgcolor: tok(theme)[bg],
        color: tok(theme)[fg],
        fontWeight: 600,
        borderRadius: 1,
        maxWidth: '100%',
        '& .MuiChip-label': { whiteSpace: 'normal' },
      })}
    />
  );
}
