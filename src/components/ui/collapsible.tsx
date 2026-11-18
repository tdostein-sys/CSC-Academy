import type { ReactNode } from 'react';
import Box from '@mui/material/Box';
import type { Theme } from '@mui/material/styles';
import type { SystemStyleObject } from '@mui/system';

type Kind = 'card' | 'link' | 'button' | 'dangerButton';
type Style = SystemStyleObject<Theme>;

const BUTTON: Style = {
  listStyle: 'none',
  '&::-webkit-details-marker': { display: 'none' },
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 36,
  px: 4,
  borderRadius: 1,
  fontWeight: 500,
  fontSize: '0.875rem',
  width: '100%',
  boxSizing: 'border-box',
};

const SUMMARY: Record<Kind, Style> = {
  card: { cursor: 'pointer', fontWeight: 600 },
  link: { cursor: 'pointer', color: 'primary.main', fontSize: '0.875rem', fontWeight: 500 },
  button: { ...BUTTON, bgcolor: 'primary.main', color: 'primary.contrastText', '&:hover': { bgcolor: 'primary.dark' } },
  dangerButton: { ...BUTTON, border: 1, borderColor: 'error.main', color: 'error.main', '&:hover': { bgcolor: 'error.light' } },
};

/**
 * Bloc repliable accessible (`<details>` natif), sans JavaScript.
 * `kind` : carte (défaut), simple lien, ou bouton (ex. « Payer », « Rejeter »).
 * `plain` est un alias historique de `kind="link"`.
 */
export function Collapsible({ summary, children, plain = false, kind }: { summary: ReactNode; children: ReactNode; plain?: boolean; kind?: Kind }) {
  const k: Kind = kind ?? (plain ? 'link' : 'card');
  return (
    <Box
      component="details"
      sx={{
        ...(k === 'card' && {
          bgcolor: 'background.paper',
          borderRadius: '12px',
          border: 1,
          borderColor: 'divider',
          px: { xs: 5, sm: 6 },
          py: 4,
          '&[open] > summary': { mb: 4 },
        }),
        '& > summary': SUMMARY[k],
        '& > summary:focus-visible': { outline: 2, outlineColor: 'primary.main', outlineOffset: 2 },
      }}
    >
      <summary>{summary}</summary>
      {children}
    </Box>
  );
}
