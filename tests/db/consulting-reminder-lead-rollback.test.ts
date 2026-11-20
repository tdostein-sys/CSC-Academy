import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createTestDb } from './harness';

/** Rappel « juste avant » : retour arrière (ancienne règle « 1 h avant »), puis réapplication. */
describe('Migration 20261125000100 — retour arrière', () => {
  it('se défait puis se réapplique', async () => {
    const db = await createTestDb();
    const dir = path.resolve(__dirname, '../../supabase');
    const lead = () => db.query(`select 1 from pg_proc where proname = 'consulting_reminder_lead'`).then((r) => r.rows.length);
    expect(await lead()).toBe(1);
    await db.exec(readFileSync(path.join(dir, 'rollbacks/20261125000100_consulting_reminder_lead.down.sql'), 'utf8'));
    expect(await lead()).toBe(0);
    await db.exec(readFileSync(path.join(dir, 'migrations/20261125000100_consulting_reminder_lead.sql'), 'utf8'));
    expect(await lead()).toBe(1);
  });
});
