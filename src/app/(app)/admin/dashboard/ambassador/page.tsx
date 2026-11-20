import type { Metadata } from 'next';
import Stack from '@mui/material/Stack';
import { requireAdmin } from '@/lib/auth';
import { PageHeader } from '@/components/page-header';
import { SectionCard } from '@/components/ui/section-card';
import { KpiGrid, KpiSection } from '@/components/dashboard/kpi';
import { Ranking } from '@/components/dashboard/parts';
import { loadModule, loadMonthly } from '@/lib/dashboard/data';
import { delta, n, rate, type RankedAmbassador } from '@/lib/dashboard/metrics';
import { DashboardPeriodBar, MonthlyChart, dashboardContext, type DashboardSearchParams } from '../shared';

export const metadata: Metadata = { title: 'Tableau de bord — Ambassador' };
export const dynamic = 'force-dynamic';

export default async function DashboardAmbassadorPage({ searchParams }: { searchParams: DashboardSearchParams }) {
  await requireAdmin();
  const ctx = await dashboardContext(searchParams);
  const { t, money, count, pct, hours } = ctx;
  const [{ cur, prev }, monthly] = await Promise.all([loadModule('ambassador', ctx.period), loadMonthly(12)]);
  const d = (k: string) => delta(n(cur, k), n(prev, k));
  const reviewHours = cur.review_hours === null || cur.review_hours === undefined ? null : Number(cur.review_hours);
  const top = (cur.top_ambassadors ?? []) as unknown as RankedAmbassador[];

  return (
    <>
      <PageHeader title={t('ambassador.title')} subtitle={t('ambassador.subtitle')} />
      <DashboardPeriodBar ctx={ctx} basePath="/admin/dashboard/ambassador" exportModule="ambassador" />

      <Stack spacing={8}>
        <KpiSection id="activity" title={t('sections.activity')}>
          <KpiGrid
            locale={ctx.l}
            deltaLabel={t('deltaLabel')}
            items={[
              { label: t('ambassador.active'), value: count(n(cur, 'active_now')), hint: t('ambassador.newHint', { n: count(n(cur, 'new')) }), href: '/admin/ambassador/ambassadors' },
              { label: t('ambassador.campaigns'), value: count(n(cur, 'campaigns_live')), hint: t('today'), href: '/admin/ambassador/campaigns' },
              { label: t('ambassador.submissions'), value: count(n(cur, 'submissions_new')), delta: d('submissions_new'), href: '/admin/ambassador/submissions' },
              { label: t('ambassador.pending'), value: count(n(cur, 'pending_now')), alert: n(cur, 'pending_now') > 0, hint: t('today'), href: '/admin/ambassador/queue' },
              { label: t('ambassador.validationRate'), value: pct(rate(n(cur, 'validated'), n(cur, 'validated') + n(cur, 'rejected'))), hint: t('ambassador.validationHint', { v: count(n(cur, 'validated')), r: count(n(cur, 'rejected')) }) },
              { label: t('ambassador.reviewTime'), value: hours(reviewHours) },
            ]}
          />
        </KpiSection>

        <KpiSection id="results" title={t('sections.results')}>
          <KpiGrid
            locale={ctx.l}
            deltaLabel={t('deltaLabel')}
            items={[
              { label: t('ambassador.referrals'), value: count(n(cur, 'referrals')), delta: d('referrals'), hint: t('ambassador.referralsHint', { pct: pct(rate(n(cur, 'referrals'), n(cur, 'enrollments'))) }) },
              { label: t('ambassador.referralCash'), value: money(n(cur, 'referral_cash')), delta: d('referral_cash') },
              { label: t('ambassador.earned'), value: money(n(cur, 'earned')), delta: d('earned'), upIsGood: false, hint: t('ambassador.earnedHint') },
              { label: t('ambassador.paid'), value: money(n(cur, 'payouts_paid') + n(cur, 'commissions_paid')), hint: t('ambassador.paidHint', { campaigns: money(n(cur, 'payouts_paid')), academy: money(n(cur, 'commissions_paid')) }), href: '/admin/ambassador/payouts' },
              { label: t('ambassador.due'), value: money(n(cur, 'payouts_due') + n(cur, 'commissions_due')), hint: t('ambassador.dueHint', { campaigns: money(n(cur, 'payouts_due')), academy: money(n(cur, 'commissions_due')) }) },
            ]}
          />
        </KpiSection>

        <MonthlyChart
          ctx={ctx}
          id="chart-ambassador"
          title={t('ambassador.chartTitle')}
          monthly={monthly}
          series={[{ key: 'validated', label: t('ambassador.validated'), values: monthly.map((m) => Number(m.submissions_validated)) }]}
        />

        <SectionCard id="top-ambassadors" title={t('ambassador.topTitle')}>
          <Ranking
            columns={[t('ambassador.ambassador'), t('ambassador.colValidated'), t('ambassador.colReferrals'), t('ambassador.colEarned')]}
            emptyLabel={t('empty')}
            rows={top.map((a) => ({
              key: a.user_id,
              cells: [`${a.code} · ${a.first_name} ${a.last_name}`.trim(), count(Number(a.validated)), count(Number(a.referrals)), money(Number(a.earned))],
            }))}
          />
        </SectionCard>
      </Stack>
    </>
  );
}
