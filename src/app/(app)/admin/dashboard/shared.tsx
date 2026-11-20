import { getLocale, getTranslations } from 'next-intl/server';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { SectionCard } from '@/components/ui/section-card';
import { LinkButton } from '@/components/ui/links';
import { GoalMeter, type GoalView } from '@/components/dashboard/goal-meter';
import { MonthlyBars, type BarSeries } from '@/components/dashboard/monthly-bars';
import { PeriodBar } from '@/components/dashboard/parts';
import { formatDate, formatNumber, formatXAF } from '@/lib/format';
import { doualaToday, monthOf, parsePeriod, type Period } from '@/lib/dashboard/period';
import {
  GOAL_METRICS,
  GOAL_MODULE,
  MONEY_GOALS,
  goalActual,
  goalProgress,
  monthLong,
  monthShort,
  type GoalMetric,
  type MonthRow,
} from '@/lib/dashboard/metrics';
import { loadGoals } from '@/lib/dashboard/data';
import type { Locale } from '@/lib/types';

export type DashboardSearchParams = Promise<{ period?: string; from?: string; to?: string }>;

/** Période, traductions et formats communs à tous les onglets. */
export async function dashboardContext(searchParams: DashboardSearchParams) {
  const [sp, t, locale] = await Promise.all([searchParams, getTranslations('adminDashboard'), getLocale()]);
  const l = locale as Locale;
  // Les dates sont des jours locaux : on les affiche à midi pour éviter tout décalage.
  const day = (d: string) => formatDate(`${d}T12:00:00Z`, l);
  const period = parsePeriod(sp);
  return {
    t,
    l,
    period,
    money: (v: number) => formatXAF(v, l),
    count: (v: number) => formatNumber(v, l, 0),
    pct: (v: number | null) => (v === null ? '—' : `${formatNumber(v, l, 1)} %`),
    hours: (v: number | null) => (v === null ? '—' : t('units.hours', { n: formatNumber(v, l, 1) })),
    rangeText: t('period.range', { from: day(period.from), to: day(period.to), prevFrom: day(period.prevFrom), prevTo: day(period.prevTo) }),
  };
}

type Ctx = Awaited<ReturnType<typeof dashboardContext>>;

export function DashboardPeriodBar({ ctx, basePath, exportModule }: { ctx: Ctx; basePath: string; exportModule: string }) {
  const { t, period } = ctx;
  return (
    <PeriodBar
      basePath={basePath}
      period={period}
      exportHref={`/admin/dashboard/export/${exportModule}`}
      labels={{
        nav: t('period.nav'),
        presets: { '7d': t('period.7d'), '30d': t('period.30d'), '90d': t('period.90d'), '12m': t('period.12m') },
        from: t('period.from'),
        to: t('period.to'),
        apply: t('period.apply'),
        export: t('period.export'),
        range: ctx.rangeText,
      }}
    />
  );
}

/** Graphique des 12 derniers mois. */
export function MonthlyChart({ ctx, id, title, subtitle, monthly, series, money }: { ctx: Ctx; id: string; title: string; subtitle?: string; monthly: MonthRow[]; series: BarSeries[]; money?: boolean }) {
  return (
    <SectionCard id={id} title={title} subtitle={subtitle}>
      <MonthlyBars
        months={monthly.map((m) => monthShort(m.month, ctx.l))}
        monthsLong={monthly.map((m) => monthLong(m.month, ctx.l))}
        series={series}
        money={money}
        locale={ctx.l}
        tableLabel={ctx.t('chart.table')}
        totalLabel={ctx.t('chart.total')}
      />
    </SectionCard>
  );
}

/** Objectifs du mois en cours pour un onglet (ou tous pour la vue globale). */
export async function GoalsCard({ ctx, module, monthly }: { ctx: Ctx; module: 'global' | 'academy' | 'consulting'; monthly: MonthRow[] }) {
  const { t, l } = ctx;
  const today = doualaToday();
  const month = monthOf(today);
  const goals = await loadGoals(month);
  const row = monthly.find((m) => m.month === month);
  const [y, mo, d] = today.split('-').map(Number);
  const daysInMonth = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  const metrics = GOAL_METRICS.filter((m) => module === 'global' || GOAL_MODULE[m] === module);
  const views: GoalView[] = metrics.flatMap((metric: GoalMetric) => {
    const goal = goals.find((g) => g.metric === metric);
    if (!goal) return [];
    const actual = goalActual(metric, row);
    const target = Number(goal.target);
    const p = goalProgress(actual, target, d, daysInMonth);
    const fmt = MONEY_GOALS.includes(metric) ? ctx.money : ctx.count;
    return [{ label: t(`goals.metric.${metric}`), actual: fmt(actual), target: fmt(target), ...p, statusLabel: t(`goals.status.${p.status}`, { expected: p.expected }) }];
  });

  return (
    <SectionCard
      id={`goals-${module}`}
      title={t('goals.cardTitle', { month: monthLong(month, l) })}
      subtitle={t('goals.cardHint')}
      action={
        <LinkButton href="/admin/dashboard/goals" size="small">
          {views.length ? t('goals.edit') : t('goals.set')}
        </LinkButton>
      }
    >
      {views.length === 0 ? (
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {t('goals.none')}
        </Typography>
      ) : (
        <Stack spacing={4}>
          {views.map((g) => (
            <GoalMeter key={g.label} goal={g} expectedLabel={t('goals.expected', { expected: g.expected })} />
          ))}
        </Stack>
      )}
    </SectionCard>
  );
}

export type { Ctx as DashboardCtx, Period };
