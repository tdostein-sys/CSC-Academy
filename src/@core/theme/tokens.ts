/**
 * Palette de l'interface (maquette « tableau de bord » bleu / bleu nuit) :
 *   bleu principal   #1d5fd6 (clair) / #5b9cff (sombre)
 *   bleu nuit        #0f1c3f  (menu latéral, dans les deux thèmes)
 *   violet           #5b3fc4 / #b39dfa (information, 2ᵉ couleur des cartes)
 *   vert, rouge, ambre pour les états ; or CSC #F5C211 conservé en accent.
 *
 * Contrastes vérifiés automatiquement WCAG AA (tests/unit/theme-contrast.test.ts).
 * L'or n'est JAMAIS utilisé comme couleur de texte sur fond clair : uniquement
 * en fond, avec texte foncé.
 *
 * Correspondance Sneat : `bg` = papier (cartes), `surface` = fond de page.
 * Les jetons `nav-*` décrivent le menu latéral bleu nuit.
 */
export const tokens = {
  light: {
    bg: '#ffffff',
    surface: '#f3f6fb',
    'surface-2': '#e9eff8',
    border: '#e0e6f0',
    text: '#16213a',
    muted: '#53627c',
    primary: '#1d5fd6',
    'primary-hover': '#174fb5',
    'primary-fg': '#ffffff',
    'primary-soft': '#e6effd',
    secondary: '#5b3fc4',
    'secondary-fg': '#ffffff',
    accent: '#f5c211',
    'accent-hover': '#e0b00c',
    'accent-fg': '#1a1500',
    'accent-soft': '#fdf3c8',
    success: '#15803d',
    'success-soft': '#dcfce7',
    warning: '#a14b06',
    'warning-soft': '#fef3c7',
    error: '#c81e1e',
    'error-soft': '#fee2e2',
    info: '#5b3fc4',
    'info-soft': '#ede9fe',
    'on-status': '#ffffff',
    'nav-bg': '#0f1c3f',
    'nav-text': '#e6ecf7',
    'nav-muted': '#9aabc9',
    'nav-hover': '#1a2a52',
    'nav-active-from': '#1d5fd6',
    'nav-active-to': '#2f6fe4',
    'nav-active-fg': '#ffffff'
  },
  dark: {
    bg: '#12203f',
    surface: '#0a1430',
    'surface-2': '#1a2a4d',
    border: '#263759',
    text: '#e6ecf7',
    muted: '#a3b2cf',
    primary: '#5b9cff',
    'primary-hover': '#7bb0ff',
    'primary-fg': '#06122b',
    'primary-soft': '#162f5c',
    secondary: '#b39dfa',
    'secondary-fg': '#120a2e',
    accent: '#ffcb2e',
    'accent-hover': '#ffd658',
    'accent-fg': '#1a1500',
    'accent-soft': '#3a3110',
    success: '#4ade80',
    'success-soft': '#0f3326',
    warning: '#fbbf24',
    'warning-soft': '#3a2c0b',
    error: '#f87171',
    'error-soft': '#3b1620',
    info: '#b39dfa',
    'info-soft': '#251d4d',
    'on-status': '#0a1430',
    'nav-bg': '#0c1836',
    'nav-text': '#e6ecf7',
    'nav-muted': '#9aabc9',
    'nav-hover': '#17264a',
    'nav-active-from': '#1d5fd6',
    'nav-active-to': '#2f6fe4',
    'nav-active-fg': '#ffffff'
  }
} as const

export type TokenName = keyof (typeof tokens)['light']

/** Jetons du thème courant, à utiliser dans un `sx={(theme) => …}`. */
export const tok = (theme: { palette: { mode: string } }): Record<TokenName, string> =>
  tokens[theme.palette.mode === 'dark' ? 'dark' : 'light']
