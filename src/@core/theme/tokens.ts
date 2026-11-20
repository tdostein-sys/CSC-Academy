import { BRAND, BRANDS } from './brand'

/**
 * Jetons de couleur — direction artistique « Premium FinTech » (refonte UI).
 *   Base sobre (encre marine, surfaces claires), couleur d'action issue de
 *   `brand.ts` (émeraude du logo par défaut), or réservé aux distinctions
 *   (« Bientôt », attestation), statuts sur fonds teintés.
 *
 * Trois niveaux de surface : `surface` = fond de page, `bg` = cartes,
 * `surface-2` = zones surélevées / grisées. Les jetons `nav-*` décrivent le
 * menu latéral marine (identique dans les deux thèmes, bordure droite en sombre).
 *
 * Contrastes vérifiés automatiquement WCAG AA (tests/unit/theme-contrast.test.ts).
 * Aucune couleur en dur dans les pages : tout passe par le thème ou ces jetons.
 */
const brand = BRANDS[BRAND]

export const tokens = {
  light: {
    bg: '#FFFFFF',
    surface: '#F5F7FA',
    'surface-2': '#F8FAFC',
    border: '#E4E8EF',
    text: '#0B1526',
    muted: '#5B6577',
    ...brand.light,
    secondary: '#1E44A8',
    'secondary-fg': '#FFFFFF',
    accent: '#F2C14E',
    'accent-hover': '#E5B23A',
    'accent-fg': '#3A2A00',
    'accent-soft': '#FDF3D6',
    success: '#06603F',
    'success-soft': '#E7F5EF',
    warning: '#8A4B04',
    'warning-soft': '#FEF3C7',
    error: '#A42A20',
    'error-soft': '#FDECEA',
    info: '#1E44A8',
    'info-soft': '#E8EEFB',
    neutral: '#46505F',
    'neutral-soft': '#EEF1F5',
    'on-status': '#FFFFFF',
    'nav-bg': '#0A1628',
    'nav-border': '#0A1628',
    'nav-text': '#E8EDF5',
    'nav-muted': '#9AA7BC',
    'nav-hover': '#13233B',
    'nav-active-fg': '#FFFFFF',
    'nav-section': '#8C9AB2',
    // Lien d'action dans le menu marine (variante claire de la couleur d'action).
    'nav-link': brand.dark.primary,
    // Fond des vignettes vidéo (visio, replays) et texte posé dessus.
    media: '#0B1220',
    'on-media': '#FFFFFF',
    'media-label': 'rgba(0, 0, 0, 0.65)',
    // Graphiques : palette validée (daltonisme, contraste) sur fonds clair et sombre.
    'chart-1': '#2a78d6',
    'chart-2': '#eb6834'
  },
  dark: {
    bg: '#0F1A2C',
    surface: '#070E1A',
    'surface-2': '#16243A',
    border: '#25344D',
    text: '#E8EDF5',
    muted: '#9AA7BC',
    ...brand.dark,
    secondary: '#8DB4FF',
    'secondary-fg': '#071430',
    accent: '#F2C14E',
    'accent-hover': '#F5CD6B',
    'accent-fg': '#3A2A00',
    'accent-soft': '#2A2210',
    success: '#5BE0AE',
    'success-soft': '#0E3326',
    warning: '#F2C14E',
    'warning-soft': '#2A2210',
    error: '#FF8A80',
    'error-soft': '#3A1515',
    info: '#8DB4FF',
    'info-soft': '#14244A',
    neutral: '#B8C3D6',
    'neutral-soft': '#1C2A42',
    'on-status': '#070E1A',
    'nav-bg': '#0A1628',
    'nav-border': '#25344D',
    'nav-text': '#E8EDF5',
    'nav-muted': '#9AA7BC',
    'nav-hover': '#13233B',
    'nav-active-fg': '#FFFFFF',
    'nav-section': '#8C9AB2',
    // Lien d'action dans le menu marine (variante claire de la couleur d'action).
    'nav-link': brand.dark.primary,
    media: '#0B1220',
    'on-media': '#FFFFFF',
    'media-label': 'rgba(0, 0, 0, 0.65)',
    'chart-1': '#3987e5',
    'chart-2': '#d95926'
  }
} as const

export type TokenName = keyof (typeof tokens)['light']

/** Jetons du thème courant, à utiliser dans un `sx={(theme) => …}`. */
export const tok = (theme: { palette: { mode: string } }): Record<TokenName, string> =>
  tokens[theme.palette.mode === 'dark' ? 'dark' : 'light']
