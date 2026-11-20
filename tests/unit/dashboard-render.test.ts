import { describe, expect, it } from 'vitest';
import { createElement as h } from 'react';
import { renderToString } from 'react-dom/server';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import themeOptions from '@/@core/theme/ThemeOptions';
import { defaultSettings } from '@/@core/theme/settings';
import { MonthlyBars } from '@/components/dashboard/monthly-bars';
import { GoalMeter } from '@/components/dashboard/goal-meter';

/** Les composants du tableau de bord se rendent dans les deux thèmes, données vides comprises. */
describe.each(['light', 'dark'] as const)('tableau de bord — rendu (%s)', (mode) => {
  const theme = createTheme(themeOptions({ ...defaultSettings, mode }));
  const render = (el: ReturnType<typeof h>) => renderToString(h(ThemeProvider, { theme }, el));
  const months = ['déc. 25', 'janv. 26', 'févr. 26'];
  const monthsLong = ['décembre 2025', 'janvier 2026', 'février 2026'];

  it('histogramme empilé : légende, tableau des valeurs', () => {
    const html = render(
      h(MonthlyBars, {
        months,
        monthsLong,
        money: true,
        locale: 'fr',
        tableLabel: 'Valeurs',
        totalLabel: 'Total',
        series: [
          { key: 'a', label: 'Academy', values: [100000, 0, 250000] },
          { key: 'c', label: 'Consulting', values: [25000, 50000, 0] },
        ],
      }),
    );
    expect(html).toContain('Academy');
    expect(html).toContain('<table');
    // Total du premier mois dans le tableau : 100 000 + 25 000.
    expect(html).toMatch(/125.000.FCFA/);
  });

  it('histogramme sans aucune donnée', () => {
    const html = render(h(MonthlyBars, { months, monthsLong, locale: 'en', tableLabel: 'Values', totalLabel: 'Total', series: [{ key: 'x', label: 'X', values: [0, 0, 0] }] }));
    expect(html).toContain('Values');
  });

  it('jauge d’objectif accessible', () => {
    const html = render(
      h(GoalMeter, {
        expectedLabel: 'Rythme attendu : 50 %',
        goal: { label: 'Encaissé total', actual: '800 000 FCFA', target: '2 000 000 FCFA', percent: 40, expected: 50, status: 'behind', statusLabel: 'En retard' },
      }),
    );
    expect(html).toContain('role="meter"');
    expect(html).toContain('aria-valuenow="40"');
  });
});
