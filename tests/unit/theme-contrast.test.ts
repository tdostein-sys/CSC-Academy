import { describe, expect, it } from 'vitest';
import { tokens, type TokenName } from '@/@core/theme/tokens';
import { BRANDS } from '@/@core/theme/brand';

/**
 * Vérifie automatiquement que les couleurs des thèmes clair et sombre
 * (direction artistique « Premium FinTech ») respectent le contraste WCAG AA
 * (4,5:1 pour le texte normal).
 */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

// [texte, fond] — paires effectivement utilisées dans l'interface.
const PAIRS: [TokenName, TokenName][] = [
  ['text', 'bg'],
  ['text', 'surface'],
  ['text', 'surface-2'],
  ['muted', 'bg'],
  ['muted', 'surface'],
  ['muted', 'surface-2'],
  ['primary', 'bg'],
  ['primary', 'surface'],
  // Texte d'action sur fond teinté : nuance foncée (primary.dark).
  ['primary-hover', 'primary-soft'],
  ['primary-fg', 'primary'],
  ['primary-fg', 'primary-hover'],
  ['accent-fg', 'accent'],
  ['text', 'accent-soft'],
  ['success', 'success-soft'],
  ['error', 'error-soft'],
  ['error', 'bg'],
  ['warning', 'warning-soft'],
  ['warning', 'bg'],
  ['warning', 'surface'],
  ['success', 'bg'],
  ['success', 'surface'],
  ['info', 'info-soft'],
  ['info', 'bg'],
  ['neutral', 'neutral-soft'],
  ['muted', 'primary-soft'],
  // Boutons pleins MUI (contrastText) : rouge « danger », succès, etc.
  ['on-status', 'error'],
  ['on-status', 'success'],
  ['on-status', 'warning'],
  ['on-status', 'info'],
  // Bouton « secondaire » plein.
  ['secondary-fg', 'secondary'],
  // Menu latéral marine.
  ['nav-text', 'nav-bg'],
  ['nav-text', 'nav-hover'],
  ['nav-muted', 'nav-bg'],
  ['nav-section', 'nav-bg'],
  ['nav-active-fg', 'nav-active-bg'],
];

describe.each([
  ['clair', 'light'],
  ['sombre', 'dark'],
] as const)('thème %s — contraste WCAG AA', (_name, mode) => {
  const vars = tokens[mode];
  it.each(PAIRS)('%s sur %s ≥ 4,5:1', (fg, bg) => {
    expect(contrast(vars[fg], vars[bg])).toBeGreaterThanOrEqual(4.5);
  });
});

describe('direction artistique', () => {
  it('valeurs de référence de la mission (fonds, textes, action émeraude)', () => {
    expect(tokens.light).toMatchObject({ surface: '#F5F7FA', bg: '#FFFFFF', border: '#E4E8EF', text: '#0B1526', muted: '#5B6577', primary: '#0A7F5A' });
    expect(tokens.dark).toMatchObject({ surface: '#070E1A', bg: '#0F1A2C', 'surface-2': '#16243A', border: '#25344D', text: '#E8EDF5', primary: '#3DD29B', 'primary-fg': '#04241A' });
  });

  it('mode sombre : trois niveaux de surface distincts, menu séparé par une bordure', () => {
    expect(contrast(tokens.dark.bg, tokens.dark.surface)).toBeGreaterThanOrEqual(1.1);
    expect(contrast(tokens.dark['surface-2'], tokens.dark.bg)).toBeGreaterThanOrEqual(1.1);
    expect(tokens.dark['nav-border']).not.toBe(tokens.dark['nav-bg']);
  });

  it.each(Object.keys(BRANDS))('préréglage de couleur « %s » : contrastes AA dans les deux thèmes', (name) => {
    const b = BRANDS[name as keyof typeof BRANDS];
    for (const mode of ['light', 'dark'] as const) {
      const v = { ...tokens[mode], ...b[mode] };
      expect(contrast(v.primary, v.bg)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(v['primary-fg'], v.primary)).toBeGreaterThanOrEqual(4.5);
      // Icône d'action sur fond teinté (élément non textuel : 3:1) ; texte : nuance foncée (4,5:1).
      expect(contrast(v.primary, v['primary-soft'])).toBeGreaterThanOrEqual(3);
      expect(contrast(v['primary-hover'], v['primary-soft'])).toBeGreaterThanOrEqual(4.5);
      expect(contrast(v['nav-active-fg'], v['nav-active-bg'])).toBeGreaterThanOrEqual(4.5);
    }
  });
});
