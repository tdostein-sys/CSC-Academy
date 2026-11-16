import { StatusBadge } from './status-badge';

/** État de paiement d'un ID validé (calculé par la vue submission_payment_states). */
export type PaymentState = 'paid' | 'awaiting_confirmation' | 'due';

const TONE = { paid: 'validated', awaiting_confirmation: 'info', due: 'pending' } as const;

export function PaymentBadge({ state, label }: { state: PaymentState; label: string }) {
  return (
    <span className="mt-1 block">
      <StatusBadge tone={TONE[state]}>{label}</StatusBadge>
    </span>
  );
}
