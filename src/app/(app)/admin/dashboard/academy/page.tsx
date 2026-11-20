import type { Metadata } from 'next';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import { requireAdmin } from '@/lib/auth';
import { PageHeader } from '@/components/page-header';
import { SectionCard } from '@/components/ui/section-card';
import { KpiGrid, KpiSection } from '@/components/dashboard/kpi';
import { Ranking } from '@/components/dashboard/parts';
import { loadModule, loadMonthly } from '@/lib/dashboard/data';
import { delta, n, rate, type RankedCourse } from '@/lib/dashboard/metrics';
import { localized } from '@/lib/localized';
import { DashboardPeriodBar, GoalsCard, MonthlyChart, dashboardContext, type DashboardSearchParams } from '../shared';

export const metadata: Metadata = { title: 'Tableau de bord — Academy' };
export const dynamic = 'force-dynamic';

export default async function DashboardAcademyPage({ searchParams }: { searchParams: DashboardSearchParams }) {
  await requireAdmin();
  const ctx = await dashboardContext(searchParams);
  const { t, money, count, pct } = ctx;
  const [{ cur, prev }, monthly] = await Promise.all([loadModule('academy', ctx.period), loadMonthly(12)]);
  const d = (k: string) => delta(n(cur, k), n(prev, k));
  const top = (cur.top_courses ?? []) as unknown as RankedCourse[];
  const avg = cur.avg_percent;

  return (
    <>
      <PageHeader title={t('academy.title')} subtitle={t('academy.subtitle')} />
      <DashboardPeriodBar ctx={ctx} basePath="/admin/dashboard/academy" exportModule="academy" />

      <Stack spacing={8}>
        <KpiSection id="enrollments" title={t('sections.enrollments')}>
          <KpiGrid
            locale={ctx.l}
            deltaLabel={t('deltaLabel')}
            items={[
              { label: t('academy.enrollmentsNew'), value: count(n(cur, 'enrollments_new')), delta: d('enrollments_new'), href: '/admin/academy/enrollments' },
              { label: t('academy.activated'), value: count(n(cur, 'enrollments_activated')), delta: d('enrollments_activated') },
              { label: t('academy.conversion'), value: pct(rate(n(cur, 'cohort_activated'), n(cur, 'cohort_created'))), hint: t('academy.conversionHint', { paid: count(n(cur, 'cohort_activated')), total: count(n(cur, 'cohort_created')) }) },
              { label: t('academy.fillRate'), value: pct(rate(n(cur, 'seats_taken'), n(cur, 'seats'))), hint: t('academy.fillHint', { taken: count(n(cur, 'seats_taken')), seats: count(n(cur, 'seats')) }) },
              { label: t('academy.activeNow'), value: count(n(cur, 'active_now')), hint: t('today'), href: '/admin/academy/enrollments?status=active' },
              { label: t('academy.pendingNow'), value: count(n(cur, 'pending_now')), hint: t('today'), href: '/admin/academy/enrollments?status=pending' },
              { label: t('academy.cancelled'), value: count(n(cur, 'enrollments_cancelled')), delta: d('enrollments_cancelled'), upIsGood: false },
            ]}
          />
        </KpiSection>

        <KpiSection id="payments" title={t('sections.payments')}>
          <KpiGrid
            locale={ctx.l}
            deltaLabel={t('deltaLabel')}
            items={[
              { label: t('academy.cash'), value: money(n(cur, 'cash')), delta: d('cash'), hint: t('academy.paymentsCount', { n: count(n(cur, 'payments_count')) }), href: '/admin/academy/payments' },
              { label: t('academy.recovery'), value: pct(rate(n(cur, 'paid_to_date'), n(cur, 'due_to_date'))), hint: t('academy.recoveryHint', { paid: money(n(cur, 'paid_to_date')), due: money(n(cur, 'due_to_date')) }) },
              { label: t('academy.remaining'), value: money(n(cur, 'remaining_now')), hint: t('today') },
              { label: t('academy.overdue'), value: count(n(cur, 'overdue_enrollments')), alert: n(cur, 'overdue_enrollments') > 0, hint: t('academy.overdueHint', { amount: money(n(cur, 'overdue_amount')) }), href: '/admin/academy/enrollments?status=overdue' },
              { label: t('academy.blocked'), value: count(n(cur, 'blocked_now')), alert: n(cur, 'blocked_now') > 0, hint: t('today'), href: '/admin/academy/enrollments?status=blocked' },
              { label: t('academy.commissionsPaid'), value: money(n(cur, 'commissions_paid')), delta: d('commissions_paid'), upIsGood: false },
              { label: t('academy.commissionsDue'), value: money(n(cur, 'commissions_due')), hint: t('today'), href: '/admin/academy/commissions' },
            ]}
          />
        </KpiSection>

        <Grid container spacing={6}>
          <Grid item xs={12} lg={7}>
            <MonthlyChart
              ctx={ctx}
              id="chart-academy"
              title={t('academy.chartTitle')}
              monthly={monthly}
              money
              series={[{ key: 'academy', label: t('academy.cash'), values: monthly.map((m) => Number(m.academy_cash)) }]}
            />
          </Grid>
          <Grid item xs={12} lg={5}>
            <GoalsCard ctx={ctx} module="academy" monthly={monthly} />
          </Grid>
        </Grid>

        <KpiSection id="learning" title={t('sections.learning')}>
          <KpiGrid
            locale={ctx.l}
            deltaLabel={t('deltaLabel')}
            items={[
              { label: t('academy.attendance'), value: pct(rate(n(cur, 'attendance_present'), n(cur, 'attendance_expected'))), hint: t('academy.attendanceHint', { n: count(n(cur, 'meetings_held')) }) },
              { label: t('academy.passRate'), value: pct(rate(n(cur, 'attempts_passed'), n(cur, 'attempts'))), hint: t('academy.passHint', { n: count(n(cur, 'attempts')) }) },
              { label: t('academy.avgScore'), value: avg === null || avg === undefined ? '—' : pct(Number(avg)) },
              { label: t('academy.certificates'), value: count(n(cur, 'certificates')), delta: d('certificates'), href: '/admin/academy/certificates' },
              { label: t('academy.replays'), value: count(n(cur, 'replay_views')), delta: d('replay_views') },
            ]}
          />
        </KpiSection>

        <SectionCard id="top-courses" title={t('academy.topTitle')}>
          <Ranking
            columns={[t('academy.course'), t('academy.colEnrollments'), t('academy.colCash')]}
            emptyLabel={t('empty')}
            rows={top.map((c) => ({ key: c.id, href: `/admin/academy/courses/${c.id}`, cells: [localized(ctx.l, c.title_fr, c.title_en), count(Number(c.enrollments)), money(Number(c.cash))] }))}
          />
        </SectionCard>
      </Stack>
    </>
  );
}
