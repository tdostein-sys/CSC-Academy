import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import { requireConsultingStaff } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/page-header';
import { FilterPills } from '@/components/ui/filter-pills';
import { TextLink } from '@/components/ui/links';
import { EmptyCard, TableCard, TableCell, TableRow } from '@/components/ui/table-card';
import { StatusBadge } from '@/components/status-badge';
import { BookingStatusBadge } from '@/components/consulting/booking-status';
import { formatDate, formatXAF } from '@/lib/format';
import { localized } from '@/lib/localized';
import { bookingRef, num, type BookingDetails } from '@/lib/consulting/types';
import type { Locale } from '@/lib/types';

export const metadata: Metadata = { title: 'Consultations' };
export const dynamic = 'force-dynamic';

const FILTERS = ['upcoming', 'pending', 'past', 'all'] as const;
type Filter = (typeof FILTERS)[number];

/**
 * Rendez-vous à traiter : le conseiller voit ceux qui lui sont attribués,
 * l'administrateur tous (filtrage par la vue, côté base).
 */
export default async function ManageBookingsPage({ searchParams }: { searchParams: Promise<{ f?: string }> }) {
  const user = await requireConsultingStaff();
  const { f } = await searchParams;
  const filter: Filter = (FILTERS as readonly string[]).includes(f ?? '') ? (f as Filter) : 'upcoming';
  const [t, locale, supabase] = await Promise.all([getTranslations('consulting'), getLocale(), createClient()]);
  const l = locale as Locale;
  const now = new Date().toISOString();

  let query = supabase
    .from('consulting_booking_details')
    .select('id, ref, offer_title_fr, offer_title_en, mode, starts_at, ends_at, price, status, paid, report_status, client_first_name, client_last_name, advisor_name');
  if (filter === 'upcoming') query = query.in('status', ['confirmed', 'pending_payment']).gte('ends_at', now).order('starts_at', { ascending: true });
  else if (filter === 'pending') query = query.eq('status', 'pending_payment').order('starts_at', { ascending: true });
  else if (filter === 'past') query = query.lt('ends_at', now).order('starts_at', { ascending: false });
  else query = query.order('starts_at', { ascending: false });
  const { data } = await query.limit(300);
  const rows = (data ?? []) as BookingDetails[];

  return (
    <>
      <PageHeader title={t('manage.title')} subtitle={user.isAdmin ? t('manage.subtitleAdmin') : t('manage.subtitleAdvisor')} />
      <FilterPills
        label={t('manage.filter')}
        items={FILTERS.map((k) => ({ key: k, href: `/consulting/manage?f=${k}`, label: t(`manage.filters.${k}`), active: k === filter }))}
      />
      {rows.length === 0 ? (
        <EmptyCard>{t('manage.empty')}</EmptyCard>
      ) : (
        <TableCard head={[t('bookings.date'), t('manage.client'), t('bookings.offer'), t('bookings.mode'), t('bookings.price'), t('bookings.status'), t('bookings.report')]}>
          {rows.map((r) => (
            <TableRow key={r.id} hover>
              <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDate(r.starts_at, l, true)}</TableCell>
              <TableCell>
                <TextLink href={`/consulting/manage/${r.id}`}>
                  {r.client_first_name} {r.client_last_name}
                </TextLink>
                <br />
                <span style={{ fontSize: '0.8125rem', opacity: 0.75 }}>
                  {bookingRef(r.ref)}
                  {user.isAdmin ? ` · ${r.advisor_name}` : ''}
                </span>
              </TableCell>
              <TableCell>{localized(l, r.offer_title_fr, r.offer_title_en)}</TableCell>
              <TableCell>{t(`mode.${r.mode}`)}</TableCell>
              <TableCell sx={{ whiteSpace: 'nowrap' }}>
                {num(r.price) === 0 ? t('free') : formatXAF(r.price, l)}
                {num(r.price) > 0 && r.paid && (
                  <>
                    <br />
                    <span style={{ fontSize: '0.8125rem', opacity: 0.75 }}>{t('detail.paid')}</span>
                  </>
                )}
              </TableCell>
              <TableCell>
                <BookingStatusBadge status={r.status} endsAt={r.ends_at} />
              </TableCell>
              <TableCell>
                {r.report_status ? <StatusBadge tone={r.report_status === 'published' ? 'validated' : 'draft'}>{t(`report.status.${r.report_status}`)}</StatusBadge> : '—'}
              </TableCell>
            </TableRow>
          ))}
        </TableCard>
      )}
    </>
  );
}
