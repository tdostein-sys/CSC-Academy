/** Préférence de thème (clair / sombre / système), partagée serveur ↔ navigateur. */
export type ThemePref = 'light' | 'dark' | 'system';

/** Choix de l'utilisateur. */
export const THEME_COOKIE = 'CSC_THEME';
/** Dernier thème système observé (permet au serveur de rendre directement le bon thème). */
export const THEME_SYSTEM_COOKIE = 'CSC_THEME_SYSTEM';

export function toThemePref(value: unknown): ThemePref {
  return value === 'light' || value === 'dark' ? value : 'system';
}

export function writeCookie(name: string, value: string) {
  document.cookie = `${name}=${value}; path=/; max-age=31536000; samesite=lax`;
}
