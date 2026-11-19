import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import Grid from '@mui/material/Grid';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/page-header';
import { StatCard } from '@/components/stat-card';
import { Notice } from '@/components/ui/notice';
import { LinkButton, TextLink } from '@/components/ui/links';
import { EmptyCard, TableCard, TableCell, TableRow } from '@/components/ui/table-card';
import { BookingStatusBadge } from '@/components/consulting/booking-status';
import { formatDate, formatXAF } from '@/lib/format';
import { localized } from '@/lib/localized';
import { num, olderThanHours, type BookingDetails } from '@/lib/consulting/types';
import type { Locale } from '@/lib/types';

export const metadata: Metadata = { title: 'CSC Consulting — administration' };
export const dynamic = 'force-dynamic';

/** Pilotage CSC Consulting : chiffres validés (paiements confirmés) et rendez-vous à venir. */
export default async function AdminConsultingOverview() {
  await requireAdmin();
  const [t, locale, supabase] = await Promise.all([getTranslations('adminConsulting'), getLocale(), createClient()]);
  const l = locale as Locale;
  const now = new Date();
  const in7days = new Date(now.getTime() + 7 * 24 * 3600_000).toISOString();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10);

  const count = (q: PromiseLike<{ count: number | null }>) => q.then((r) => r.count ?? 0);
  const [upcoming, pending, offers, advisors, monthPayments, nextRows, lastJob] = await Promise.all([
    count(supabase.from('consulting_bookings').select('id', { count: 'exact', head: true }).eq('status', 'confirmed').gte('starts_at', now.toISOString())),
    count(supabase.from('consulting_bookings').select('id', { count: 'exact', head: true }).eq('status', 'pending_payment')),
    count(supabase.from('consulting_offers').select('id', { count: 'exact', head: true }).eq('status', 'published')),
    count(supabase.from('consulting_advisors').select('user_id', { count: 'exact', head: true }).eq('active', true)),
    supabase.from('consulting_payments').select('amount').eq('status', 'confirmed').gte('paid_on', monthStart),
    supabase
      .from('consulting_booking_details')
      .select('id, starts_at, ends_at, status, mode, offer_title_fr, offer_title_en, client_first_name, client_last_name, advisor_name')
      .in('status', ['confirmed', 'pending_payment'])
      .gte('starts_at', now.toISOString())
      .lte('starts_at', in7days)
      .order('starts_at')
      .limit(20),
    supabase.from('job_runs').select('job, status, started_at, error').like('job', 'consulting.%').order('started_at', { ascending: false }).limit(1).maybeSingle(),
  ]);
  const revenue = (monthPayments.data ?? []).reduce((s, p) => s + num(p.amount), 0);
  const rows = (nextRows.data ?? []) as BookingDetails[];
  const job = lastJob.data as { job: string; status: string; started_at: string; error: string | null } | null;
  const jobStale = olderThanHours(job?.started_at, 26);

  return (
    <>
      <PageHeader title={t('overview.title')} subtitle={t('overview.subtitle')} actions={<LinkButton href="/admin/consulting/offers/new" variant="contained">{t('offers.new')}</LinkButton>} />
      {advisors === 0 && (
        <Box sx={{ mb: 6 }}>
          <Notice tone="warning" action={<LinkButton href="/admin/consulting/availability" size="small">{t('overview.setup')}</LinkButton>}>
            {t('overview.noAdvisor')}
          </Notice>
        </Box>
      )}
      {(jobStale || job?.status === 'error') && (
        <Box sx={{ mb: 6 }}>
          <Notice tone="warning">{job?.status === 'error' ? t('overview.jobError', { error: job.error ?? '' }) : t('overview.jobStale')}</Notice>
        </Box>
      )}
      <Grid container spacing={6}>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard label={t('overview.upcoming')} value={upcoming} icon="CalendarCheck" />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard label={t('overview.pendingPayment')} value={pending} icon="Clock" tone="warning" highlight={pending > 0} />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard label={t('overview.monthRevenue')} value={formatXAF(revenue, l)} icon="Wallet" tone="success" footer={t('overview.monthRevenueHint')} />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard label={t('overview.offers')} value={offers} icon="BriefcaseBusiness" tone="info" />
        </Grid>
      </Grid>
      <Box sx={{ mt: 10, mb: 3 }}>
        <Typography variant="h6" component="h2">
          {t('overview.next7days')}
        </Typography>
      </Box>
      {rows.length === 0 ? (
        <EmptyCard>{t('overview.noneSoon')}</EmptyCard>
      ) : (
        <TableCard head={[t('overview.date'), t('overview.client'), t('overview.offer'), t('overview.advisor'), t('overview.status')]}>
          {rows.map((r) => (
            <TableRow key={r.id} hover>
              <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDate(r.starts_at, l, true)}</TableCell>
              <TableCell>
                <TextLink href={`/consulting/manage/${r.id}`}>
                  {r.client_first_name} {r.client_last_name}
                </TextLink>
              </TableCell>
              <TableCell>{localized(l, r.offer_title_fr, r.offer_title_en)}</TableCell>
              <TableCell>{r.advisor_name}</TableCell>
              <TableCell>
                <BookingStatusBadge status={r.status} endsAt={r.ends_at} />
              </TableCell>
            </TableRow>
          ))}
        </TableCard>
      )}
    </>
  );
}
