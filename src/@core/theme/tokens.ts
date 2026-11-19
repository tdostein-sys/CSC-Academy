/**
 * Palette de l'interface.
 *   Clair : maquette « tableau de bord » bleu / bleu nuit — bleu principal
 *   #1d5fd6, menu latéral bleu nuit #0f1c3f, violet #5b3fc4 (information).
 *   Sombre : mêmes bleus, en nuances de bleu nuit plus lumineuses — bleu
 *   principal #6ea8ff, menu latéral bleu nuit #0c1733, violet doux #c4b5fd.
 *   Dans les deux : vert, rouge, ambre pour les états ; or CSC en accent.
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
  // Sombre : mêmes bleus que le clair, en nuances de bleu nuit lumineuses ;
  // cartes nettement plus claires que le fond de page pour bien les distinguer.
  dark: {
    bg: '#182644',
    surface: '#0e182e',
    'surface-2': '#213257',
    border: '#30436a',
    text: '#eef3fc',
    muted: '#b4c3df',
    primary: '#6ea8ff',
    'primary-hover': '#8dbbff',
    'primary-fg': '#071430',
    'primary-soft': '#1c386a',
    secondary: '#c4b5fd',
    'secondary-fg': '#140c33',
    accent: '#ffcb2e',
    'accent-hover': '#ffd658',
    'accent-fg': '#1a1500',
    'accent-soft': '#3d3415',
    success: '#5ee39a',
    'success-soft': '#123a2c',
    warning: '#ffc247',
    'warning-soft': '#3f3214',
    error: '#ff8f8f',
    'error-soft': '#47202b',
    info: '#c4b5fd',
    'info-soft': '#2e2858',
    'on-status': '#0e182e',
    'nav-bg': '#0c1733',
    'nav-text': '#eef3fc',
    'nav-muted': '#a5b4d0',
    'nav-hover': '#1a284c',
    'nav-active-from': '#1d5fd6',
    'nav-active-to': '#2f6fe4',
    'nav-active-fg': '#ffffff'
  }
} as const

export type TokenName = keyof (typeof tokens)['light']

/** Jetons du thème courant, à utiliser dans un `sx={(theme) => …}`. */
export const tok = (theme: { palette: { mode: string } }): Record<TokenName, string> =>
  tokens[theme.palette.mode === 'dark' ? 'dark' : 'light']
