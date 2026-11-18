import { describe, it } from 'vitest';
import { createElement as h } from 'react';
import { renderToString } from 'react-dom/server';
import { ThemeProvider, createTheme, responsiveFontSizes } from '@mui/material/styles';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import TextField from '@mui/material/TextField';
import themeOptions from '@/@core/theme/ThemeOptions';
import { defaultSettings } from '@/@core/theme/settings';

/**
 * Le thème Sneat doit pouvoir rendre les composants MUI utilisés par l'application.
 * Garde-fou : une entrée de palette mal formée (ex. `customColors.light` en triplet
 * RGB brut) faisait planter tous les bandeaux d'alerte (« Unsupported color »).
 */
describe.each(['light', 'dark'] as const)('thème %s — rendu des composants', (mode) => {
  const theme = responsiveFontSizes(createTheme(themeOptions({ ...defaultSettings, mode })));
  const render = (el: ReturnType<typeof h>) => renderToString(h(ThemeProvider, { theme }, el));

  it.each(['success', 'info', 'warning', 'error'] as const)('Alert %s', (severity) => {
    render(h(Alert, { severity }, 'x'));
  });
  it.each(['primary', 'secondary', 'error', 'warning', 'success', 'info'] as const)('Button %s', (color) => {
    render(h(Button, { color, variant: 'contained' }, 'x'));
    render(h(Button, { color, variant: 'outlined' }, 'x'));
  });
  it('Chip, TextField, select natif', () => {
    render(h(Chip, { label: 'x', size: 'small' }));
    render(h(TextField, { label: 'x', size: 'small' }));
    render(h(TextField, { select: true, label: 'x', defaultValue: '', SelectProps: { native: true } }, h('option', { value: '' }, 'a')));
  });
});
