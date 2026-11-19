import { getTranslations } from 'next-intl/server';
import { StatusBadge, type BadgeTone } from '@/components/status-badge';
import { isPast, type BookingStatus } from '@/lib/consulting/types';

const TONE: Record<BookingStatus, BadgeTone> = {
  pending_payment: 'pending',
  confirmed: 'validated',
  expired: 'neutral',
  cancelled: 'rejected',
  refunded: 'info',
};

/** Statut d'un rendez-vous ; un rendez-vous confirmé passé s'affiche « terminé ». */
export async function BookingStatusBadge({ status, endsAt }: { status: BookingStatus; endsAt?: string }) {
  const t = await getTranslations('consulting.status');
  const done = status === 'confirmed' && isPast(endsAt);
  return <StatusBadge tone={done ? 'closed' : TONE[status]}>{done ? t('done') : t(status)}</StatusBadge>;
}
