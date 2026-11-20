import MuiBreadcrumbs from '@mui/material/Breadcrumbs';
import Typography from '@mui/material/Typography';
import { TextLink } from './links';

export interface Crumb {
  label: string;
  href?: string;
}

/**
 * Fil d'Ariane (casse normale) en haut des pages de détail. Le dernier
 * élément est la page courante ; les précédents sont des liens (retour).
 */
export function Breadcrumbs({ items, label }: { items: Crumb[]; label: string }) {
  return (
    <MuiBreadcrumbs aria-label={label} sx={{ mb: 3, '& .MuiBreadcrumbs-separator': { mx: 1.5, color: 'text.secondary' }, '& ol': { rowGap: 0.5 } }}>
      {items.map((c, i) =>
        c.href && i < items.length - 1 ? (
          <TextLink key={`${c.href}-${i}`} href={c.href} underline="hover" sx={{ color: 'text.secondary', fontSize: '0.875rem', fontWeight: 500 }}>
            {c.label}
          </TextLink>
        ) : (
          <Typography key={`${c.label}-${i}`} component="span" aria-current={i === items.length - 1 ? 'page' : undefined} sx={{ color: 'text.primary', fontSize: '0.875rem', fontWeight: 600, maxWidth: { xs: 220, sm: 420 }, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {c.label}
          </Typography>
        ),
      )}
    </MuiBreadcrumbs>
  );
}
