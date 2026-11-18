import type { Locale } from '@/lib/types';
import { PAYOUT_METHODS } from '@/lib/validation/ambassador';

const LABELS: Record<(typeof PAYOUT_METHODS)[number], Record<Locale, string>> = {
  orange_money: { fr: 'Orange Money', en: 'Orange Money' },
  mtn_momo: { fr: 'MTN Mobile Money', en: 'MTN Mobile Money' },
  binance_pay: { fr: 'Binance Pay', en: 'Binance Pay' },
  bank_transfer: { fr: 'Virement bancaire', en: 'Bank transfer' },
  cash: { fr: 'Espèces', en: 'Cash' },
  other: { fr: 'Autre', en: 'Other' },
};

/** Libellé d'un moyen de paiement (la base stocke la clé, ex. « orange_money »). */
export function payoutMethodLabel(method: string, locale: Locale | string): string {
  const l: Locale = locale === 'en' ? 'en' : 'fr';
  return (LABELS as Record<string, Record<Locale, string>>)[method]?.[l] ?? method;
}

export function payoutMethodOptions(locale: Locale | string) {
  return PAYOUT_METHODS.map((m) => ({ value: m, label: payoutMethodLabel(m, locale) }));
}
