/**
 * Codes d'erreur stables levés par les fonctions SQL d'Academy, traduits en
 * clés de messages. Toute autre erreur reste générique (aucun détail technique).
 */
export const ACADEMY_ERROR_CODES = [
  'profile_incomplete',
  'enrollment_closed',
  'already_enrolled',
  'session_full',
  'referral_invalid',
  'referral_self',
  'enrollment_not_cancellable',
  'enrollment_cancelled',
  'payment_exceeds_due',
  'amount_invalid',
  'method_required',
  'date_invalid',
  'session_frozen',
  'seats_below_enrolled',
  'schedule_invalid',
  'schedule_dates_order',
  'schedule_missing',
  'course_not_published',
  'payout_exceeds_due',
  'evaluation_locked',
  'evaluation_empty',
  'evaluation_closed',
  'evaluation_already_passed',
  'attempts_exhausted',
  'access_blocked',
  'answers_invalid',
  'question_invalid',
  'reason_required',
  'meeting_external',
  'meeting_too_early',
  'meeting_over',
  'meeting_not_live',
  'live_not_configured',
  'not_found',
  'forbidden',
  'unauthorized',
] as const;

export type AcademyErrorCode = (typeof ACADEMY_ERROR_CODES)[number];

export function academyErrorKey(error: { message?: string; code?: string } | null | undefined): string {
  const msg = error?.message ?? '';
  const code = [...ACADEMY_ERROR_CODES].sort((a, b) => b.length - a.length).find((c) => msg.includes(c));
  if (code === 'forbidden' || code === 'unauthorized') return 'errors.forbidden';
  if (code) return `academy.errors.${code}`;
  // Suppression refusée par une clé étrangère (ex. session avec des inscrits).
  if (error?.code === '23503') return 'academy.errors.has_dependents';
  return 'errors.generic';
}
