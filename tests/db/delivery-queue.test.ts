import { beforeAll, describe, expect, it } from 'vitest';
import { as, createTestDb, createUser, errorOf, type TestDb } from './harness';

describe('File d’envoi des messages aux ambassadeurs', () => {
  let db: TestDb;
  let admin: string;
  let amb: string;
  let user: string;
  let failedId: string;

  const q = <T = Record<string, unknown>>(sql: string, params: unknown[] = []) => db.query<T>(sql, params).then((r) => r.rows);

  async function delivery(userId: string, title: string, status: string) {
    const [n] = await q<{ id: string }>(
      `insert into public.notifications (user_id, type, title) values ($1, 'campaign.launched', $2) returning id`,
      [userId, title],
    );
    const [d] = await q<{ id: string }>(
      `insert into public.notification_deliveries (notification_id, channel, status, attempts, last_error)
       values ($1, 'email', $2::public.delivery_status,
               case when $2::text = 'failed' then 5 else 0 end,
               case when $2::text = 'failed' then 'sender not verified' end)
       returning id`,
      [n.id, status],
    );
    return d.id;
  }

  beforeAll(async () => {
    db = await createTestDb();
    admin = await createUser(db, { admin: true });
    amb = await createUser(db, { email: 'amb@test.local' });
    user = await createUser(db, { email: 'simple@test.local' });
    await as(db, amb, () => q('select public.become_ambassador()'));
    await delivery(amb, 'Campagne A', 'sent');
    failedId = await delivery(amb, 'Campagne B', 'failed');
    await delivery(user, 'Message non ambassadeur', 'failed');
  });

  it('l’admin voit la file des ambassadeurs (destinataire, message, erreur)', async () => {
    const rows = await as(db, admin, () =>
      q<{ title: string; ambassador_code: string; email: string; status: string; last_error: string | null }>(
        'select title, ambassador_code, email, status, last_error from public.ambassador_delivery_queue order by title',
      ),
    );
    expect(rows).toEqual([
      { title: 'Campagne A', ambassador_code: 'CSC-AMB-0001', email: 'amb@test.local', status: 'sent', last_error: null },
      { title: 'Campagne B', ambassador_code: 'CSC-AMB-0001', email: 'amb@test.local', status: 'failed', last_error: 'sender not verified' },
    ]);
  });

  it('un ambassadeur ne voit pas la file', async () => {
    expect(await as(db, amb, () => q('select * from public.ambassador_delivery_queue'))).toEqual([]);
  });

  it('l’admin lit toutes les notifications, un utilisateur seulement les siennes', async () => {
    const all = await as(db, admin, () => q('select id from public.notifications'));
    const own = await as(db, user, () => q<{ title: string }>('select title from public.notifications'));
    expect(all.length).toBe(3);
    expect(own.map((r) => r.title)).toEqual(['Message non ambassadeur']);
  });

  it('seul l’admin remet les échecs en file ; l’action est auditée', async () => {
    expect(await errorOf(as(db, amb, () => q('select public.retry_failed_deliveries(null)')))).toMatch(/forbidden/);

    const [r] = await as(db, admin, () => q<{ n: number }>('select public.retry_failed_deliveries(array[$1]::uuid[]) as n', [failedId]));
    expect(r.n).toBe(1);
    const [d] = await q<{ status: string; attempts: number; last_error: string | null }>(
      'select status, attempts, last_error from public.notification_deliveries where id = $1',
      [failedId],
    );
    expect(d).toEqual({ status: 'pending', attempts: 0, last_error: null });
    const audit = await q(`select 1 from public.audit_log where action = 'delivery.retry'`);
    expect(audit.length).toBe(1);
  });

  it('« tout réessayer » ne touche que les messages des ambassadeurs', async () => {
    const [r] = await as(db, admin, () => q<{ n: number }>('select public.retry_failed_deliveries(null) as n'));
    expect(r.n).toBe(0); // l'échec restant concerne un non-ambassadeur
    const rows = await q<{ status: string }>(
      `select d.status from public.notification_deliveries d join public.notifications n on n.id = d.notification_id
        where n.title = 'Message non ambassadeur'`,
    );
    expect(rows[0].status).toBe('failed');
  });
});
