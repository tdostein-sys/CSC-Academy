import Box from '@mui/material/Box';
import { LinkButton } from './links';

/** Filtres rapides en pastilles (liens), l'actif est signalé par aria-current. */
export function FilterPills({ label, items }: { label: string; items: { key: string; href: string; label: string; active: boolean }[] }) {
  return (
    <Box component="nav" aria-label={label} sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
      {items.map((it) => (
        <LinkButton
          key={it.key}
          href={it.href}
          size="small"
          variant={it.active ? 'contained' : 'text'}
          aria-current={it.active ? 'page' : undefined}
          sx={{ borderRadius: 999 }}
        >
          {it.label}
        </LinkButton>
      ))}
    </Box>
  );
}
