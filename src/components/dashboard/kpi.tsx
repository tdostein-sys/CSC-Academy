import type { ReactNode } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import { ArrowDownRight, ArrowRight, ArrowUpRight } from 'lucide-react';
import { LinkCardArea } from '@/components/ui/links';
import type { Locale } from '@/lib/types';

export interface KpiItem {
  label: string;
  value: string;
  /** Évolution en % vs période précédente (null = non comparable). */
  delta?: number | null;
  /** Une hausse est-elle une bonne nouvelle ? (false : remboursements, retards…) */
  upIsGood?: boolean;
  hint?: string;
  href?: string;
  /** Valeur qui demande une action (bordure et chiffre en rouge). */
  alert?: boolean;
}

function DeltaLine({ delta, upIsGood = true, label, locale }: { delta: number; upIsGood?: boolean; label: string; locale: Locale }) {
  const up = delta > 0;
  const flat = delta === 0;
  const good = flat ? null : up === upIsGood;
  const Icon = flat ? ArrowRight : up ? ArrowUpRight : ArrowDownRight;
  const text = `${up ? '+' : ''}${new Intl.NumberFormat(locale === 'en' ? 'en-GB' : 'fr-FR', { maximumFractionDigits: 1 }).format(delta)} %`;
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5, flexWrap: 'wrap' }}>
      <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.25, fontWeight: 600, typography: 'caption', color: good === null ? 'text.secondary' : good ? 'success.main' : 'error.main' }}>
        <Icon aria-hidden size={14} />
        {text}
      </Box>
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
        {label}
      </Typography>
    </Box>
  );
}

function KpiBody({ item, deltaLabel, locale }: { item: KpiItem; deltaLabel: string; locale: Locale }) {
  return (
    <CardContent sx={{ height: '100%' }}>
      <Typography variant="caption" component="p" sx={{ color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.4px', fontWeight: 600 }}>
        {item.label}
      </Typography>
      <Typography variant="h5" component="p" sx={{ mt: 1, fontWeight: 700, color: item.alert ? 'error.main' : 'text.primary', fontSize: { xs: '1.25rem', sm: '1.5rem' }, overflowWrap: 'anywhere' }}>
        {item.value}
      </Typography>
      {typeof item.delta === 'number' && <DeltaLine delta={item.delta} upIsGood={item.upIsGood} label={deltaLabel} locale={locale} />}
      {item.hint && (
        <Typography variant="caption" component="p" sx={{ color: 'text.secondary', mt: 0.5 }}>
          {item.hint}
        </Typography>
      )}
    </CardContent>
  );
}

/** Rangée de chiffres clés (2 par ligne sur mobile, 4 sur grand écran). */
export function KpiGrid({ items, deltaLabel, locale, columns = 4 }: { items: KpiItem[]; deltaLabel: string; locale: Locale; columns?: 3 | 4 }) {
  return (
    <Grid container spacing={4} component="ul" sx={{ listStyle: 'none', p: 0, m: 0 }}>
      {items.map((it) => (
        <Grid item xs={6} md={columns === 4 ? 3 : 4} key={it.label} component="li">
          <Card sx={{ height: '100%', ...(it.alert && { border: 1, borderColor: 'error.main' }) }}>
            {it.href ? (
              <LinkCardArea href={it.href} sx={{ height: '100%' }}>
                <KpiBody item={it} deltaLabel={deltaLabel} locale={locale} />
              </LinkCardArea>
            ) : (
              <KpiBody item={it} deltaLabel={deltaLabel} locale={locale} />
            )}
          </Card>
        </Grid>
      ))}
    </Grid>
  );
}

/** Groupe titré de chiffres clés. */
export function KpiSection({ id, title, subtitle, children }: { id: string; title: string; subtitle?: string; children: ReactNode }) {
  return (
    <Box component="section" aria-labelledby={id}>
      <Box sx={{ mb: 3 }}>
        <Typography id={id} variant="h6" component="h2" sx={{ fontWeight: 600 }}>
          {title}
        </Typography>
        {subtitle && (
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {subtitle}
          </Typography>
        )}
      </Box>
      {children}
    </Box>
  );
}
