import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import { requireUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/page-header';
import { TextLink, LinkButton } from '@/components/ui/links';
import { EmptyCard, TableCard, TableCell, TableRow } from '@/components/ui/table-card';
import { BookingStatusBadge } from '@/components/consulting/booking-status';
import { StatusBadge } from '@/components/status-badge';
import { formatDate, formatXAF } from '@/lib/format';
import { localized } from '@/lib/localized';
import { bookingRef, num, type BookingDetails } from '@/lib/consulting/types';
import type { Locale } from '@/lib/types';
import Card from '@mui/material/Card';
import { BookingCalendarLazy } from '@/components/consulting/booking-calendar-lazy';
import { CalendarViewSwitch, calendarLabels, type CalendarView } from '@/components/consulting/calendar-view';
import { toCalendarBookings } from '@/lib/consulting/calendar';

export const metadata: Metadata = { title: 'Mes rendez-vous' };
export const dynamic = 'force-dynamic';

/** Rendez-vous du client connecté (la vue ne renvoie que les siens) : calendrier ou liste. */
export default async function MyBookingsPage({ searchParams }: { searchParams: Promise<{ vue?: string }> }) {
  const user = await requireUser('/consulting/bookings');
  const [t, locale, supabase, { vue }] = await Promise.all([getTranslations('consulting'), getLocale(), createClient(), searchParams]);
  const l = locale as Locale;
  const view: CalendarView = vue === 'liste' ? 'liste' : 'calendrier';

  const { data } = await supabase
    .from('consulting_booking_details')
    .select('id, ref, offer_title_fr, offer_title_en, mode, starts_at, ends_at, price, status, report_status, advisor_name')
    .eq('client_id', user.id)
    .order('starts_at', { ascending: false })
    .limit(200);
  const rows = (data ?? []) as BookingDetails[];

  return (
    <>
      <PageHeader
        title={t('bookings.title')}
        subtitle={t('bookings.subtitle')}
        actions={
          <LinkButton href="/consulting" variant="contained">
            {t('bookings.new')}
          </LinkButton>
        }
      />
      {rows.length > 0 && <CalendarViewSwitch basePath="/consulting/bookings" view={view} />}
      {rows.length === 0 ? (
        <EmptyCard>{t('bookings.empty')}</EmptyCard>
      ) : view === 'calendrier' ? (
        <Card sx={{ p: { xs: 3, sm: 5 } }}>
          <BookingCalendarLazy bookings={toCalendarBookings(rows, 'client', l)} locale={l} labels={await calendarLabels()} />
        </Card>
      ) : (
        <TableCard head={[t('bookings.date'), t('bookings.offer'), t('bookings.mode'), t('bookings.price'), t('bookings.status'), t('bookings.report')]}>
          {rows.map((r) => (
            <TableRow key={r.id} hover>
              <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDate(r.starts_at, l, true)}</TableCell>
              <TableCell>
                <TextLink href={`/consulting/bookings/${r.id}`}>{localized(l, r.offer_title_fr, r.offer_title_en)}</TextLink>
                <br />
                <span style={{ fontSize: '0.8125rem', opacity: 0.75 }}>
                  {bookingRef(r.ref)} · {r.advisor_name}
                </span>
              </TableCell>
              <TableCell>{t(`mode.${r.mode}`)}</TableCell>
              <TableCell sx={{ whiteSpace: 'nowrap' }}>{num(r.price) === 0 ? t('free') : formatXAF(r.price, l)}</TableCell>
              <TableCell>
                <BookingStatusBadge status={r.status} endsAt={r.ends_at} />
              </TableCell>
              <TableCell>{r.report_status === 'published' ? <StatusBadge tone="validated">{t('bookings.reportReady')}</StatusBadge> : '—'}</TableCell>
            </TableRow>
          ))}
        </TableCard>
      )}
    </>
  );
}
