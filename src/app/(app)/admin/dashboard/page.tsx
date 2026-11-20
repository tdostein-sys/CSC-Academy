import type { Metadata } from 'next';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import { requireAdmin } from '@/lib/auth';
import { PageHeader } from '@/components/page-header';
import { SectionCard } from '@/components/ui/section-card';
import { KpiGrid, KpiSection } from '@/components/dashboard/kpi';
import { AlertList, type AlertItem } from '@/components/dashboard/parts';
import { loadModule, loadMonthly } from '@/lib/dashboard/data';
import { delta, n, rate } from '@/lib/dashboard/metrics';
import { olderThanHours } from '@/lib/consulting/types';
import { DashboardPeriodBar, GoalsCard, MonthlyChart, dashboardContext, type DashboardSearchParams } from './shared';

export const metadata: Metadata = { title: 'Tableau de bord' };
export const dynamic = 'force-dynamic';

/** Vue globale : tous les modules cumulés. */
export default async function DashboardGlobalPage({ searchParams }: { searchParams: DashboardSearchParams }) {
  await requireAdmin();
  const ctx = await dashboardContext(searchParams);
  const { t, money, count, pct } = ctx;
  const [{ cur, prev }, monthly] = await Promise.all([loadModule('global', ctx.period), loadMonthly(12)]);

  const consultingNet = (f: typeof cur) => n(f, 'consulting_cash') - n(f, 'consulting_refunds');
  const total = (f: typeof cur) => n(f, 'academy_cash') + consultingNet(f);
  const share = (part: number) => pct(rate(part, total(cur)));

  // Tâches automatiques : alerte si aucune exécution réussie depuis 26 h (quotidienne) / 1 h (15 min).
  const lastOk = (cur.job_last_ok ?? {}) as unknown as Record<string, string>;
  const stale = (job: string, hours: number) => olderThanHours(lastOk[job], hours);

  const alerts: AlertItem[] = [];
  const push = (v: number, key: string, href: string) => v > 0 && alerts.push({ label: t(`alerts.${key}`, { n: v }), href });
  push(n(cur, 'academy_pending'), 'academyPending', '/admin/academy/enrollments?status=pending');
  push(n(cur, 'academy_overdue'), 'academyOverdue', '/admin/academy/enrollments?status=overdue');
  push(n(cur, 'consulting_unpaid'), 'consultingUnpaid', '/consulting/manage');
  push(n(cur, 'submissions_pending'), 'submissionsPending', '/admin/ambassador/queue');
  push(n(cur, 'contact_new'), 'contactNew', '/admin/contact');
  push(n(cur, 'deliveries_failed'), 'deliveriesFailed', '/admin/deliveries');
  push(n(cur, 'deliveries_stuck'), 'deliveriesStuck', '/admin/deliveries');
  push(n(cur, 'job_errors_24h'), 'jobErrors', '/admin/consulting');
  if (stale('consulting.daily', 26)) alerts.push({ label: t('alerts.dailyJobLate'), href: '/admin/consulting' });
  if (stale('consulting.frequent', 1)) alerts.push({ label: t('alerts.frequentJobLate'), href: '/admin/consulting' });

  return (
    <>
      <PageHeader title={t('global.title')} subtitle={t('global.subtitle')} />
      <DashboardPeriodBar ctx={ctx} basePath="/admin/dashboard" exportModule="global" />

      <Stack spacing={8}>
        <KpiSection id="money" title={t('sections.money')} subtitle={t('global.moneyHint')}>
          <KpiGrid
            locale={ctx.l}
            deltaLabel={t('deltaLabel')}
            items={[
              { label: t('global.cashTotal'), value: money(total(cur)), delta: delta(total(cur), total(prev)) },
              { label: t('global.cashAcademy'), value: money(n(cur, 'academy_cash')), delta: delta(n(cur, 'academy_cash'), n(prev, 'academy_cash')), hint: t('global.share', { pct: share(n(cur, 'academy_cash')) }), href: '/admin/dashboard/academy' },
              { label: t('global.cashConsulting'), value: money(consultingNet(cur)), delta: delta(consultingNet(cur), consultingNet(prev)), hint: t('global.consultingRefunds', { amount: money(n(cur, 'consulting_refunds')) }), href: '/admin/dashboard/consulting' },
              { label: t('global.commissionsPaid'), value: money(n(cur, 'commissions_paid')), delta: delta(n(cur, 'commissions_paid'), n(prev, 'commissions_paid')), upIsGood: false, href: '/admin/dashboard/ambassador' },
              { label: t('global.receivable'), value: money(n(cur, 'receivable_academy') + n(cur, 'receivable_consulting')), hint: t('today') },
              { label: t('global.commissionsDue'), value: money(n(cur, 'commissions_due')), hint: t('today') },
            ]}
          />
        </KpiSection>

        <Grid container spacing={6}>
          <Grid item xs={12} lg={8}>
            <MonthlyChart
              ctx={ctx}
              id="chart-cash"
              title={t('global.chartTitle')}
              subtitle={t('global.chartHint')}
              monthly={monthly}
              money
              series={[
                { key: 'academy', label: 'Academy', values: monthly.map((m) => Number(m.academy_cash)) },
                { key: 'consulting', label: 'Consulting', values: monthly.map((m) => Number(m.consulting_cash) - Number(m.consulting_refunds)) },
              ]}
            />
          </Grid>
          <Grid item xs={12} lg={4}>
            <Stack spacing={6}>
              <SectionCard id="alerts" title={t('sections.alerts')}>
                <AlertList items={alerts} emptyLabel={t('alerts.none')} />
              </SectionCard>
            </Stack>
          </Grid>
        </Grid>

        <GoalsCard ctx={ctx} module="global" monthly={monthly} />

        <KpiSection id="clients" title={t('sections.clients')}>
          <KpiGrid
            locale={ctx.l}
            deltaLabel={t('deltaLabel')}
            items={[
              { label: t('global.newUsers'), value: count(n(cur, 'new_users')), delta: delta(n(cur, 'new_users'), n(prev, 'new_users')), href: '/admin/users' },
              { label: t('global.payingClients'), value: count(n(cur, 'paying_clients')), delta: delta(n(cur, 'paying_clients'), n(prev, 'paying_clients')) },
              { label: t('global.conversion'), value: pct(rate(n(cur, 'cohort_paying'), n(cur, 'cohort_users'))), hint: t('global.conversionHint', { paying: count(n(cur, 'cohort_paying')), total: count(n(cur, 'cohort_users')) }) },
              { label: t('global.referralShare'), value: pct(rate(n(cur, 'referred_enrollments'), n(cur, 'enrollments'))), hint: t('global.referralHint', { n: count(n(cur, 'referred_enrollments')), total: count(n(cur, 'enrollments')) }) },
              { label: t('global.multiModule'), value: count(n(cur, 'clients_multi')), hint: t('global.multiHint', { total: count(n(cur, 'clients_total')) }) },
            ]}
          />
        </KpiSection>

        <KpiSection id="health" title={t('sections.health')}>
          <KpiGrid
            locale={ctx.l}
            deltaLabel={t('deltaLabel')}
            items={[
              { label: t('global.deliveriesFailed'), value: count(n(cur, 'deliveries_failed')), alert: n(cur, 'deliveries_failed') > 0, href: '/admin/deliveries' },
              { label: t('global.jobErrors'), value: count(n(cur, 'job_errors_24h')), alert: n(cur, 'job_errors_24h') > 0, hint: t('global.last24h') },
              { label: t('global.contactNew'), value: count(n(cur, 'contact_new')), alert: n(cur, 'contact_new') > 0, href: '/admin/contact' },
            ]}
          />
        </KpiSection>
      </Stack>
    </>
  );
}
