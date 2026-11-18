import { describe, expect, it } from 'vitest';
import { tokens, type TokenName } from '@/@core/theme/tokens';

/**
 * Vérifie automatiquement que les couleurs des thèmes clair et sombre
 * (palette Sneat aux couleurs CSC) respectent le contraste WCAG AA
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
  ['primary', 'primary-soft'],
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
  ['muted', 'primary-soft'],
  ['info', 'info-soft'],
  ['info', 'bg'],
  // Boutons pleins MUI (contrastText) : rouge « danger », succès, etc.
  ['on-status', 'error'],
  ['on-status', 'success'],
  ['on-status', 'warning'],
  ['on-status', 'info'],
  // Bouton « secondaire » plein (texte = fond du papier).
  ['bg', 'muted'],
  // Menu latéral bleu nuit.
  ['nav-text', 'nav-bg'],
  ['nav-text', 'nav-hover'],
  ['nav-muted', 'nav-bg'],
  ['nav-active-fg', 'nav-active-from'],
  ['nav-active-fg', 'nav-active-to'],
  // Texte des cartes de statistiques (fond dégradé vers la teinte douce).
  ['text', 'primary-soft'],
  ['text', 'info-soft'],
  ['text', 'success-soft'],
  ['text', 'error-soft'],
  ['muted', 'info-soft'],
  ['muted', 'success-soft'],
  ['muted', 'error-soft'],
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
