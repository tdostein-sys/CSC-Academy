export const locales = ['fr', 'en'] as const;
export type AppLocale = (typeof locales)[number];
export const defaultLocale: AppLocale = 'fr';
export const LOCALE_COOKIE = 'NEXT_LOCALE';

export function toLocale(value: unknown): AppLocale {
  return value === 'en' ? 'en' : 'fr';
}
