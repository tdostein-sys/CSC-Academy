/**
 * Couleur d'action de CSC (boutons, liens, éléments actifs).
 *
 * Pour changer la couleur d'action de TOUTE l'application, changez UNE
 * seule ligne : `BRAND`. Chaque préréglage fournit ses variantes clair /
 * sombre (contrastes vérifiés par tests/unit/theme-contrast.test.ts).
 */
export const BRAND: keyof typeof BRANDS = 'emerald';

export const BRANDS = {
  /** Vert émeraude du logo (choix par défaut). */
  emerald: {
    light: { primary: '#0A7F5A', 'primary-hover': '#08694A', 'primary-fg': '#FFFFFF', 'primary-soft': '#E7F5EF', 'nav-active-bg': '#0E3326' },
    dark: { primary: '#3DD29B', 'primary-hover': '#2FB884', 'primary-fg': '#04241A', 'primary-soft': '#0E3326', 'nav-active-bg': '#0E3326' },
  },
  /** Variante bleue. */
  blue: {
    light: { primary: '#1D4ED8', 'primary-hover': '#1E40AF', 'primary-fg': '#FFFFFF', 'primary-soft': '#E8EEFB', 'nav-active-bg': '#14244A' },
    dark: { primary: '#8DB4FF', 'primary-hover': '#A9C6FF', 'primary-fg': '#071430', 'primary-soft': '#14244A', 'nav-active-bg': '#14244A' },
  },
} as const;
