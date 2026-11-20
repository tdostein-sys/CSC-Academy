'use client';

import { useId } from 'react';
import Box from '@mui/material/Box';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';
import { formatNumber, formatXAF } from '@/lib/format';
import { compactNumber } from '@/lib/dashboard/metrics';
import { tok } from '@/@core/theme/tokens';
import type { Locale } from '@/lib/types';

/*
 * Histogramme mensuel (une colonne par mois, séries empilées).
 * Règles de lecture : colonnes fines (24 px max) arrondies en haut, 2 px
 * d'espace entre segments, grille discrète, légende dès 2 séries, info-bulle
 * au survol / au clavier, et tableau des valeurs pour les lecteurs d'écran.
 * Palette vérifiée (daltonisme, contraste) sur les fonds clair et sombre.
 */

export interface BarSeries {
  key: string;
  label: string;
  values: number[];
}

function niceStep(max: number): number {
  const raw = max / 4;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const f = raw / pow;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * pow;
}

export function MonthlyBars({
  months,
  monthsLong,
  series,
  money = false,
  locale,
  tableLabel,
  totalLabel,
}: {
  months: string[];
  monthsLong: string[];
  series: BarSeries[];
  money?: boolean;
  locale: Locale;
  tableLabel: string;
  totalLabel: string;
}) {
  const theme = useTheme();
  const uid = useId();
  const colors = [tok(theme)['chart-1'], tok(theme)['chart-2']];
  const fmt = (v: number) => (money ? formatXAF(v, locale) : formatNumber(v, locale, 0));
  const totals = months.map((_, i) => series.reduce((a, s) => a + Math.max(0, s.values[i] ?? 0), 0));
  const max = Math.max(...totals, 0);
  const step = max > 0 ? niceStep(max) : 1;
  const top = max > 0 ? Math.ceil(max / step) * step : 4;
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step).reverse();
  const H = 200;

  return (
    <Box>
      {series.length > 1 && (
        <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0, mb: 3, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {series.map((s, i) => (
            <Box component="li" key={s.key} sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Box aria-hidden sx={{ width: 10, height: 10, borderRadius: '3px', bgcolor: colors[i] }} />
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                {s.label}
              </Typography>
            </Box>
          ))}
        </Box>
      )}

      <Box aria-hidden sx={{ display: 'flex', gap: 2 }}>
        {/* Axe des valeurs */}
        <Box sx={{ position: 'relative', height: H, flex: '0 0 auto', minWidth: 44 }}>
          {ticks.map((v) => (
            <Typography
              key={v}
              variant="caption"
              sx={{ position: 'absolute', right: 0, top: `${(1 - v / top) * 100}%`, transform: 'translateY(-50%)', color: 'text.secondary', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}
            >
              {compactNumber(v, locale)}
            </Typography>
          ))}
        </Box>

        <Box sx={{ flex: 1, minWidth: 0 }}>
          {/* Zone de tracé */}
          <Box sx={{ position: 'relative', height: H }}>
            {ticks.map((v) => (
              <Box key={v} sx={{ position: 'absolute', left: 0, right: 0, top: `${(1 - v / top) * 100}%`, borderTop: 1, borderColor: v === 0 ? 'text.disabled' : 'divider' }} />
            ))}
            <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'flex-end' }}>
              {months.map((m, i) => (
                <Tooltip
                  key={m}
                  arrow
                  title={
                    <Box sx={{ p: 0.5 }}>
                      <Typography variant="caption" component="p" sx={{ fontWeight: 700, mb: 0.5 }}>
                        {monthsLong[i]}
                      </Typography>
                      {series.map((s, k) => (
                        <Box key={s.key} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Box sx={{ width: 8, height: 8, borderRadius: '2px', bgcolor: colors[k] }} />
                          <Typography variant="caption">
                            {s.label} : {fmt(s.values[i] ?? 0)}
                          </Typography>
                        </Box>
                      ))}
                      {series.length > 1 && (
                        <Typography variant="caption" component="p" sx={{ mt: 0.5, fontWeight: 600 }}>
                          {totalLabel} : {fmt(totals[i])}
                        </Typography>
                      )}
                    </Box>
                  }
                >
                  <Box
                    sx={{
                      flex: 1,
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column-reverse',
                      alignItems: 'center',
                      cursor: 'default',
                      borderRadius: 1,
                      '&:hover': { bgcolor: 'action.hover' },
                    }}
                  >
                    {series.map((s, k) => {
                      const v = Math.max(0, s.values[i] ?? 0);
                      if (v === 0) return null;
                      const isTop = series.slice(k + 1).every((o) => Math.max(0, o.values[i] ?? 0) === 0);
                      const hasBelow = series.slice(0, k).some((o) => Math.max(0, o.values[i] ?? 0) > 0);
                      return (
                        <Box
                          key={s.key}
                          sx={{
                            width: '60%',
                            maxWidth: 24,
                            minHeight: 2,
                            height: `${(v / top) * 100}%`,
                            bgcolor: colors[k],
                            borderRadius: isTop ? '4px 4px 0 0' : 0,
                            // 2 px d'espace entre segments empilés.
                            mb: hasBelow ? '2px' : 0,
                          }}
                        />
                      );
                    })}
                  </Box>
                </Tooltip>
              ))}
            </Box>
          </Box>
          {/* Mois */}
          <Box sx={{ display: 'flex', mt: 1 }}>
            {months.map((m, i) => (
              <Typography
                key={m}
                variant="caption"
                sx={{ flex: 1, textAlign: 'center', color: 'text.secondary', whiteSpace: 'nowrap', overflow: 'hidden', fontSize: { xs: '0.6rem', sm: '0.75rem' }, visibility: { xs: i % 2 === months.length % 2 ? 'visible' : 'hidden', sm: 'visible' } }}
              >
                {m}
              </Typography>
            ))}
          </Box>
        </Box>
      </Box>

      {/* Valeurs exactes (lecteurs d'écran, et pour qui veut le détail) */}
      <Box component="details" sx={{ mt: 3, '& summary': { cursor: 'pointer', color: 'text.secondary', typography: 'body2' } }}>
        <summary>{tableLabel}</summary>
        <Box sx={{ overflowX: 'auto', mt: 2 }}>
          <Box
            component="table"
            aria-labelledby={`${uid}-caption`}
            sx={{ borderCollapse: 'collapse', width: '100%', typography: 'body2', '& th, & td': { px: 2, py: 1, borderBottom: 1, borderColor: 'divider', textAlign: 'right', whiteSpace: 'nowrap' }, '& th:first-of-type, & td:first-of-type': { textAlign: 'left' }, '& td': { fontVariantNumeric: 'tabular-nums' } }}
          >
            <caption id={`${uid}-caption`} style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
              {tableLabel}
            </caption>
            <thead>
              <tr>
                <th scope="col" />
                {series.map((s) => (
                  <th key={s.key} scope="col">
                    {s.label}
                  </th>
                ))}
                {series.length > 1 && <th scope="col">{totalLabel}</th>}
              </tr>
            </thead>
            <tbody>
              {monthsLong.map((m, i) => (
                <tr key={m}>
                  <th scope="row">{m}</th>
                  {series.map((s) => (
                    <td key={s.key}>{fmt(s.values[i] ?? 0)}</td>
                  ))}
                  {series.length > 1 && <td>{fmt(totals[i])}</td>}
                </tr>
              ))}
            </tbody>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
