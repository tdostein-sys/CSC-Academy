import { beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { as, createTestDb, createUser, errorOf, type TestDb } from './harness';

/**
 * Tableau de bord — lot D1 : indicateurs calculés par la base sur un jeu de
 * données connu, droits (administrateur seul), objectifs, retour arrière.
 */
describe('Tableau de bord', () => {
  let db: TestDb;
  let admin: string;
  let amb: string;
  let s1: string;
  let s2: string;
  let client: string;

  const q = <T = Record<string, unknown>>(sql: string, params: unknown[] = []) =>
    db.query<T>(sql, params).then((r) => r.rows);
  const PERIOD = `public.academy_today() - 29, public.academy_today()`;
  const dash = <T = Record<string, number>>(fn: string, user = admin) =>
    as(db, user, () => q<{ d: T }>(`select public.dashboard_${fn}(${PERIOD}) as d`)).then((r) => r[0].d);

  beforeAll(async () => {
    db = await createTestDb();
    admin = await createUser(db, { username: 'csc_admin', admin: true });
    amb = await createUser(db, { email: 'amb-dash@test.local' });
    const [{ code }] = await as(db, amb, () => q<{ code: string }>('select public.become_ambassador() as code'));

    // --- Academy : 1 session (40 000 échue il y a 10 jours + 30 000 dans 30 jours)
    const course = await as(db, admin, () =>
      q<{ id: string }>(`insert into public.academy_courses (title_fr, status) values ('Analyse technique', 'published') returning id`),
    ).then((r) => r[0].id);
    const session = await as(db, admin, () =>
      q<{ id: string }>(
        `insert into public.academy_sessions (course_id, label_fr, starts_on, ends_on, seats, commission_rate)
         values ($1, 'Session test', current_date - 30, current_date + 90, 50, 10) returning id`,
        [course],
      ),
    ).then((r) => r[0].id);
    await as(db, admin, () =>
      q(`select public.academy_set_installments($1, array[40000, 30000]::bigint[], array[current_date - 10, current_date + 30]::date[])`, [session]),
    );
    await as(db, admin, () => q('select public.academy_set_enrollment_open($1, true)', [session]));
    const enroll = (user: string, c: string | null) =>
      as(db, user, () => q<{ id: string }>('select public.academy_enroll($1, $2) as id', [session, c])).then((r) => r[0].id);
    const pay = (e: string, amount: number) =>
      as(db, admin, () => q(`select public.academy_record_payment($1, $2, 'Orange Money', 'REF')`, [e, amount]));

    s1 = await createUser(db);
    s2 = await createUser(db);
    const s3 = await createUser(db);
    await pay(await enroll(s1, code), 40000); // parrainé, tranche 1 soldée
    await pay(await enroll(s2, null), 20000); // tranche 1 incomplète → en retard et bloqué
    await enroll(s3, null); // réservation non payée

    // --- Consulting : 1 rendez-vous payant réglé
    const advisor = await createUser(db);
    await as(db, admin, () => q(`select public.consulting_set_advisor($1, 'Conseiller', true)`, [advisor]));
    for (let d = 1; d <= 7; d++) {
      await as(db, admin, () =>
        q(`insert into public.consulting_availability (advisor_id, weekday, start_time, end_time) values ($1, $2, '08:00', '20:00')`, [advisor, d]),
      );
    }
    const offer = await as(db, admin, () =>
      q<{ id: string }>(
        `insert into public.consulting_offers (title_fr, category, mode, duration_minutes, price, status)
         values ('Bilan', 'investment', 'video', 60, 25000, 'published') returning id`,
      ),
    ).then((r) => r[0].id);
    client = await createUser(db);
    const [slot] = await as(db, client, () => q<{ starts_at: Date }>('select starts_at from public.consulting_available_slots($1) limit 1', [offer]));
    const [{ id: booking }] = await as(db, client, () =>
      q<{ id: string }>(`select public.consulting_book($1, $2::timestamptz, '') as id`, [offer, new Date(slot.starts_at).toISOString()]),
    );
    await as(db, admin, () => q(`select public.consulting_record_payment($1, 25000, 'orange_money', 'OM-DASH-1')`, [booking]));

    // --- Contact : 1 message
    await as(db, null, () =>
      q(`select public.contact_submit('Awa Ndiaye', 'awa-dash@test.local', '', 'payment', 'Bonjour, une question sur ma tranche.', null, 'fr')`),
    );
  });

  it('réservé à l’administrateur', async () => {
    for (const fn of ['global', 'academy', 'consulting', 'ambassador', 'contact']) {
      expect(await errorOf(dash(fn, s1))).toContain('forbidden');
    }
    expect(await errorOf(as(db, s1, () => q('select public.dashboard_monthly(12)')))).toContain('forbidden');
    expect(await errorOf(as(db, null, () => q(`select public.dashboard_global(${PERIOD})`)))).toMatch(/permission denied/);
    expect(await errorOf(as(db, s1, () => q(`select public.dashboard_set_goal(current_date, 'new_users', 10)`)))).toContain('forbidden');
    expect(await as(db, s1, () => q('select * from public.dashboard_goals'))).toHaveLength(0);
  });

  it('période contrôlée (ordre des dates, 800 jours au plus)', async () => {
    expect(await errorOf(as(db, admin, () => q('select public.dashboard_global(current_date, current_date - 1)')))).toContain('dashboard_invalid_period');
    expect(await errorOf(as(db, admin, () => q('select public.dashboard_global(current_date - 900, current_date)')))).toContain('dashboard_invalid_period');
  });

  it('Academy : inscriptions, encaissements, retards, remplissage', async () => {
    const d = await dash('academy');
    expect(d).toMatchObject({
      enrollments_new: 3,
      cohort_created: 3,
      cohort_activated: 2,
      active_now: 2,
      pending_now: 1,
      cash: 60000,
      payments_count: 2,
      remaining_now: 150000,
      due_to_date: 80000,
      paid_to_date: 60000,
      overdue_enrollments: 1,
      overdue_amount: 20000,
      blocked_now: 1,
      seats: 50,
      seats_taken: 3,
    });
    const top = d.top_courses as unknown as { title_fr: string; enrollments: number; cash: number }[];
    expect(top).toEqual([expect.objectContaining({ title_fr: 'Analyse technique', enrollments: 3, cash: 60000 })]);
  });

  it('Consulting : rendez-vous, encaissement, classement des offres, heures ouvertes', async () => {
    const d = await dash('consulting');
    expect(d).toMatchObject({ bookings_new: 1, cohort_paid: 1, cohort_paid_confirmed: 1, cash: 25000, payments_count: 1, refunds: 0, unpaid_now: 0 });
    // 30 jours × 12 h d'ouverture.
    expect(d.open_minutes).toBe(30 * 12 * 60);
    expect((d.top_offers as unknown as { title_fr: string }[]).map((o) => o.title_fr)).toEqual(['Bilan']);
  });

  it('Ambassador : parrainage et chiffre d’affaires apporté', async () => {
    const d = await dash('ambassador');
    expect(d).toMatchObject({ active_now: 1, referrals: 1, enrollments: 3, referral_cash: 40000 });
    expect((d.top_ambassadors as unknown as { referrals: number }[])[0].referrals).toBe(1);
  });

  it('Contact : messages reçus et à traiter', async () => {
    const d = await dash('contact');
    expect(d).toMatchObject({ received: 1, new_now: 1, by_subject: { payment: 1 } });
  });

  it('Global : totaux tous modules, clients payants, créances', async () => {
    const d = await dash('global');
    const [{ n }] = await q<{ n: number }>('select count(*)::int as n from public.profiles');
    expect(d).toMatchObject({
      academy_cash: 60000,
      consulting_cash: 25000,
      consulting_refunds: 0,
      receivable_academy: 150000,
      receivable_consulting: 0,
      new_users: n,
      paying_clients: 3,
      cohort_users: n,
      cohort_paying: 3,
      referred_enrollments: 1,
      enrollments: 3,
      contact_new: 1,
      academy_overdue: 1,
      academy_pending: 1,
    });
  });

  it('évolution mensuelle : 12 mois, le mois courant en dernier', async () => {
    const [{ d }] = await as(db, admin, () => q<{ d: { month: string; academy_cash: number; consulting_cash: number; academy_enrollments: number }[] }>('select public.dashboard_monthly(12) as d'));
    expect(d).toHaveLength(12);
    const last = d[d.length - 1];
    expect(last).toMatchObject({ academy_cash: 60000, consulting_cash: 25000, academy_enrollments: 3 });
    expect(last.month).toMatch(/^\d{4}-\d{2}-01$/);
  });

  it('objectifs : saisie, remplacement, suppression, journalisés', async () => {
    const set = (target: number) => as(db, admin, () => q(`select public.dashboard_set_goal(current_date, 'revenue_total', $1)`, [target]));
    await set(2_000_000);
    await set(3_000_000);
    const rows = await as(db, admin, () => q<{ target: number; month: string }>(`select target, to_char(month, 'DD') as month from public.dashboard_goals`));
    expect(rows).toEqual([{ target: 3_000_000, month: '01' }]);
    await set(0);
    expect(await as(db, admin, () => q('select * from public.dashboard_goals'))).toHaveLength(0);
    const audit = await q(`select 1 from public.audit_log where action = 'dashboard.goal.set'`);
    expect(audit).toHaveLength(3);
    expect(await errorOf(as(db, admin, () => q(`select public.dashboard_set_goal(current_date, 'inconnu', 10)`)))).toContain('dashboard_invalid_goal');
    expect(await errorOf(as(db, admin, () => q(`select public.dashboard_set_goal(current_date, 'new_users', -5)`)))).toContain('dashboard_invalid_goal');
  });

  it('retour arrière puis réapplication de la migration', async () => {
    const dir = path.resolve(__dirname, '../../supabase');
    await db.exec(readFileSync(path.join(dir, 'rollbacks/20261124000100_dashboard.down.sql'), 'utf8'));
    expect(await q(`select 1 from pg_proc where proname like 'dashboard_%'`)).toHaveLength(0);
    await db.exec(readFileSync(path.join(dir, 'migrations/20261124000100_dashboard.sql'), 'utf8'));
    expect((await dash('academy')).cash).toBe(60000);
  });
});
