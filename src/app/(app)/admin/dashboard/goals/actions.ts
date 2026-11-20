'use server';

import { revalidatePath } from 'next/cache';
import { assertAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { formError, formSuccess, type FormState } from '@/lib/forms';
import { GOAL_METRICS, parseGoal } from '@/lib/dashboard/metrics';

const MONTH = /^\d{4}-\d{2}-01$/;

/**
 * Enregistre les objectifs d'un mois (un champ vide ou 0 supprime l'objectif).
 * Double contrôle : assertAdmin() ici, puis la fonction SQL (journalisée).
 */
export async function saveGoals(_prev: FormState, fd: FormData): Promise<FormState> {
  try {
    await assertAdmin();
  } catch {
    return formError('errors.forbidden');
  }
  const month = String(fd.get('month') ?? '');
  if (!MONTH.test(month)) return formError('errors.generic');

  const values: { metric: string; target: number }[] = [];
  for (const metric of GOAL_METRICS) {
    const v = parseGoal(String(fd.get(metric) ?? ''));
    if (v === null) return { status: 'error', message: 'errors.checkForm', fieldErrors: { [metric]: 'adminDashboard.goals.invalid' } };
    values.push({ metric, target: v });
  }

  const supabase = await createClient();
  const { data: existing } = await supabase.from('dashboard_goals').select('metric, target').eq('month', month);
  const before = new Map((existing ?? []).map((g) => [g.metric as string, Number(g.target)]));
  for (const { metric, target } of values) {
    // On n'écrit (et ne journalise) que ce qui change.
    if ((before.get(metric) ?? 0) === target) continue;
    const { error } = await supabase.rpc('dashboard_set_goal', { p_month: month, p_metric: metric, p_target: target });
    if (error) return formError(error.message.includes('forbidden') ? 'errors.forbidden' : 'errors.generic');
  }
  revalidatePath('/admin/dashboard', 'layout');
  return formSuccess('adminDashboard.goals.saved');
}
