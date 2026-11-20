import { beforeAll, describe, expect, it } from 'vitest';
import { as, createTestDb, createUser, type TestDb } from './harness';

/**
 * Notifications lues / non lues. Cause du bug corrigé : l'admin peut LIRE les
 * notifications de tous (supervision des envois) ; sans filtre sur son
 * identifiant, sa page et son compteur incluaient celles des autres, que
 * « Tout marquer comme lu » ne touche pas (à juste titre).
 */
describe('Notifications — marquage comme lu', () => {
  let db: TestDb;
  let admin: string;
  let member: string;
  const q = <T = Record<string, unknown>>(sql: string, params: unknown[] = []) => db.query<T>(sql, params).then((r) => r.rows);
  const notify = (user: string) =>
    q<{ id: string }>(`insert into public.notifications (user_id, type, title) values ($1, 'system.test', 'Test') returning id`, [user]).then((r) => r[0].id);
  const unread = (viewer: string, own: boolean) =>
    as(db, viewer, () =>
      q<{ n: number }>(`select count(*)::int as n from public.notifications where read_at is null ${own ? 'and user_id = $1' : 'and $1::uuid is not null'}`, [viewer]),
    ).then((r) => r[0].n);

  beforeAll(async () => {
    db = await createTestDb();
    admin = await createUser(db, { admin: true });
    member = await createUser(db);
  });

  it('« Tout marquer comme lu » : le compteur filtré de l’admin tombe à zéro', async () => {
    await notify(admin);
    await notify(admin);
    await notify(member);
    expect(await unread(admin, false)).toBe(3); // sans filtre : celles du membre aussi (cause du bug)
    expect(await unread(admin, true)).toBe(2);
    await as(db, admin, () => q('select public.mark_notifications_read(null)'));
    expect(await unread(admin, true)).toBe(0);
    expect(await unread(member, true)).toBe(1); // celles des autres ne sont pas touchées
  });

  it('une seule notification ; impossible de marquer celle d’un autre', async () => {
    const mine = await notify(member);
    const other = await notify(admin);
    await as(db, member, () => q('select public.mark_notifications_read($1::uuid[])', [[mine, other]]));
    const rows = await q<{ id: string; read: boolean }>('select id, read_at is not null as read from public.notifications where id = any($1::uuid[])', [[mine, other]]);
    expect(Object.fromEntries(rows.map((r) => [r.id, r.read]))).toEqual({ [mine]: true, [other]: false });
  });
});
