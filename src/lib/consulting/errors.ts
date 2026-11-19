/**
 * Codes d'erreur stables levés par les fonctions SQL de CSC Consulting,
 * traduits en clés de messages. Toute autre erreur reste générique.
 */
export const CONSULTING_ERROR_CODES = [
  'profile_incomplete',
  'message_too_long',
  'offer_unavailable',
  'offer_already_used',
  'slot_unavailable',
  'slot_taken',
  'client_overlap',
  'booking_not_cancellable',
  'booking_not_reschedulable',
  'booking_not_payable',
  'booking_not_confirmed',
  'booking_not_video',
  'booking_free',
  'booking_terms_frozen',
  'cancel_too_late',
  'reschedule_too_late',
  'amount_mismatch',
  'method_required',
  'reference_required',
  'reference_used',
  'payment_not_refundable',
  'refund_requires_cancellation',
  'meeting_too_early',
  'meeting_over',
  'report_published',
  'report_incomplete',
  'report_missing',
  'date_invalid',
  'not_found',
  'forbidden',
  'unauthorized',
] as const;

export type ConsultingErrorCode = (typeof CONSULTING_ERROR_CODES)[number];

export function consultingErrorKey(error: { message?: string; code?: string } | null | undefined): string {
  const msg = error?.message ?? '';
  const code = [...CONSULTING_ERROR_CODES].sort((a, b) => b.length - a.length).find((c) => msg.includes(c));
  if (code === 'forbidden' || code === 'unauthorized') return 'errors.forbidden';
  if (code) return `consulting.errors.${code}`;
  // Contrainte d'exclusion (créneau pris) atteinte par une écriture directe.
  if (error?.code === '23P01') return 'consulting.errors.slot_taken';
  // Suppression refusée par une clé étrangère (offre avec des rendez-vous…).
  if (error?.code === '23503') return 'consulting.errors.has_dependents';
  return 'errors.generic';
}
