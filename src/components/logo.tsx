'use client';

import Image from 'next/image';
import Link from 'next/link';
import Box from '@mui/material/Box';
import { useTheme } from '@mui/material/styles';

/** Proportions du logo détouré (1598 × 801). */
const RATIO = 1598 / 801;

/**
 * Logo CSC, fond transparent. Deux variantes : texte foncé (fond clair) et
 * texte clair (fond sombre). `onDark` force la variante claire, par exemple
 * dans le menu latéral bleu nuit.
 */
export function Logo({
  size = 36,
  href = '/',
  onClick,
  onDark = false,
}: {
  /** Hauteur affichée, en pixels. */
  size?: number;
  href?: string;
  onClick?: () => void;
  onDark?: boolean;
}) {
  const theme = useTheme();
  const dark = onDark || theme.palette.mode === 'dark';
  const width = Math.round(size * RATIO);
  return (
    <Box
      component={Link}
      href={href}
      onClick={onClick}
      aria-label="CSC — Crypto Sans Complexe"
      sx={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0, borderRadius: 1 }}
    >
      <Image
        src={dark ? '/logo-csc-dark.png' : '/logo-csc-light.png'}
        alt=""
        width={width}
        height={size}
        priority
        style={{ width, height: 'auto' }}
      />
    </Box>
  );
}
