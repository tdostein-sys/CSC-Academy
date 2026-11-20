import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { requireAdmin } from '@/lib/auth';
import { PageHeader } from '@/components/page-header';
import { SectionCard } from '@/components/ui/section-card';
import { FilterPills } from '@/components/ui/filter-pills';
import { ActionForm } from '@/components/forms/action-form';
import { SubmitButton, TextField } from '@/components/forms/fields';
import { loadGoals } from '@/lib/dashboard/data';
import { doualaToday, monthOf } from '@/lib/dashboard/period';
import { GOAL_METRICS, MONEY_GOALS, monthLong } from '@/lib/dashboard/metrics';
import type { Locale } from '@/lib/types';
import { saveGoals } from './actions';

export const metadata: Metadata = { title: 'Objectifs — Tableau de bord' };
export const dynamic = 'force-dynamic';

/** Mois proposés : le mois précédent, le mois en cours et les 3 suivants. */
function monthChoices(today: string): string[] {
  const [y, m] = today.split('-').map(Number);
  return [-1, 0, 1, 2, 3].map((k) => {
    const d = new Date(Date.UTC(y, m - 1 + k, 1));
    return d.toISOString().slice(0, 10);
  });
}

export default async function DashboardGoalsPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  await requireAdmin();
  const [sp, t, locale] = await Promise.all([searchParams, getTranslations('adminDashboard.goals'), getLocale()]);
  const l = locale as Locale;
  const current = monthOf(doualaToday());
  const choices = monthChoices(doualaToday());
  const month = choices.includes(sp.month ?? '') ? (sp.month as string) : current;
  const goals = await loadGoals(month);
  const valueOf = (metric: string) => {
    const g = goals.find((x) => x.metric === metric);
    return g ? String(g.target) : '';
  };

  return (
    <>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      <Stack spacing={6}>
        <FilterPills
          label={t('monthNav')}
          items={choices.map((m) => ({ key: m, href: `/admin/dashboard/goals?month=${m}`, label: monthLong(m, l), active: m === month }))}
        />
        <SectionCard id="goals-form" title={t('formTitle', { month: monthLong(month, l) })} subtitle={t('formHint')}>
          <ActionForm action={saveGoals} key={month}>
            <input type="hidden" name="month" value={month} />
            <Box sx={{ display: 'grid', gap: 4, gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' } }}>
              {GOAL_METRICS.map((metric) => (
                <TextField
                  key={metric}
                  name={metric}
                  label={t(`metric.${metric}`)}
                  hint={MONEY_GOALS.includes(metric) ? t('hintMoney') : t('hintCount')}
                  defaultValue={valueOf(metric)}
                  inputMode="numeric"
                  maxLength={15}
                  placeholder={t('placeholder')}
                />
              ))}
            </Box>
            <Box sx={{ mt: 5 }}>
              <SubmitButton pending={false} fullWidth={false}>
                {t('save')}
              </SubmitButton>
            </Box>
          </ActionForm>
          <Typography variant="caption" component="p" sx={{ color: 'text.secondary', mt: 4 }}>
            {t('definitions')}
          </Typography>
        </SectionCard>
      </Stack>
    </>
  );
}
