import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { Video } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { Markdown } from '@/components/markdown';
import { SectionCard } from '@/components/ui/section-card';
import { Notice } from '@/components/ui/notice';
import { LinkButton } from '@/components/ui/links';
import { ActionForm } from '@/components/forms/action-form';
import { SubmitButton } from '@/components/forms/fields';
import { SlotPicker } from '@/components/consulting/slot-picker';
import { BookingStatusBadge } from '@/components/consulting/booking-status';
import { BookingFacts, BookingHistory, ReportContent } from '@/components/consulting/booking-parts';
import { formatDate, formatXAF } from '@/lib/format';
import { localized } from '@/lib/localized';
import { loadSlotDays } from '@/lib/consulting/slots';
import {
  SETTINGS_COLUMNS,
  UUID,
  bookingRef,
  clientCanChange,
  isPast,
  videoOpensAt,
  videoWindow,
  type BookingDetails,
  type BookingEvent,
  type ReportView,
  type Settings,
} from '@/lib/consulting/types';
import type { Locale } from '@/lib/types';
import { PageHeader } from '@/components/page-header';
import { cancelMyBooking, rescheduleMyBooking } from '../../actions';

export const metadata: Metadata = { title: 'Mon rendez-vous' };
export const dynamic = 'force-dynamic';

type Flags = { booked?: string; cancelled?: string; rescheduled?: string };

/** Détail d'un rendez-vous côté client : paiement, visio, report, annulation, compte rendu. */
export default async function MyBookingPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Flags> }) {
  const [{ id }, flags] = await Promise.all([params, searchParams]);
  if (!UUID.test(id)) notFound();
  const user = await requireUser(`/consulting/bookings/${id}`);
  const [t, tn, locale, supabase] = await Promise.all([getTranslations('consulting'), getTranslations('nav'), getLocale(), createClient()]);
  const l = locale as Locale;

  // En parallèle. La vue ne renvoie au client que ses propres rendez-vous ;
  // l'historique est protégé par la RLS.
  const [{ data }, { data: settingsData }, { data: eventsData }] = await Promise.all([
    supabase.from('consulting_booking_details').select('*').eq('id', id).eq('client_id', user.id).maybeSingle(),
    supabase.from('consulting_settings').select(SETTINGS_COLUMNS).maybeSingle(),
    supabase.from('consulting_booking_events').select('id, booking_id, event, data, created_at').eq('booking_id', id).order('id'),
  ]);
  const b = data as BookingDetails | null;
  if (!b) notFound();
  const settings = settingsData as Settings | null;
  const events = (eventsData ?? []) as BookingEvent[];

  // Compte rendu publié : lecture par la fonction dédiée, qui journalise l'accès.
  let report: ReportView | null = null;
  if (b.report_status === 'published') {
    const { data: r } = await supabase.rpc('consulting_report_view', { p_booking: id });
    report = (r as ReportView | null) ?? null;
  }

  const canChange = settings ? clientCanChange(b, settings.cancel_limit_hours) : false;
  const rescheduleDays = canChange ? await loadSlotDays(supabase, b.offer_id, l, b.id) : [];
  const win = videoWindow(b, false);
  const instructions = settings ? localized(l, settings.payment_instructions_fr, settings.payment_instructions_en) : '';

  return (
    <Stack spacing={6}>
      <PageHeader
        breadcrumbs={[{ label: tn('consulting'), href: '/consulting' }, { label: tn('tabs.myAppointments'), href: '/consulting/bookings' }, { label: bookingRef(b.ref) }]}
        eyebrow={<BookingStatusBadge status={b.status} endsAt={b.ends_at} />}
        title={localized(l, b.offer_title_fr, b.offer_title_en)}
        subtitle={`${bookingRef(b.ref)} · ${formatDate(b.starts_at, l, true)}`}
      />

      {flags.booked && <Notice tone="success">{b.status === 'confirmed' ? t('detail.bookedConfirmed') : t('detail.bookedPending')}</Notice>}
      {flags.cancelled && <Notice tone="success">{b.paid ? t('detail.cancelledRefund') : t('detail.cancelledDone')}</Notice>}
      {flags.rescheduled && <Notice tone="success">{t('detail.rescheduledDone')}</Notice>}

      {b.status === 'pending_payment' && (
        <SectionCard id="booking-payment" title={t('detail.paymentTitle')} highlight>
          <Stack spacing={3}>
            <Typography>
              {t('detail.paymentDue', { amount: formatXAF(b.price, l), until: formatDate(b.hold_expires_at, l, true) })}
            </Typography>
            {instructions ? <Markdown source={instructions} /> : <Typography sx={{ color: 'text.secondary' }}>{t('detail.paymentContact')}</Typography>}
            <Notice tone="info">{t('detail.paymentReference', { ref: bookingRef(b.ref) })}</Notice>
          </Stack>
        </SectionCard>
      )}
      {b.status === 'expired' && <Notice tone="warning">{t('detail.expiredInfo')}</Notice>}
      {b.status === 'refunded' && <Notice tone="info">{t('detail.refundedInfo')}</Notice>}

      {b.status === 'confirmed' && b.mode === 'video' && win !== 'over' && (
        <SectionCard id="booking-video" title={t('detail.videoTitle')}>
          {win === 'open' ? (
            <LinkButton href={`/consulting/bookings/${b.id}/live`} variant="contained" startIcon={<Video aria-hidden size={18} />}>
              {t('detail.joinVideo')}
            </LinkButton>
          ) : (
            <Typography>{t('detail.videoOpensAt', { time: formatDate(videoOpensAt(b, false), l, true) })}</Typography>
          )}
        </SectionCard>
      )}

      <SectionCard id="booking-info" title={t('detail.infoTitle')}>
        <BookingFacts b={b} />
      </SectionCard>

      {report && (
        <SectionCard id="booking-report" title={t('report.title')}>
          <ReportContent report={report} fileHref={(fid) => `/consulting/files/${fid}`} />
        </SectionCard>
      )}

      {canChange && (
        <>
          <SectionCard id="booking-reschedule" title={t('detail.rescheduleTitle')} subtitle={t('detail.rescheduleHint', { hours: settings!.cancel_limit_hours })}>
            <SlotPicker
              days={rescheduleDays}
              action={rescheduleMyBooking}
              hidden={{ id: b.id }}
              submitLabel={t('detail.rescheduleSubmit')}
              timezoneNote={t('picker.timezone')}
            />
          </SectionCard>
          <SectionCard id="booking-cancel" title={t('detail.cancelTitle')}>
            <ActionForm
              action={cancelMyBooking}
              confirm={b.paid ? t('detail.cancelConfirmPaid') : t('detail.cancelConfirm')}
              confirmLabel={t('detail.cancelSubmit')}
              danger
            >
              <input type="hidden" name="id" value={b.id} />
              <SubmitButton pending={false} fullWidth={false} color="error" variant="outlined" size="medium">
                {t('detail.cancelSubmit')}
              </SubmitButton>
            </ActionForm>
          </SectionCard>
        </>
      )}
      {!canChange && b.status === 'confirmed' && !isPast(b.starts_at) && settings && (
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {t('detail.tooLateToChange', { hours: settings.cancel_limit_hours })}
        </Typography>
      )}

      <SectionCard id="booking-history" title={t('history.title')}>
        <BookingHistory events={events} />
      </SectionCard>
    </Stack>
  );
}
