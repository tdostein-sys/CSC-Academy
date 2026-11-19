import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/page-header';
import { Pagination, pageRange } from '@/components/pagination';
import { StatusBadge } from '@/components/status-badge';
import { TextLink } from '@/components/ui/links';
import { EmptyCard, TableCard, TableCell, TableRow } from '@/components/ui/table-card';
import { payoutMethodLabel } from '@/lib/ambassador/methods';
import { formatDate, formatXAF } from '@/lib/format';
import { bookingRef, type PaymentStatus } from '@/lib/consulting/types';
import type { Locale } from '@/lib/types';

export const metadata: Metadata = { title: 'Paiements des consultations' };

const PAGE_SIZE = 30;
const TONE = { confirmed: 'validated', pending: 'pending', failed: 'rejected', refunded: 'info' } as const;

interface Row {
  id: string;
  booking_id: string;
  amount: number;
  status: PaymentStatus;
  method: string;
  reference: string;
  paid_on: string;
  proof_path: string | null;
  refund_reference: string | null;
  consulting_bookings: { ref: number; profiles: { first_name: string; last_name: string } | null } | null;
}

/** Journal des paiements de consultations (montants en FCFA, références uniques). */
export default async function ConsultingPaymentsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  await requireAdmin();
  const { page } = await searchParams;
  const [t, locale, supabase] = await Promise.all([getTranslations('consulting'), getLocale(), createClient()]);
  const l = locale as Locale;
  const { from, to, current } = pageRange(page, PAGE_SIZE);
  const { data, count } = await supabase
    .from('consulting_payments')
    .select('id, booking_id, amount, status, method, reference, paid_on, proof_path, refund_reference, consulting_bookings (ref, profiles:client_id (first_name, last_name))', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);
  const rows = (data ?? []) as unknown as Row[];

  return (
    <>
      <PageHeader title={t('manage.paymentsTitle')} subtitle={t('manage.paymentsSubtitle')} />
      {rows.length === 0 ? (
        <EmptyCard>{t('manage.noPayments')}</EmptyCard>
      ) : (
        <TableCard head={[t('manage.paidOn'), t('manage.client'), t('detail.ref'), t('manage.amount'), t('manage.method'), t('manage.reference'), t('bookings.status')]}>
          {rows.map((r) => (
            <TableRow key={r.id} hover>
              <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDate(r.paid_on, l)}</TableCell>
              <TableCell>
                {r.consulting_bookings?.profiles ? `${r.consulting_bookings.profiles.first_name} ${r.consulting_bookings.profiles.last_name}` : '—'}
              </TableCell>
              <TableCell>
                <TextLink href={`/consulting/manage/${r.booking_id}`}>{r.consulting_bookings ? bookingRef(r.consulting_bookings.ref) : '—'}</TextLink>
              </TableCell>
              <TableCell sx={{ whiteSpace: 'nowrap', fontWeight: 600 }}>{formatXAF(r.amount, l)}</TableCell>
              <TableCell>{payoutMethodLabel(r.method, l)}</TableCell>
              <TableCell>
                {r.reference || '—'}
                {r.proof_path && (
                  <>
                    {' · '}
                    <TextLink href={`/consulting/manage/proof/${r.id}`} target="_blank" rel="noopener">
                      {t('manage.openProof')}
                    </TextLink>
                  </>
                )}
              </TableCell>
              <TableCell>
                <StatusBadge tone={TONE[r.status]}>{t(`manage.paymentStatus.${r.status}`)}</StatusBadge>
              </TableCell>
            </TableRow>
          ))}
        </TableCard>
      )}
      <Pagination basePath="/admin/consulting/payments" current={current} total={count ?? 0} pageSize={PAGE_SIZE} />
    </>
  );
}
