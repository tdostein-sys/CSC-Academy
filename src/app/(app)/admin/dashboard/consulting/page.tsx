import type { Metadata } from 'next';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import { requireAdmin } from '@/lib/auth';
import { PageHeader } from '@/components/page-header';
import { SectionCard } from '@/components/ui/section-card';
import { KpiGrid, KpiSection } from '@/components/dashboard/kpi';
import { Ranking } from '@/components/dashboard/parts';
import { loadModule, loadMonthly } from '@/lib/dashboard/data';
import { delta, n, rate, type RankedOffer } from '@/lib/dashboard/metrics';
import { localized } from '@/lib/localized';
import { DashboardPeriodBar, GoalsCard, MonthlyChart, dashboardContext, type DashboardSearchParams } from '../shared';

export const metadata: Metadata = { title: 'Tableau de bord — Consulting' };
export const dynamic = 'force-dynamic';

export default async function DashboardConsultingPage({ searchParams }: { searchParams: DashboardSearchParams }) {
  await requireAdmin();
  const ctx = await dashboardContext(searchParams);
  const { t, money, count, pct, hours } = ctx;
  const [{ cur, prev }, monthly] = await Promise.all([loadModule('consulting', ctx.period), loadMonthly(12)]);
  const d = (k: string) => delta(n(cur, k), n(prev, k));
  const net = (f: typeof cur) => n(f, 'cash') - n(f, 'refunds');
  const basket = n(cur, 'payments_count') ? Math.round(n(cur, 'cash') / n(cur, 'payments_count')) : null;
  const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));
  const top = (cur.top_offers ?? []) as unknown as RankedOffer[];

  return (
    <>
      <PageHeader title={t('consulting.title')} subtitle={t('consulting.subtitle')} />
      <DashboardPeriodBar ctx={ctx} basePath="/admin/dashboard/consulting" exportModule="consulting" />

      <Stack spacing={8}>
        <KpiSection id="bookings" title={t('sections.bookings')}>
          <KpiGrid
            locale={ctx.l}
            deltaLabel={t('deltaLabel')}
            items={[
              { label: t('consulting.bookingsNew'), value: count(n(cur, 'bookings_new')), delta: d('bookings_new'), href: '/consulting/manage' },
              { label: t('consulting.done'), value: count(n(cur, 'done')), delta: d('done') },
              { label: t('consulting.confirmRate'), value: pct(rate(n(cur, 'cohort_paid_confirmed'), n(cur, 'cohort_paid'))), hint: t('consulting.confirmHint', { paid: count(n(cur, 'cohort_paid_confirmed')), total: count(n(cur, 'cohort_paid')) }) },
              { label: t('consulting.cancelRate'), value: pct(rate(n(cur, 'cohort_cancelled'), n(cur, 'cohort_all'))), hint: t('consulting.cancelHint', { n: count(n(cur, 'cancelled')) }) },
              { label: t('consulting.expired'), value: count(n(cur, 'expired')), delta: d('expired'), upIsGood: false },
              { label: t('consulting.leadTime'), value: hours(num(cur.lead_hours)), hint: t('consulting.leadHint') },
              { label: t('consulting.presence'), value: pct(rate(n(cur, 'video_joined'), n(cur, 'video_done'))), hint: t('consulting.presenceHint', { n: count(n(cur, 'video_done')) }) },
            ]}
          />
        </KpiSection>

        <KpiSection id="money" title={t('sections.money')}>
          <KpiGrid
            locale={ctx.l}
            deltaLabel={t('deltaLabel')}
            items={[
              { label: t('consulting.cashNet'), value: money(net(cur)), delta: delta(net(cur), net(prev)), hint: t('consulting.cashGross', { amount: money(n(cur, 'cash')) }), href: '/admin/consulting/payments' },
              { label: t('consulting.refunds'), value: money(n(cur, 'refunds')), delta: d('refunds'), upIsGood: false, hint: t('consulting.refundsCount', { n: count(n(cur, 'refunds_count')) }) },
              { label: t('consulting.basket'), value: basket === null ? '—' : money(basket) },
              { label: t('consulting.unpaid'), value: count(n(cur, 'unpaid_now')), hint: t('consulting.unpaidHint', { amount: money(n(cur, 'unpaid_amount_now')) }), href: '/consulting/manage' },
            ]}
          />
        </KpiSection>

        <Grid container spacing={6}>
          <Grid item xs={12} lg={7}>
            <MonthlyChart
              ctx={ctx}
              id="chart-consulting"
              title={t('consulting.chartTitle')}
              monthly={monthly}
              money
              series={[{ key: 'consulting', label: t('consulting.cashNet'), values: monthly.map((m) => Number(m.consulting_cash) - Number(m.consulting_refunds)) }]}
            />
          </Grid>
          <Grid item xs={12} lg={5}>
            <GoalsCard ctx={ctx} module="consulting" monthly={monthly} />
          </Grid>
        </Grid>

        <KpiSection id="advisors" title={t('sections.advisors')}>
          <KpiGrid
            locale={ctx.l}
            deltaLabel={t('deltaLabel')}
            items={[
              { label: t('consulting.occupancy'), value: pct(rate(n(cur, 'booked_minutes'), n(cur, 'open_minutes'))), hint: t('consulting.occupancyHint', { booked: hours(Math.round(n(cur, 'booked_minutes') / 6) / 10), open: hours(Math.round(n(cur, 'open_minutes') / 6) / 10) }), href: '/admin/consulting/availability' },
              { label: t('consulting.reportDelay'), value: hours(num(cur.report_hours)), hint: t('consulting.reportDelayHint', { n: count(n(cur, 'reports_published')) }) },
              { label: t('consulting.reportsLate'), value: count(n(cur, 'reports_late_now')), alert: n(cur, 'reports_late_now') > 0, hint: t('consulting.reportsLateHint'), href: '/consulting/manage' },
            ]}
          />
        </KpiSection>

        <KpiSection id="loyalty" title={t('sections.loyalty')}>
          <KpiGrid
            locale={ctx.l}
            deltaLabel={t('deltaLabel')}
            items={[
              { label: t('consulting.returning'), value: pct(rate(n(cur, 'clients_returning'), n(cur, 'clients_period'))), hint: t('consulting.returningHint', { n: count(n(cur, 'clients_returning')), total: count(n(cur, 'clients_period')) }) },
              { label: t('consulting.freeToPaid'), value: pct(rate(n(cur, 'free_to_paid'), n(cur, 'free_clients'))), hint: t('consulting.freeToPaidHint', { n: count(n(cur, 'free_to_paid')), total: count(n(cur, 'free_clients')) }) },
            ]}
          />
        </KpiSection>

        <SectionCard id="top-offers" title={t('consulting.topTitle')}>
          <Ranking
            columns={[t('consulting.offer'), t('consulting.colBookings'), t('consulting.colCash')]}
            emptyLabel={t('empty')}
            rows={top.map((o) => ({ key: o.id, href: `/admin/consulting/offers/${o.id}`, cells: [localized(ctx.l, o.title_fr, o.title_en), count(Number(o.bookings)), money(Number(o.cash))] }))}
          />
        </SectionCard>
      </Stack>
    </>
  );
}
