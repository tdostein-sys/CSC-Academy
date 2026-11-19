import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { ArrowLeft, FileText, Trash2, Video } from 'lucide-react';
import { requireConsultingStaff } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { SectionCard } from '@/components/ui/section-card';
import { Notice } from '@/components/ui/notice';
import { LinkButton, TextLink } from '@/components/ui/links';
import { ActionForm } from '@/components/forms/action-form';
import { SelectField, SubmitButton, TextField } from '@/components/forms/fields';
import { StatusBadge } from '@/components/status-badge';
import { BookingStatusBadge } from '@/components/consulting/booking-status';
import { BookingFacts, BookingHistory, Facts, ReportContent } from '@/components/consulting/booking-parts';
import { payoutMethodLabel } from '@/lib/ambassador/methods';
import { PAYOUT_METHODS } from '@/lib/validation/ambassador';
import { formatDate, formatXAF } from '@/lib/format';
import { localized } from '@/lib/localized';
import { UUID, bookingRef, doualaDay, doualaTime, isPast, num, videoOpensAt, videoWindow, type BookingDetails, type BookingEvent, type Payment, type ReportView } from '@/lib/consulting/types';
import type { Locale } from '@/lib/types';
import { ReportForm } from './report-form';
import { addReportFile, adminCancelBooking, adminRescheduleBooking, publishReport, recordPayment, refundPayment, removeReportFile } from '../actions';

export const metadata: Metadata = { title: 'Consultation' };
export const dynamic = 'force-dynamic';

/** Fiche d'un rendez-vous pour le conseiller attribué et l'administrateur. */
export default async function ManageBookingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const user = await requireConsultingStaff(`/consulting/manage/${id}`);
  const [t, locale, supabase] = await Promise.all([getTranslations('consulting'), getLocale(), createClient()]);
  const l = locale as Locale;

  // La vue ne renvoie le rendez-vous qu'au conseiller attribué et à l'admin (ou au client).
  const { data } = await supabase.from('consulting_booking_details').select('*').eq('id', id).maybeSingle();
  const b = data as BookingDetails | null;
  if (!b || (b.client_id === user.id && !user.isAdmin && b.advisor_id !== user.id)) notFound();

  const [{ data: eventsData }, { data: paymentsData }] = await Promise.all([
    supabase.from('consulting_booking_events').select('id, booking_id, event, data, created_at').eq('booking_id', id).order('id'),
    user.isAdmin
      ? supabase.from('consulting_payments').select('*').eq('booking_id', id).order('created_at')
      : Promise.resolve({ data: [] as Payment[] }),
  ]);
  const events = (eventsData ?? []) as BookingEvent[];
  const payments = (paymentsData ?? []) as Payment[];

  // Compte rendu : lecture par la fonction dédiée (journalisée).
  let report: ReportView | null = null;
  if (b.report_status) {
    const { data: r } = await supabase.rpc('consulting_report_view', { p_booking: id });
    report = (r as ReportView | null) ?? null;
  }

  const price = num(b.price);
  const future = !isPast(b.starts_at);
  const active = b.status === 'pending_payment' || b.status === 'confirmed';
  const payable = price > 0 && (b.status === 'pending_payment' || (b.status === 'expired' && future));
  const refundable = payments.find((p) => p.status === 'confirmed' && b.status === 'cancelled');
  const win = videoWindow(b, true);
  const today = doualaDay(new Date().toISOString());

  return (
    <Stack spacing={6}>
      <Box>
        <LinkButton href="/consulting/manage" size="small" startIcon={<ArrowLeft aria-hidden size={16} />} sx={{ mb: 3 }}>
          {t('manage.title')}
        </LinkButton>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 3 }}>
          <Typography variant="h5" component="h1" sx={{ fontWeight: 700 }}>
            {b.client_first_name} {b.client_last_name} — {localized(l, b.offer_title_fr, b.offer_title_en)}
          </Typography>
          <BookingStatusBadge status={b.status} endsAt={b.ends_at} />
        </Box>
        <Typography variant="body2" sx={{ mt: 1, color: 'text.secondary' }}>
          {bookingRef(b.ref)} · {formatDate(b.starts_at, l, true)}
        </Typography>
      </Box>

      {b.status === 'confirmed' && b.mode === 'video' && win !== 'over' && (
        <SectionCard id="manage-video" title={t('detail.videoTitle')}>
          {win === 'open' ? (
            <LinkButton href={`/consulting/bookings/${b.id}/live`} variant="contained" startIcon={<Video aria-hidden size={18} />}>
              {t('manage.openVideo')}
            </LinkButton>
          ) : (
            <Typography>{t('detail.videoOpensAt', { time: formatDate(videoOpensAt(b, true), l, true) })}</Typography>
          )}
        </SectionCard>
      )}

      <SectionCard id="manage-info" title={t('detail.infoTitle')}>
        <BookingFacts b={b} staff />
      </SectionCard>

      {/* ------------------------------------------------------------------ */}
      {/* Administration : paiement, remboursement, report, annulation        */}
      {/* ------------------------------------------------------------------ */}
      {user.isAdmin && payable && (
        <SectionCard id="manage-payment" title={t('manage.paymentTitle')} subtitle={t('manage.paymentHint', { amount: formatXAF(price, l), ref: bookingRef(b.ref) })} highlight>
          {b.status === 'expired' && (
            <Box sx={{ mb: 4 }}>
              <Notice tone="warning">{t('manage.expiredPayable')}</Notice>
            </Box>
          )}
          <ActionForm action={recordPayment} confirm={t('manage.paymentConfirm', { amount: formatXAF(price, l) })} resetOnSuccess>
            <input type="hidden" name="booking_id" value={b.id} />
            <Box sx={{ display: 'grid', gap: 4, gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' } }}>
              <TextField name="amount" label={t('manage.amount')} defaultValue={String(price)} inputMode="numeric" required />
              <SelectField
                name="method"
                label={t('manage.method')}
                defaultValue="orange_money"
                options={PAYOUT_METHODS.map((m) => ({ value: m, label: payoutMethodLabel(m, l) }))}
              />
              <TextField name="reference" label={t('manage.reference')} hint={t('manage.referenceHint')} maxLength={120} />
              <TextField name="paid_on" type="date" label={t('manage.paidOn')} defaultValue={today} max={today} required />
              <Box sx={{ gridColumn: { md: '1 / -1' } }}>
                <Typography component="label" htmlFor="proof" variant="body2" sx={{ display: 'block', mb: 1, fontWeight: 600 }}>
                  {t('manage.proof')}
                </Typography>
                <input id="proof" name="proof" type="file" accept="application/pdf,image/png,image/jpeg,image/webp" />
              </Box>
            </Box>
            <Box sx={{ mt: 4 }}>
              <SubmitButton pending={false} fullWidth={false} size="medium">
                {t('manage.recordPayment')}
              </SubmitButton>
            </Box>
          </ActionForm>
        </SectionCard>
      )}

      {user.isAdmin && payments.length > 0 && (
        <SectionCard id="manage-payments" title={t('manage.paymentsTitle')}>
          <Stack spacing={4}>
            {payments.map((p) => (
              <Box key={p.id} sx={{ p: 3, border: 1, borderColor: 'divider', borderRadius: 1 }}>
                <Facts
                  items={[
                    [t('manage.amount'), formatXAF(p.amount, l)],
                    [t('manage.method'), payoutMethodLabel(p.method, l)],
                    [t('manage.reference'), p.reference || '—'],
                    [t('manage.paidOn'), formatDate(p.paid_on, l)],
                    [
                      t('bookings.status'),
                      <StatusBadge key="s" tone={p.status === 'confirmed' ? 'validated' : p.status === 'refunded' ? 'info' : 'pending'}>
                        {t(`manage.paymentStatus.${p.status}`)}
                      </StatusBadge>,
                    ],
                    ...(p.proof_path
                      ? ([[t('manage.proof'), <TextLink key="p" href={`/consulting/manage/proof/${p.id}`} target="_blank" rel="noopener">{t('manage.openProof')}</TextLink>]] as [string, React.ReactNode][])
                      : []),
                    ...(p.status === 'refunded'
                      ? ([[t('manage.refundReference'), `${p.refund_reference ?? ''} · ${formatDate(p.refunded_at, l, true)}`]] as [string, string][])
                      : []),
                  ]}
                />
              </Box>
            ))}
          </Stack>
        </SectionCard>
      )}

      {user.isAdmin && refundable && (
        <SectionCard id="manage-refund" title={t('manage.refundTitle')} subtitle={t('manage.refundHint')} highlight>
          <ActionForm action={refundPayment} confirm={t('manage.refundConfirm', { amount: formatXAF(refundable.amount, l) })}>
            <input type="hidden" name="payment_id" value={refundable.id} />
            <input type="hidden" name="booking_id" value={b.id} />
            <Box sx={{ display: 'grid', gap: 4, gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' } }}>
              <TextField name="reference" label={t('manage.refundReference')} required maxLength={120} />
              <TextField name="reason" label={t('manage.reason')} maxLength={500} />
            </Box>
            <Box sx={{ mt: 4 }}>
              <SubmitButton pending={false} fullWidth={false} size="medium">
                {t('manage.recordRefund')}
              </SubmitButton>
            </Box>
          </ActionForm>
        </SectionCard>
      )}

      {user.isAdmin && active && future && (
        <SectionCard id="manage-change" title={t('manage.changeTitle')}>
          <Stack spacing={6}>
            <ActionForm action={adminRescheduleBooking} confirm={t('manage.rescheduleConfirm')}>
              <input type="hidden" name="id" value={b.id} />
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3, alignItems: 'flex-start' }}>
                <Box sx={{ width: 260 }}>
                  <TextField
                    name="starts_at"
                    type="datetime-local"
                    label={t('manage.newDate')}
                    hint={t('picker.timezone')}
                    defaultValue={`${doualaDay(b.starts_at)}T${doualaTime(b.starts_at)}`}
                    required
                  />
                </Box>
                <SubmitButton pending={false} fullWidth={false} variant="outlined" size="large">
                  {t('manage.reschedule')}
                </SubmitButton>
              </Box>
            </ActionForm>
            <ActionForm action={adminCancelBooking} confirm={t('manage.cancelConfirm')} danger>
              <input type="hidden" name="id" value={b.id} />
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3, alignItems: 'flex-start' }}>
                <Box sx={{ flex: '1 1 260px', maxWidth: 480 }}>
                  <TextField name="reason" label={t('manage.cancelReason')} required maxLength={500} />
                </Box>
                <SubmitButton pending={false} fullWidth={false} color="error" variant="outlined" size="large">
                  {t('manage.cancel')}
                </SubmitButton>
              </Box>
            </ActionForm>
          </Stack>
        </SectionCard>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Compte rendu                                                         */}
      {/* ------------------------------------------------------------------ */}
      <SectionCard
        id="manage-report"
        title={t('report.title')}
        action={report ? <StatusBadge tone={report.status === 'published' ? 'validated' : 'draft'}>{t(`report.status.${report.status}`)}</StatusBadge> : undefined}
        subtitle={report?.status === 'published' ? t('report.lockedHint') : t('report.draftHint')}
      >
        {report?.status === 'published' ? (
          <ReportContent report={report} fileHref={(fid) => `/consulting/files/${fid}`} />
        ) : b.status !== 'confirmed' ? (
          <Typography sx={{ color: 'text.secondary' }}>{t('report.onlyConfirmed')}</Typography>
        ) : (
          <Stack spacing={6}>
            <ReportForm
              bookingId={b.id}
              draft={{
                consultation_date: report?.consultation_date ?? doualaDay(b.starts_at),
                subject: report?.subject ?? localized(l, b.offer_title_fr, b.offer_title_en),
                summary: report?.summary ?? '',
                recommendations: report?.recommendations ?? '',
                observations: report?.observations ?? '',
              }}
            />
            {report && (
              <>
                <Box>
                  <Typography variant="subtitle2" component="h3" sx={{ fontWeight: 700, mb: 2 }}>
                    {t('report.files')}
                  </Typography>
                  {report.files.length > 0 && (
                    <Box component="ul" sx={{ m: 0, mb: 3, pl: 0, listStyle: 'none', display: 'grid', gap: 1.5 }}>
                      {report.files.map((f) => (
                        <Box component="li" key={f.id} sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                          <FileText aria-hidden size={16} />
                          <TextLink href={`/consulting/files/${f.id}`} target="_blank" rel="noopener">
                            {f.title}
                          </TextLink>
                          <ActionForm action={removeReportFile} confirm={t('report.removeFileConfirm')} danger>
                            <input type="hidden" name="id" value={f.id} />
                            <input type="hidden" name="booking_id" value={b.id} />
                            <SubmitButton pending={false} fullWidth={false} size="small" variant="text" color="error" startIcon={<Trash2 aria-hidden size={14} />}>
                              {t('report.removeFile')}
                            </SubmitButton>
                          </ActionForm>
                        </Box>
                      ))}
                    </Box>
                  )}
                  <ActionForm action={addReportFile} resetOnSuccess>
                    <input type="hidden" name="booking_id" value={b.id} />
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3, alignItems: 'center' }}>
                      <Box sx={{ flex: '1 1 220px', maxWidth: 360 }}>
                        <TextField name="title" label={t('report.fileTitle')} required maxLength={120} size="small" />
                      </Box>
                      <input name="file" type="file" accept="application/pdf,image/png,image/jpeg,image/webp" aria-label={t('report.fileInput')} />
                      <SubmitButton pending={false} fullWidth={false} size="small" variant="outlined">
                        {t('report.addFile')}
                      </SubmitButton>
                    </Box>
                  </ActionForm>
                </Box>
                <ActionForm action={publishReport} confirm={t('report.publishConfirm')}>
                  <input type="hidden" name="booking_id" value={b.id} />
                  <SubmitButton pending={false} fullWidth={false} size="medium">
                    {t('report.publish')}
                  </SubmitButton>
                </ActionForm>
              </>
            )}
          </Stack>
        )}
      </SectionCard>

      <SectionCard id="manage-history" title={t('history.title')}>
        <BookingHistory events={events} />
      </SectionCard>
    </Stack>
  );
}
