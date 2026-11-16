/** Pastilles de statut (couleurs testées WCAG AA dans les deux thèmes). */
const TONES = {
  pending: 'bg-warning-soft text-warning',
  validated: 'bg-success-soft text-success',
  rejected: 'bg-error-soft text-error',
  draft: 'bg-surface-2 text-muted',
  launched: 'bg-success-soft text-success',
  closed: 'bg-info-soft text-info',
  active: 'bg-success-soft text-success',
  suspended: 'bg-error-soft text-error',
  info: 'bg-info-soft text-info',
  neutral: 'bg-surface-2 text-muted',
} as const;

export type BadgeTone = keyof typeof TONES;

export function StatusBadge({ tone, children }: { tone: BadgeTone; children: React.ReactNode }) {
  return <span className={`badge ${TONES[tone]}`}>{children}</span>;
}
