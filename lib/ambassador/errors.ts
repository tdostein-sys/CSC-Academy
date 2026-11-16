/**
 * Les fonctions SQL lèvent des erreurs au code stable (ex. « binance_uid_taken »).
 * On les traduit en clés de messages ; toute autre erreur reste générique
 * (aucun détail technique n'est montré à l'utilisateur).
 */
export const AMBASSADOR_ERROR_CODES = [
  'profile_incomplete',
  'not_ambassador',
  'ambassador_suspended',
  'campaign_not_open',
  'not_participating',
  'participation_locked',
  'binance_uid_invalid',
  'binance_uid_taken',
  'volume_invalid',
  'volume_below_minimum',
  'already_reviewed',
  'reason_required',
  'invalid_decision',
  'only_rejected_deletable',
  'amount_invalid',
  'method_required',
  'payout_exceeds_due',
  'pending_submissions',
  'unpaid_payouts',
  'unconfirmed_payouts',
  'invalid_status_transition',
  'campaign_incomplete',
  'campaign_amount_frozen',
  'campaign_closed',
  'not_found',
  'forbidden',
] as const;

export type AmbassadorErrorCode = (typeof AMBASSADOR_ERROR_CODES)[number];

export function ambassadorErrorKey(error: { message?: string } | null | undefined): string {
  const msg = error?.message ?? '';
  // Codes testés du plus long au plus court (aucun n'est préfixe d'un autre ici,
  // mais on reste prudent).
  const code = [...AMBASSADOR_ERROR_CODES].sort((a, b) => b.length - a.length).find((c) => msg.includes(c));
  if (!code) return 'errors.generic';
  if (code === 'forbidden') return 'errors.forbidden';
  return `ambassador.errors.${code}`;
}
