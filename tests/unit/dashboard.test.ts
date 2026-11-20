import { describe, expect, it } from 'vitest';
import { addDays, daysBetween, doualaToday, parsePeriod, periodQuery } from '@/lib/dashboard/period';
import { delta, goalActual, goalProgress, n, parseGoal, rate, type MonthRow } from '@/lib/dashboard/metrics';

const NOW = Date.parse('2026-11-20T12:00:00Z');

describe('Tableau de bord — périodes (heure du Cameroun)', () => {
  it('date du jour locale (UTC+1)', () => {
    expect(doualaToday(Date.parse('2026-11-20T23:30:00Z'))).toBe('2026-11-21');
    expect(doualaToday(NOW)).toBe('2026-11-20');
  });

  it('30 jours par défaut, période précédente de même durée juste avant', () => {
    const p = parsePeriod({}, NOW);
    expect(p).toMatchObject({ key: '30d', from: '2026-10-22', to: '2026-11-20', prevFrom: '2026-09-22', prevTo: '2026-10-21', days: 30 });
    expect(daysBetween(p.prevFrom, p.prevTo)).toBe(30);
  });

  it('raccourcis 7 j et 12 mois', () => {
    expect(parsePeriod({ period: '7d' }, NOW)).toMatchObject({ from: '2026-11-14', to: '2026-11-20' });
    expect(parsePeriod({ period: '12m' }, NOW)).toMatchObject({ from: '2025-11-21', to: '2026-11-20' });
  });

  it('dates libres : validées, bornées à aujourd’hui, sinon 30 jours', () => {
    expect(parsePeriod({ from: '2026-01-01', to: '2026-01-31' }, NOW)).toMatchObject({ key: 'custom', from: '2026-01-01', to: '2026-01-31', prevFrom: '2025-12-01', prevTo: '2025-12-31' });
    expect(parsePeriod({ from: '2026-11-01', to: '2027-02-01' }, NOW).to).toBe('2026-11-20');
    expect(parsePeriod({ from: '2026-02-30', to: '2026-03-01' }, NOW).key).toBe('30d');
    expect(parsePeriod({ from: '2026-03-10', to: '2026-03-01' }, NOW).key).toBe('30d');
    expect(parsePeriod({ from: '2020-01-01', to: '2026-01-01' }, NOW).key).toBe('30d');
    expect(parsePeriod({ period: 'n’importe quoi' }, NOW).key).toBe('30d');
  });

  it('paramètres d’URL et calcul de dates', () => {
    expect(periodQuery(parsePeriod({ period: '90d' }, NOW))).toBe('period=90d');
    expect(periodQuery(parsePeriod({ from: '2026-01-01', to: '2026-01-31' }, NOW))).toBe('from=2026-01-01&to=2026-01-31');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
});

describe('Tableau de bord — calculs d’affichage', () => {
  it('taux et évolutions (null quand non significatif)', () => {
    expect(rate(1, 3)).toBe(33.3);
    expect(rate(5, 0)).toBeNull();
    expect(delta(118, 100)).toBe(18);
    expect(delta(50, 100)).toBe(-50);
    expect(delta(10, 0)).toBeNull();
    expect(n({ a: null, b: 3 }, 'a')).toBe(0);
    expect(n({ b: 3 }, 'b')).toBe(3);
  });

  it('objectifs : réalisé du mois, avancement et rythme', () => {
    const m: MonthRow = {
      month: '2026-11-01', academy_cash: 600000, consulting_cash: 250000, consulting_refunds: 50000,
      new_users: 12, academy_enrollments: 8, consulting_done: 5, submissions_validated: 0, contact_requests: 0,
    };
    expect(goalActual('revenue_total', m)).toBe(800000);
    expect(goalActual('revenue_consulting', m)).toBe(200000);
    expect(goalActual('consulting_done', m)).toBe(5);
    expect(goalActual('new_users', undefined)).toBe(0);
    // Jour 15 sur 30 : la moitié est attendue.
    expect(goalProgress(800000, 2000000, 15, 30)).toEqual({ percent: 40, expected: 50, status: 'behind' });
    expect(goalProgress(1200000, 2000000, 15, 30).status).toBe('on_track');
    expect(goalProgress(2100000, 2000000, 15, 30).status).toBe('reached');
  });

  it('saisie d’un objectif', () => {
    expect(parseGoal('2 000 000')).toBe(2000000);
    expect(parseGoal('')).toBe(0);
    expect(parseGoal('-5')).toBeNull();
    expect(parseGoal('12,5')).toBeNull();
  });
});
