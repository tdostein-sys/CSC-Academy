import type { ReactNode } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { getTranslations } from 'next-intl/server';
import { Breadcrumbs, type Crumb } from '@/components/ui/breadcrumbs';

/**
 * En-tête de page : fil d'Ariane (pages de détail), titre (h1), sous-titre
 * et zone d'actions à droite.
 */
export async function PageHeader({
  title,
  subtitle,
  actions,
  breadcrumbs,
  eyebrow,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  breadcrumbs?: Crumb[];
  /** Pastilles au-dessus du titre (statut, niveau…). */
  eyebrow?: ReactNode;
}) {
  const t = breadcrumbs ? await getTranslations('shell') : null;
  return (
    <Box sx={{ mb: 6 }}>
      {breadcrumbs && t && <Breadcrumbs items={breadcrumbs} label={t('breadcrumb')} />}
      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 3, alignItems: { sm: 'flex-end' }, justifyContent: 'space-between' }}>
        <Box sx={{ minWidth: 0 }}>
          {eyebrow && <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, mb: 2 }}>{eyebrow}</Box>}
          <Typography variant="h1" component="h1" sx={{ overflowWrap: 'anywhere' }}>
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
    </Box>
  );
}
