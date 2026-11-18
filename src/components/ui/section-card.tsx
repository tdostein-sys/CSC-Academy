import type { ReactNode } from 'react';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';

/**
 * Carte de section avec titre (h2) relié par `aria-labelledby`.
 * Utilisable depuis une page serveur (props sérialisables).
 */
export function SectionCard({
  id,
  title,
  subtitle,
  action,
  highlight = false,
  children,
}: {
  id: string;
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  /** Bordure colorée pour attirer l'attention (ex. paiements à confirmer). */
  highlight?: boolean;
  children: ReactNode;
}) {
  return (
    <Card component="section" aria-labelledby={id} sx={highlight ? { border: 2, borderColor: 'primary.main' } : undefined}>
      <CardContent sx={{ p: { xs: 5, sm: 6 } }}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between', gap: 2, mb: subtitle ? 1 : 4 }}>
          <Typography id={id} variant="h6" component="h2" sx={{ fontWeight: 600 }}>
            {title}
          </Typography>
          {action}
        </Box>
        {subtitle && (
          <Typography variant="body2" sx={{ mb: 4, color: 'text.secondary' }}>
            {subtitle}
          </Typography>
        )}
        {children}
      </CardContent>
    </Card>
  );
}

/** Titre de section hors carte (h2). */
export function SectionTitle({ id, children, aside }: { id: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <Box sx={{ mb: 3, display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between', gap: 2 }}>
      <Typography id={id} variant="h6" component="h2" sx={{ fontWeight: 600 }}>
        {children}
      </Typography>
      {aside}
    </Box>
  );
}

/** Liste à séparateurs dans une carte. */
export function ListCard({ children }: { children: ReactNode }) {
  return (
    <Card>
      <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0, '& > li + li': { borderTop: 1, borderColor: 'divider' } }}>
        {children}
      </Box>
    </Card>
  );
}
