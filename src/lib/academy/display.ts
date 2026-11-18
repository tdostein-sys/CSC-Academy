import type { BadgeTone } from '@/components/status-badge';
import type { EnrollmentStatus, InstallmentState } from './types';

/** Couleur de la pastille d'une inscription. */
export function enrollmentTone(status: EnrollmentStatus, overdue = false): BadgeTone {
  if (status === 'cancelled') return 'neutral';
  if (overdue) return 'rejected';
  return status === 'active' ? 'active' : 'pending';
}

/** État affiché d'une inscription : le blocage (J+3) prime sur le retard. */
export type EnrollmentDisplay = EnrollmentStatus | 'overdue' | 'blocked';

export function enrollmentDisplay(
  status: EnrollmentStatus,
  b?: { overdue_count?: number | string | null; blocked_since?: string | null } | null,
): EnrollmentDisplay {
  if (status !== 'active') return status;
  if (b?.blocked_since) return 'blocked';
  return Number(b?.overdue_count ?? 0) > 0 ? 'overdue' : 'active';
}

export function displayTone(d: EnrollmentDisplay): BadgeTone {
  if (d === 'blocked' || d === 'overdue') return 'rejected';
  return enrollmentTone(d);
}

/** Couleur de la pastille d'une tranche. */
export function installmentTone(state: InstallmentState, overdue: boolean): BadgeTone {
  if (state === 'paid') return 'validated';
  if (overdue) return 'rejected';
  return state === 'partial' ? 'info' : 'pending';
}

/** Couleur de la pastille d'une formation. */
export function courseTone(status: 'draft' | 'published' | 'archived'): BadgeTone {
  return status === 'published' ? 'active' : status === 'archived' ? 'closed' : 'draft';
}
