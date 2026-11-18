import type { Locale } from '@/lib/types';

/**
 * Contenu bilingue saisi par l'admin (une langue saisie, l'autre traduite
 * automatiquement). Si la version demandée est vide (traduction indisponible),
 * on affiche l'autre.
 */
export function localized(locale: Locale | string, fr: string | null | undefined, en: string | null | undefined): string {
  const primary = locale === 'en' ? en : fr;
  const fallback = locale === 'en' ? fr : en;
  return (primary?.trim() ? primary : fallback) ?? '';
}
