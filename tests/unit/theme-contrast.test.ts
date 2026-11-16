import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * Vérifie automatiquement que les couleurs des thèmes clair et sombre
 * respectent le contraste WCAG AA (4,5:1 pour le texte normal).
 */
const css = readFileSync(path.resolve(__dirname, '../../app/globals.css'), 'utf8');

function block(selector: string): Record<string, string> {
  const re = new RegExp(`${selector.replace('.', '\\.')}\\s*\\{([^}]*)\\}`);
  const body = re.exec(css)?.[1] ?? '';
  const vars: Record<string, string> = {};
  for (const m of body.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})/g)) vars[m[1]] = m[2];
  return vars;
}

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
const PAIRS: [string, string][] = [
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
];

describe.each([
  ['clair', ':root'],
  ['sombre', '.dark'],
])('thème %s — contraste WCAG AA', (_name, selector) => {
  const vars = block(selector);
  it.each(PAIRS)('%s sur %s ≥ 4,5:1', (fg, bg) => {
    expect(vars[fg], `--${fg} manquant`).toBeDefined();
    expect(vars[bg], `--${bg} manquant`).toBeDefined();
    expect(contrast(vars[fg], vars[bg])).toBeGreaterThanOrEqual(4.5);
  });
});
