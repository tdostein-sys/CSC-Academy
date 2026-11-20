import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { AlertTriangle, CheckCircle2, Download } from 'lucide-react';
import { FilterPills } from '@/components/ui/filter-pills';
import { LinkButton, TextLink } from '@/components/ui/links';
import { PRESETS, periodQuery, type Period } from '@/lib/dashboard/period';

/**
 * Choix de la période : raccourcis (7 j, 30 j, 90 j, 12 mois) et dates
 * libres (formulaire GET, sans JavaScript), plus l'export CSV.
 */
export function PeriodBar({
  basePath,
  period,
  labels,
  exportHref,
}: {
  basePath: string;
  period: Period;
  labels: { nav: string; presets: Record<string, string>; from: string; to: string; apply: string; export: string; range: string };
  exportHref?: string;
}) {
  return (
    <Card sx={{ p: { xs: 3, sm: 4 }, mb: 6 }}>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3, alignItems: 'center', justifyContent: 'space-between' }}>
        <FilterPills
          label={labels.nav}
          items={PRESETS.map((p) => ({ key: p, href: `${basePath}?period=${p}`, label: labels.presets[p], active: period.key === p }))}
        />
        <Box component="form" method="get" action={basePath} sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
          <TextField name="from" type="date" size="small" label={labels.from} defaultValue={period.from} InputLabelProps={{ shrink: true }} sx={{ width: 160 }} />
          <TextField name="to" type="date" size="small" label={labels.to} defaultValue={period.to} InputLabelProps={{ shrink: true }} sx={{ width: 160 }} />
          <Button type="submit" variant={period.key === 'custom' ? 'contained' : 'outlined'} size="medium">
            {labels.apply}
          </Button>
          {exportHref && (
            <LinkButton href={`${exportHref}?${periodQuery(period)}`} variant="text" startIcon={<Download aria-hidden size={16} />}>
              {labels.export}
            </LinkButton>
          )}
        </Box>
      </Box>
      <Typography variant="caption" component="p" sx={{ color: 'text.secondary', mt: 2 }}>
        {labels.range}
      </Typography>
    </Card>
  );
}

export interface AlertItem {
  label: string;
  href: string;
}

/** Ce qui demande une action, avec un lien vers la bonne page. */
export function AlertList({ items, emptyLabel }: { items: AlertItem[]; emptyLabel: string }) {
  if (items.length === 0) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, color: 'success.main' }}>
        <CheckCircle2 aria-hidden size={18} />
        <Typography variant="body2" sx={{ color: 'text.primary' }}>
          {emptyLabel}
        </Typography>
      </Box>
    );
  }
  return (
    <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0, display: 'grid', gap: 2 }}>
      {items.map((a) => (
        <Box component="li" key={a.href + a.label} sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box component="span" sx={{ color: 'warning.main', display: 'inline-flex' }}>
            <AlertTriangle aria-hidden size={18} />
          </Box>
          <TextLink href={a.href} sx={{ fontWeight: 500 }}>
            {a.label}
          </TextLink>
        </Box>
      ))}
    </Box>
  );
}

/** Classement simple (5 lignes au plus). */
export function Ranking({ columns, rows, emptyLabel }: { columns: string[]; rows: { key: string; cells: string[]; href?: string }[]; emptyLabel: string }) {
  if (rows.length === 0) {
    return (
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
        {emptyLabel}
      </Typography>
    );
  }
  return (
    <Box sx={{ overflowX: 'auto' }}>
      <Box
        component="table"
        sx={{
          width: '100%',
          borderCollapse: 'collapse',
          typography: 'body2',
          '& th, & td': { py: 1.5, px: 2, borderBottom: 1, borderColor: 'divider', textAlign: 'right', whiteSpace: 'nowrap' },
          '& th': { color: 'text.secondary', fontWeight: 600, typography: 'caption', textTransform: 'uppercase' },
          '& th:first-of-type, & td:first-of-type': { textAlign: 'left', whiteSpace: 'normal', pl: 0 },
          '& td': { fontVariantNumeric: 'tabular-nums' },
          '& tr:last-of-type td': { borderBottom: 0 },
        }}
      >
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c} scope="col">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key}>
              {r.cells.map((c, i) => (
                <td key={i}>{i === 0 && r.href ? <TextLink href={r.href}>{c}</TextLink> : c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </Box>
    </Box>
  );
}
