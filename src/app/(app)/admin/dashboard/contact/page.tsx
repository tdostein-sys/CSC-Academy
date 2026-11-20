import type { Metadata } from 'next';
import Stack from '@mui/material/Stack';
import { requireAdmin } from '@/lib/auth';
import { PageHeader } from '@/components/page-header';
import { SectionCard } from '@/components/ui/section-card';
import { KpiGrid, KpiSection } from '@/components/dashboard/kpi';
import { Ranking } from '@/components/dashboard/parts';
import { loadModule, loadMonthly } from '@/lib/dashboard/data';
import { delta, n, rate } from '@/lib/dashboard/metrics';
import { DashboardPeriodBar, MonthlyChart, dashboardContext, type DashboardSearchParams } from '../shared';

export const metadata: Metadata = { title: 'Tableau de bord — Contact' };
export const dynamic = 'force-dynamic';

const SUBJECTS = ['payment', 'course', 'technical', 'other'] as const;

export default async function DashboardContactPage({ searchParams }: { searchParams: DashboardSearchParams }) {
  await requireAdmin();
  const ctx = await dashboardContext(searchParams);
  const { t, count, pct, hours } = ctx;
  const [{ cur, prev }, monthly] = await Promise.all([loadModule('contact', ctx.period), loadMonthly(12)]);
  const bySubject = (cur.by_subject ?? {}) as unknown as Record<string, number>;
  const received = n(cur, 'received');
  const responseHours = cur.response_hours === null || cur.response_hours === undefined ? null : Number(cur.response_hours);

  return (
    <>
      <PageHeader title={t('contact.title')} subtitle={t('contact.subtitle')} />
      <DashboardPeriodBar ctx={ctx} basePath="/admin/dashboard/contact" exportModule="contact" />

      <Stack spacing={8}>
        <KpiSection id="requests" title={t('sections.requests')}>
          <KpiGrid
            locale={ctx.l}
            deltaLabel={t('deltaLabel')}
            items={[
              { label: t('contact.received'), value: count(received), delta: delta(received, n(prev, 'received')), href: '/admin/contact' },
              { label: t('contact.newNow'), value: count(n(cur, 'new_now')), alert: n(cur, 'new_now') > 0, hint: t('contact.inProgress', { n: count(n(cur, 'in_progress_now')) }), href: '/admin/contact' },
              { label: t('contact.handled'), value: count(n(cur, 'handled')), delta: delta(n(cur, 'handled'), n(prev, 'handled')) },
              { label: t('contact.responseTime'), value: hours(responseHours) },
            ]}
          />
        </KpiSection>

        <SectionCard id="subjects" title={t('contact.bySubject')}>
          <Ranking
            columns={[t('contact.subject'), t('contact.count'), t('contact.share')]}
            emptyLabel={t('empty')}
            rows={SUBJECTS.filter((s) => Number(bySubject[s] ?? 0) > 0).map((s) => ({
              key: s,
              cells: [t(`contact.subjects.${s}`), count(Number(bySubject[s])), pct(rate(Number(bySubject[s]), received))],
            }))}
          />
        </SectionCard>

        <MonthlyChart
          ctx={ctx}
          id="chart-contact"
          title={t('contact.chartTitle')}
          monthly={monthly}
          series={[{ key: 'requests', label: t('contact.received'), values: monthly.map((m) => Number(m.contact_requests)) }]}
        />
      </Stack>
    </>
  );
}
