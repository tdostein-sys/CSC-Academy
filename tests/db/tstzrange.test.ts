import { beforeAll, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { parseTstzRange, pgTimestampToIso } from '@/lib/consulting/range';

/**
 * Indisponibilités Consulting : la page lisait la plage `tstzrange` avec
 * `new Date("2026-12-01 07:00:00+00")`, refusé par JavaScript (décalage sans
 * minutes) → « Invalid time value ». On teste sur le texte RÉELLEMENT produit
 * par PostgreSQL, en UTC (Supabase) et à l'heure du Cameroun.
 */
describe('Plages horaires PostgreSQL (tstzrange)', () => {
  let db: PGlite;
  const rangeText = async (tz: string) => {
    await db.exec(`set timezone = '${tz}'`);
    const { rows } = await db.query<{ r: string }>(
      `select tstzrange('2026-12-01 08:00+01'::timestamptz, '2026-12-01 18:30:15.25+01'::timestamptz, '[)')::text as r`,
    );
    return rows[0].r;
  };

  beforeAll(async () => {
    db = new PGlite();
  });

  it('texte Supabase (UTC, décalage « +00 ») : bornes correctes', async () => {
    const text = await rangeText('UTC');
    expect(text).toContain('+00');
    expect(parseTstzRange(text)).toEqual(['2026-12-01T07:00:00.000Z', '2026-12-01T17:30:15.250Z']);
  });

  it('même plage écrite à l’heure du Cameroun (« +01 »)', async () => {
    expect(parseTstzRange(await rangeText('Africa/Douala'))).toEqual(['2026-12-01T07:00:00.000Z', '2026-12-01T17:30:15.250Z']);
  });

  it('formats de décalage et cas limites', () => {
    expect(pgTimestampToIso('2026-12-01 07:00:00+05:30')).toBe('2026-12-01T01:30:00.000Z');
    expect(pgTimestampToIso('2026-12-01T07:00:00Z')).toBe('2026-12-01T07:00:00.000Z');
    expect(pgTimestampToIso('2026-12-01 07:00:00.123456+00')).toBe('2026-12-01T07:00:00.123Z');
    expect(parseTstzRange('empty')).toBeNull();
    expect(parseTstzRange('[-infinity,infinity)')).toBeNull();
    expect(parseTstzRange('n’importe quoi')).toBeNull();
    expect(parseTstzRange(null)).toBeNull();
  });
});
