import { beforeAll, describe, expect, it } from 'vitest';
import { as, createTestDb, createUser, errorOf, type TestDb } from './harness';

describe('Socle — droits d’accès par rôle (RLS)', () => {
  let db: TestDb;
  let alice: string;
  let bob: string;
  let admin: string;

  beforeAll(async () => {
    db = await createTestDb();
    alice = await createUser(db, { email: 'alice@test.local' });
    bob = await createUser(db, { email: 'bob@test.local' });
    admin = await createUser(db, { email: 'admin@test.local', username: 'csc_admin', admin: true });
  });

  it('crée automatiquement le profil à l’inscription', async () => {
    const { rows } = await db.query<{ email: string; username: string | null }>(
      'select email, username from public.profiles where id = $1',
      [admin],
    );
    expect(rows[0]).toEqual({ email: 'admin@test.local', username: 'csc_admin' });
  });

  it('un visiteur anonyme ne voit aucun profil', async () => {
    const err = await errorOf(as(db, null, () => db.query('select * from public.profiles')));
    expect(err).toMatch(/permission denied/);
  });

  it('un utilisateur ne voit que son propre profil', async () => {
    const rows = await as(db, alice, async () => (await db.query<{ id: string }>('select id from public.profiles')).rows);
    expect(rows.map((r) => r.id)).toEqual([alice]);
  });

  it('l’administrateur voit tous les profils', async () => {
    const rows = await as(db, admin, async () => (await db.query('select id from public.profiles')).rows);
    expect(rows.length).toBe(3);
  });

  it('un utilisateur peut modifier son nom mais pas celui d’un autre', async () => {
    await as(db, alice, () => db.query(`update public.profiles set first_name = 'Alice' where id = $1`, [alice]));
    const res = await as(db, alice, () => db.query(`update public.profiles set first_name = 'Pirate' where id = $1`, [bob]));
    expect(res.affectedRows).toBe(0);
    const { rows } = await db.query<{ first_name: string }>('select first_name from public.profiles where id = $1', [bob]);
    expect(rows[0].first_name).not.toBe('Pirate');
  });

  it('un utilisateur ne peut pas modifier son e-mail ni son nom d’utilisateur directement', async () => {
    const err = await errorOf(
      as(db, alice, () => db.query(`update public.profiles set username = 'csc_admin2' where id = $1`, [alice])),
    );
    expect(err).toMatch(/permission denied/);
  });

  it('un utilisateur ne peut pas s’attribuer le rôle administrateur', async () => {
    const err = await errorOf(
      as(db, alice, () => db.query(`insert into public.user_roles (user_id, role) values ($1, 'admin')`, [alice])),
    );
    expect(err).toMatch(/permission denied/);
    expect(await as(db, alice, async () => (await db.query<{ is_admin: boolean }>('select public.is_admin()')).rows[0].is_admin)).toBe(false);
    expect(await as(db, admin, async () => (await db.query<{ is_admin: boolean }>('select public.is_admin()')).rows[0].is_admin)).toBe(true);
  });

  it('seul l’administrateur modifie la charte, et l’action est auditée', async () => {
    const err = await errorOf(
      as(db, alice, () => db.query(`select public.update_site_content('ambassador_charter', 'x', 'y')`)),
    );
    expect(err).toMatch(/forbidden/);

    await as(db, admin, () => db.query(`select public.update_site_content('ambassador_charter', 'FR', 'EN')`));
    const { rows } = await db.query<{ body_fr: string }>(`select body_fr from public.site_content where key = 'ambassador_charter'`);
    expect(rows[0].body_fr).toBe('FR');
    const audit = await db.query<{ actor_id: string }>(`select actor_id from public.audit_log where action = 'site_content.update'`);
    expect(audit.rows[0].actor_id).toBe(admin);
  });

  it('la charte est lisible par les visiteurs', async () => {
    const rows = await as(db, null, async () => (await db.query('select key from public.site_content')).rows);
    expect(rows.length).toBeGreaterThan(0);
  });

  it('le journal d’audit est réservé à l’admin et ne peut pas être modifié', async () => {
    const aliceRows = await as(db, alice, async () => (await db.query('select * from public.audit_log')).rows);
    expect(aliceRows).toEqual([]);
    const err1 = await errorOf(as(db, alice, () => db.query(`select public.write_audit('x','y','z','{}')`)));
    expect(err1).toMatch(/permission denied/);
    const err2 = await errorOf(db.query('delete from public.audit_log'));
    expect(err2).toMatch(/append-only/);
  });

  it('le nom d’utilisateur est unique sans tenir compte de la casse', async () => {
    const err = await errorOf(createUser(db, { username: 'CSC_ADMIN' }));
    expect(err).toMatch(/duplicate key|unique/);
  });

  it('la file d’envoi n’est accessible qu’au serveur (clé secrète)', async () => {
    const err = await errorOf(as(db, admin, () => db.query('select * from public.claim_notification_deliveries(10)')));
    expect(err).toMatch(/permission denied/);
  });

  it('un envoi réservé n’est pas repris par un second traitement simultané', async () => {
    const { rows } = await db.query<{ id: string }>(
      `insert into public.notifications (user_id, type, title) values ($1, 't', 'file') returning id`,
      [admin],
    );
    await db.query(`insert into public.notification_deliveries (notification_id, channel) values ($1, 'email')`, [rows[0].id]);
    const first = await db.query('select * from public.claim_notification_deliveries(10)');
    const second = await db.query('select * from public.claim_notification_deliveries(10)');
    expect(first.rows.length).toBe(1);
    expect(second.rows.length).toBe(0);
  });

  it('chacun ne voit et ne marque comme lues que ses notifications', async () => {
    await db.query(
      `insert into public.notifications (user_id, type, title) values ($1, 't', 'pour alice'), ($2, 't', 'pour bob')`,
      [alice, bob],
    );
    const rows = await as(db, alice, async () => (await db.query<{ title: string }>('select title from public.notifications')).rows);
    expect(rows.map((r) => r.title)).toEqual(['pour alice']);

    await as(db, alice, () => db.query('select public.mark_notifications_read(null)'));
    const { rows: state } = await db.query<{ title: string; read: boolean }>(
      `select title, read_at is not null as read from public.notifications where title like 'pour %' order by title`,
    );
    expect(state).toEqual([
      { title: 'pour alice', read: true },
      { title: 'pour bob', read: false },
    ]);

    const err = await errorOf(
      as(db, alice, () => db.query(`insert into public.notifications (user_id, type, title) values ($1, 't', 'spam')`, [bob])),
    );
    expect(err).toMatch(/permission denied/);
  });
});
