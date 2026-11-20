/**
 * Indicateurs du tableau de bord : types des totaux renvoyés par la base
 * (fonctions `dashboard_*`) et petits calculs d'affichage (taux, évolution,
 * objectifs). Les montants sont des FCFA entiers ; les taux sont calculés
 * ici, à partir d'un numérateur et d'un dénominateur entiers.
 */

export type Figures = Record<string, number | null>;

export interface RankedCourse {
  id: string;
  title_fr: string;
  title_en: string;
  enrollments: number;
  cash: number;
}
export interface RankedOffer {
  id: string;
  title_fr: string;
  title_en: string;
  bookings: number;
  cash: number;
}
export interface RankedAmbassador {
  user_id: string;
  code: string;
  first_name: string;
  last_name: string;
  validated: number;
  earned: number;
  referrals: number;
}

export interface MonthRow {
  month: string;
  academy_cash: number;
  consulting_cash: number;
  consulting_refunds: number;
  new_users: number;
  academy_enrollments: number;
  consulting_done: number;
  submissions_validated: number;
  contact_requests: number;
}

/** Valeur numérique d'un total (null ou absent → 0). */
export const n = (f: Figures | null | undefined, key: string): number => Number(f?.[key] ?? 0) || 0;

/** Taux en % (entier ou 1 décimale) ; null si le dénominateur est nul. */
export function rate(num: number, den: number): number | null {
  if (!den) return null;
  return Math.round((num / den) * 1000) / 10;
}

/**
 * Évolution par rapport à la période précédente, en %.
 * null si la période précédente est à 0 (évolution non significative).
 */
export function delta(current: number, previous: number): number | null {
  if (!previous) return null;
  return Math.round(((current - previous) / Math.abs(previous)) * 1000) / 10;
}

/**
 * Indicateurs « photo du jour » : ils décrivent la situation actuelle, quelle
 * que soit la période choisie (pas de comparaison possible).
 */
export const SNAPSHOT_KEYS = new Set([
  'receivable_academy', 'receivable_consulting', 'commissions_due', 'payouts_due',
  'clients_total', 'clients_multi', 'deliveries_failed', 'deliveries_stuck', 'job_errors_24h',
  'contact_new', 'academy_pending', 'academy_overdue', 'consulting_unpaid', 'submissions_pending',
  'active_now', 'pending_now', 'remaining_now', 'due_to_date', 'paid_to_date', 'overdue_enrollments',
  'overdue_amount', 'blocked_now', 'unpaid_now', 'unpaid_amount_now', 'reports_late_now',
  'free_clients', 'free_to_paid', 'campaigns_live', 'new_now', 'in_progress_now',
]);

// -----------------------------------------------------------------------------
// Objectifs mensuels
// -----------------------------------------------------------------------------
export const GOAL_METRICS = ['revenue_total', 'revenue_academy', 'revenue_consulting', 'new_users', 'academy_enrollments', 'consulting_done'] as const;
export type GoalMetric = (typeof GOAL_METRICS)[number];
export const MONEY_GOALS: readonly GoalMetric[] = ['revenue_total', 'revenue_academy', 'revenue_consulting'];

/** Module auquel se rattache chaque objectif (affichage par onglet). */
export const GOAL_MODULE: Record<GoalMetric, 'global' | 'academy' | 'consulting'> = {
  revenue_total: 'global',
  new_users: 'global',
  revenue_academy: 'academy',
  academy_enrollments: 'academy',
  revenue_consulting: 'consulting',
  consulting_done: 'consulting',
};

/** Réalisé du mois pour un objectif, depuis la ligne mensuelle. */
export function goalActual(metric: GoalMetric, m: MonthRow | undefined): number {
  if (!m) return 0;
  const consultingNet = Number(m.consulting_cash) - Number(m.consulting_refunds);
  switch (metric) {
    case 'revenue_total':
      return Number(m.academy_cash) + consultingNet;
    case 'revenue_academy':
      return Number(m.academy_cash);
    case 'revenue_consulting':
      return consultingNet;
    case 'new_users':
      return Number(m.new_users);
    case 'academy_enrollments':
      return Number(m.academy_enrollments);
    case 'consulting_done':
      return Number(m.consulting_done);
  }
}

/**
 * Avancement d'un objectif et rythme attendu : à mi-mois, la moitié de
 * l'objectif « devrait » être atteinte. `dayOfMonth` / `daysInMonth` locaux.
 */
export function goalProgress(actual: number, target: number, dayOfMonth: number, daysInMonth: number) {
  const percent = target > 0 ? Math.round((actual / target) * 100) : 0;
  const expected = Math.round((dayOfMonth / daysInMonth) * 100);
  const status: 'reached' | 'on_track' | 'behind' = percent >= 100 ? 'reached' : percent >= expected ? 'on_track' : 'behind';
  return { percent, expected, status };
}

/** Saisie d'un objectif : entier ≥ 0 (espaces acceptés) ; null si invalide. */
export function parseGoal(input: string): number | null {
  const v = input.replace(/[\s  ]/g, '');
  if (v === '') return 0;
  if (!/^\d{1,12}$/.test(v)) return null;
  return Number(v);
}

/** Libellé court d'un mois (« nov. 26 ») pour les axes. */
export function monthShort(month: string, locale: 'fr' | 'en'): string {
  const d = new Date(`${month.slice(0, 7)}-15T12:00:00Z`);
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'fr-FR', { month: 'short', year: '2-digit', timeZone: 'UTC' }).format(d);
}

/** Libellé long d'un mois (« novembre 2026 »). */
export function monthLong(month: string, locale: 'fr' | 'en'): string {
  const d = new Date(`${month.slice(0, 7)}-15T12:00:00Z`);
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(d);
}

/** Montant compact pour les axes : 1 250 000 → « 1,3 M ». */
export function compactNumber(v: number, locale: 'fr' | 'en'): string {
  return new Intl.NumberFormat(locale === 'en' ? 'en-GB' : 'fr-FR', { notation: 'compact', maximumFractionDigits: 1 })
    .format(v)
    .replace(/ /g, ' ');
}
