import type { ReactNode } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

/** En-tête de page (style « PageHeader » de Sneat). */
export function PageHeader({ title, subtitle, actions }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <Box sx={{ mb: 6, display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 3, alignItems: { sm: 'flex-end' }, justifyContent: 'space-between' }}>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="h5" component="h1" sx={{ fontWeight: 600 }}>
          {title}
        </Typography>
        {subtitle && (
          <Typography component="div" sx={{ mt: 1, color: 'text.secondary' }}>
            {subtitle}
          </Typography>
        )}
      </Box>
      {actions && <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>{actions}</Box>}
    </Box>
  );
}
