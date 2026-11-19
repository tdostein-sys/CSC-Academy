import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createTestDb } from './harness';

/** La migration CSC Consulting est réversible : retour arrière, puis réapplication. */
describe('CSC Consulting — retour arrière', () => {
  it('supprime tout le module sans toucher au reste, puis se réapplique', async () => {
    const db = await createTestDb();
    const read = (p: string) => readFileSync(path.resolve(__dirname, '../../supabase', p), 'utf8');
    const tables = () =>
      db
        .query<{ n: number }>(`select count(*)::int as n from pg_tables where schemaname = 'public' and (tablename like 'consulting%' or tablename = 'job_runs')`)
        .then((r) => r.rows[0].n);

    expect(await tables()).toBe(12);
    await db.exec(read('rollbacks/20261123000100_consulting.down.sql'));
    expect(await tables()).toBe(0);
    // Les autres modules sont intacts.
    const academy = await db.query<{ n: number }>(`select count(*)::int as n from pg_tables where schemaname = 'public' and tablename like 'academy%'`);
    expect(academy.rows[0].n).toBeGreaterThan(10);

    await db.exec(read('migrations/20261123000100_consulting.sql'));
    expect(await tables()).toBe(12);
  });
});
