import type { Locale } from '@/lib/types';

const intlLocale = (l: Locale) => (l === 'en' ? 'en-GB' : 'fr-FR');

/** 150000 → « 150 000 FCFA » (le XAF n'a pas de centimes). */
export function formatXAF(amount: number | bigint | string, locale: Locale = 'fr'): string {
  const n = typeof amount === 'string' ? Number(amount) : Number(amount);
  const formatted = new Intl.NumberFormat(intlLocale(locale), { maximumFractionDigits: 0 }).format(n);
  // Espace insécable fine → espace insécable classique (rendu homogène).
  return `${formatted.replace(/ /g, ' ')} FCFA`;
}

export function formatNumber(n: number | string, locale: Locale = 'fr', maxFractionDigits = 2): string {
  return new Intl.NumberFormat(intlLocale(locale), { maximumFractionDigits: maxFractionDigits })
    .format(Number(n))
    .replace(/ /g, ' ');
}

export function formatDate(value: string | Date | null | undefined, locale: Locale = 'fr', withTime = false): string {
  if (!value) return '—';
  const d = typeof value === 'string' ? new Date(value) : value;
  return new Intl.DateTimeFormat(intlLocale(locale), {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
    timeZone: 'Africa/Douala',
  }).format(d);
}
