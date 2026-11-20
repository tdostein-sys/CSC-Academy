/**
 * Périodes du tableau de bord, en dates du Cameroun (Africa/Douala, UTC+1).
 * Fonctions pures (testées) : la page lit `?period=30d` ou `?from=…&to=…`.
 */
export const PRESETS = ['7d', '30d', '90d', '12m'] as const;
export type Preset = (typeof PRESETS)[number];
export type PeriodKey = Preset | 'custom';

export interface Period {
  key: PeriodKey;
  /** Dates locales AAAA-MM-JJ, bornes incluses. */
  from: string;
  to: string;
  /** Période précédente de même durée, juste avant. */
  prevFrom: string;
  prevTo: string;
  days: number;
}

const DAY = 86_400_000;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
export const MAX_DAYS = 800;

/** Date du jour au Cameroun (AAAA-MM-JJ). */
export function doualaToday(now: number = Date.now()): string {
  return new Date(now + 3_600_000).toISOString().slice(0, 10);
}

const toMs = (d: string) => Date.parse(`${d}T00:00:00Z`);
const fromMs = (ms: number) => new Date(ms).toISOString().slice(0, 10);
export const addDays = (d: string, n: number) => fromMs(toMs(d) + n * DAY);
export const daysBetween = (from: string, to: string) => Math.round((toMs(to) - toMs(from)) / DAY) + 1;

function validDate(v: unknown): v is string {
  return typeof v === 'string' && ISO_DATE.test(v) && !Number.isNaN(toMs(v)) && fromMs(toMs(v)) === v;
}

const PRESET_DAYS: Record<Preset, number> = { '7d': 7, '30d': 30, '90d': 90, '12m': 365 };

/** Lit la période demandée ; 30 derniers jours par défaut ou si la saisie est invalide. */
export function parsePeriod(sp: { period?: string; from?: string; to?: string }, now: number = Date.now()): Period {
  const today = doualaToday(now);
  let key: PeriodKey = (PRESETS as readonly string[]).includes(sp.period ?? '') ? (sp.period as Preset) : '30d';
  let from: string;
  let to: string;
  if (validDate(sp.from) && validDate(sp.to) && sp.from <= sp.to && daysBetween(sp.from, sp.to) <= MAX_DAYS) {
    key = 'custom';
    from = sp.from;
    to = sp.to > today ? today : sp.to;
    if (from > to) from = to;
  } else {
    to = today;
    from = key === '12m' ? addDays(fromMs(Date.UTC(+today.slice(0, 4) - 1, +today.slice(5, 7) - 1, +today.slice(8, 10))), 1) : addDays(today, -(PRESET_DAYS[key as Preset] - 1));
  }
  const days = daysBetween(from, to);
  const prevTo = addDays(from, -1);
  return { key, from, to, prevFrom: addDays(prevTo, -(days - 1)), prevTo, days };
}

/** Paramètres d'URL qui reproduisent la période (liens entre onglets, export). */
export function periodQuery(p: Period): string {
  return p.key === 'custom' ? `from=${p.from}&to=${p.to}` : `period=${p.key}`;
}

/** Premier jour du mois (AAAA-MM-01) d'une date locale. */
export const monthOf = (d: string) => `${d.slice(0, 7)}-01`;
