import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { Period } from './period';
import type { Figures, MonthRow } from './metrics';

export type DashboardModule = 'global' | 'academy' | 'consulting' | 'ambassador' | 'contact';

/**
 * Totaux d'un module pour la période et pour la période précédente
 * (comparaison). Les fonctions SQL revérifient que l'appelant est admin.
 */
export async function loadModule(module: DashboardModule, period: Period): Promise<{ cur: Figures; prev: Figures }> {
  const supabase = await createClient();
  const fn = `dashboard_${module}`;
  const [cur, prev] = await Promise.all([
    supabase.rpc(fn, { p_from: period.from, p_to: period.to }),
    supabase.rpc(fn, { p_from: period.prevFrom, p_to: period.prevTo }),
  ]);
  if (cur.error) throw new Error(`[dashboard] ${fn}: ${cur.error.message}`);
  return { cur: (cur.data ?? {}) as Figures, prev: (prev.data ?? {}) as Figures };
}

/** Évolution des 12 derniers mois (graphiques, objectifs du mois). */
export async function loadMonthly(months = 12): Promise<MonthRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('dashboard_monthly', { p_months: months });
  if (error) throw new Error(`[dashboard] monthly: ${error.message}`);
  return (data ?? []) as MonthRow[];
}

export interface GoalRow {
  month: string;
  metric: string;
  target: number;
}

/** Objectifs d'un mois (AAAA-MM-01). */
export async function loadGoals(month: string): Promise<GoalRow[]> {
  const supabase = await createClient();
  const { data } = await supabase.from('dashboard_goals').select('month, metric, target').eq('month', month);
  return (data ?? []) as GoalRow[];
}
