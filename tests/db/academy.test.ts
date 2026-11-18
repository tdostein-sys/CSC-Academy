import { beforeAll, describe, expect, it } from 'vitest';
import { as, createTestDb, createUser, errorOf, type TestDb } from './harness';

/**
 * Règles critiques de CSC Academy (lot 1), vérifiées sur les vraies migrations
 * et sous l'identité de chaque rôle (la RLS s'applique).
 */
describe('CSC Academy — règles métier', () => {
  let db: TestDb;
  let admin: string;
  let amb: string;
  let ambSuspended: string;
  let s1: string;
  let s2: string;
  let s3: string;

  const q = <T = Record<string, unknown>>(sql: string, params: unknown[] = []) =>
    db.query<T>(sql, params).then((r) => r.rows);

  /** Crée une formation (publiée par défaut) et une session ouverte avec un échéancier. */
  async function setup(opts: { seats?: number; publish?: boolean; open?: boolean; amounts?: number[]; rate?: number } = {}) {
    const course = await as(db, admin, () =>
      q<{ id: string }>(
        `insert into public.academy_courses (title_fr, status) values ('Trading débutant', $1) returning id`,
        [opts.publish === false ? 'draft' : 'published'],
      ),
    ).then((r) => r[0].id);
    const session = await as(db, admin, () =>
      q<{ id: string }>(
        `insert into public.academy_sessions (course_id, label_fr, starts_on, ends_on, seats, commission_rate)
         values ($1, 'Session janvier', current_date, current_date + 60, $2, $3) returning id`,
        [course, opts.seats ?? 10, opts.rate ?? 10],
      ),
    ).then((r) => r[0].id);
    const amounts = opts.amounts ?? [40000, 30000, 30000];
    const dates = amounts.map((_, i) => `current_date + ${i * 30}`);
    await as(db, admin, () =>
      q(`select public.academy_set_installments($1, $2::bigint[], array[${dates.join(',')}]::date[])`, [session, amounts]),
    );
    if (opts.open !== false && opts.publish !== false) {
      await as(db, admin, () => q('select public.academy_set_enrollment_open($1, true)', [session]));
    }
    return { course, session };
  }

  const enroll = (user: string, session: string, code: string | null = null) =>
    as(db, user, () => q<{ id: string }>('select public.academy_enroll($1, $2) as id', [session, code])).then(
      (r) => r[0].id,
    );

  const pay = (enrollment: string, amount: number) =>
    as(db, admin, () =>
      q<{ id: string }>(`select public.academy_record_payment($1, $2, 'Orange Money', 'REF') as id`, [enrollment, amount]),
    ).then((r) => r[0].id);

  const balance = (user: string, enrollment: string) =>
    as(db, user, () =>
      q<{ price: number; paid: number; remaining: number; fully_paid: boolean; status: string }>(
        `select price::int, paid::int, remaining::int, fully_paid, status::text
           from public.academy_enrollment_balances where enrollment_id = $1`,
        [enrollment],
      ),
    ).then((r) => r[0]);

  beforeAll(async () => {
    db = await createTestDb();
    admin = await createUser(db, { username: 'csc_admin', admin: true });
    amb = await createUser(db, { email: 'amb@test.local' });
    ambSuspended = await createUser(db, { email: 'amb2@test.local' });
    s1 = await createUser(db, { email: 's1@test.local' });
    s2 = await createUser(db, { email: 's2@test.local' });
    s3 = await createUser(db, { email: 's3@test.local' });
    await as(db, amb, () => q('select public.become_ambassador()'));
    await as(db, ambSuspended, () => q('select public.become_ambassador()'));
    await as(db, admin, () => q(`select public.set_ambassador_status($1, 'suspended', 'test')`, [ambSuspended]));
  });

  // ---------------------------------------------------------------------------
  describe('Catalogue', () => {
    it('un visiteur voit les formations publiées, pas les brouillons', async () => {
      const pub = await setup();
      const draft = await setup({ publish: false });
      const ids = await as(db, null, () => q<{ id: string }>('select id from public.academy_courses')).then((r) =>
        r.map((x) => x.id),
      );
      expect(ids).toContain(pub.course);
      expect(ids).not.toContain(draft.course);
      const sessions = await as(db, null, () => q<{ id: string }>('select id from public.academy_sessions'));
      expect(sessions.map((x) => x.id)).not.toContain(draft.session);
    });

    it('expose le prix (somme des tranches) et les places restantes', async () => {
      const { session } = await setup({ seats: 5 });
      const rows = await as(db, null, () =>
        q<{ price: number; remaining: number; installments_count: number }>(
          'select price::int, remaining, installments_count from public.academy_session_overview where session_id = $1',
          [session],
        ),
      );
      expect(rows[0]).toEqual({ price: 100000, remaining: 5, installments_count: 3 });
    });

    it('seul l’admin crée des formations', async () => {
      const err = await errorOf(as(db, s1, () => q(`insert into public.academy_courses (title_fr) values ('Pirate')`)));
      expect(err).not.toBeNull();
    });

    it('ouvrir les inscriptions exige une formation publiée', async () => {
      const { session } = await setup({ publish: false });
      const err = await errorOf(as(db, admin, () => q('select public.academy_set_enrollment_open($1, true)', [session])));
      expect(err).toMatch(/course_not_published/);
    });

    it('refuse un échéancier aux dates non croissantes', async () => {
      const { session } = await setup({ open: false });
      const err = await errorOf(
        as(db, admin, () =>
          q(`select public.academy_set_installments($1, array[100, 200]::bigint[], array[current_date + 10, current_date]::date[])`, [
            session,
          ]),
        ),
      );
      expect(err).toMatch(/schedule_dates_order/);
    });
  });

  // ---------------------------------------------------------------------------
  describe('Inscription et places', () => {
    it('refuse une session fermée', async () => {
      const { session } = await setup({ open: false });
      expect(await errorOf(enroll(s1, session))).toMatch(/enrollment_closed/);
    });

    it('refuse un profil incomplet', async () => {
      const { session } = await setup();
      const u = await createUser(db, { meta: { phone_whatsapp: '' } });
      expect(await errorOf(enroll(u, session))).toMatch(/profile_incomplete/);
    });

    it('une seule inscription par session', async () => {
      const { session } = await setup();
      await enroll(s1, session);
      expect(await errorOf(enroll(s1, session))).toMatch(/already_enrolled/);
    });

    it('refuse l’inscription quand la session est complète', async () => {
      const { session } = await setup({ seats: 2 });
      await enroll(s1, session);
      await enroll(s2, session);
      expect(await errorOf(enroll(s3, session))).toMatch(/session_full/);
    });

    it('une réservation non payée expire après 3 jours et libère la place', async () => {
      const { session } = await setup({ seats: 1 });
      const e1 = await enroll(s1, session);
      const hold = await q<{ h: boolean }>(
        `select hold_expires_at between now() + interval '71 hours' and now() + interval '73 hours' as h
           from public.academy_enrollments where id = $1`,
        [e1],
      );
      expect(hold[0].h).toBe(true);
      expect(await errorOf(enroll(s2, session))).toMatch(/session_full/);
      await q(`update public.academy_enrollments set hold_expires_at = now() - interval '1 minute' where id = $1`, [e1]);
      await enroll(s2, session);
      const st = await q<{ status: string; cancel_reason: string }>(
        'select status::text, cancel_reason from public.academy_enrollments where id = $1',
        [e1],
      );
      expect(st[0]).toEqual({ status: 'cancelled', cancel_reason: 'hold_expired' });
    });

    it('impossible de réduire les places sous le nombre d’inscrits', async () => {
      const { session } = await setup({ seats: 3 });
      await enroll(s1, session);
      await enroll(s2, session);
      const err = await errorOf(as(db, admin, () => q('update public.academy_sessions set seats = 1 where id = $1', [session])));
      expect(err).toMatch(/seats_below_enrolled/);
    });

    it('un étudiant ne peut pas s’inscrire en écrivant directement dans la table', async () => {
      const { session } = await setup();
      const err = await errorOf(
        as(db, s1, () =>
          q(`insert into public.academy_enrollments (session_id, student_id, status) values ($1, $2, 'active')`, [session, s1]),
        ),
      );
      expect(err).not.toBeNull();
    });

    it('un étudiant ne voit que ses propres inscriptions', async () => {
      const { session } = await setup();
      await enroll(s1, session);
      await enroll(s2, session);
      const rows = await as(db, s1, () =>
        q<{ student_id: string }>('select student_id from public.academy_enrollments where session_id = $1', [session]),
      );
      expect(rows.map((r) => r.student_id)).toEqual([s1]);
    });
  });

  // ---------------------------------------------------------------------------
  describe('Code de parrainage', () => {
    it('fige le parrain et le taux de commission de la session', async () => {
      const { session } = await setup({ rate: 12.5 });
      const e = await enroll(s1, session, ' csc-amb-0001 ');
      const rows = await q<{ referral_ambassador_id: string; commission_rate: string }>(
        'select referral_ambassador_id, commission_rate::text from public.academy_enrollments where id = $1',
        [e],
      );
      expect(rows[0]).toEqual({ referral_ambassador_id: amb, commission_rate: '12.50' });
    });

    it('refuse un code inconnu ou d’un ambassadeur suspendu', async () => {
      const { session } = await setup();
      expect(await errorOf(enroll(s1, session, 'CSC-AMB-9999'))).toMatch(/referral_invalid/);
      expect(await errorOf(enroll(s1, session, 'CSC-AMB-0002'))).toMatch(/referral_invalid/);
    });

    it('refuse son propre code', async () => {
      const { session } = await setup();
      expect(await errorOf(enroll(amb, session, 'CSC-AMB-0001'))).toMatch(/referral_self/);
    });

    it('sans code, pas de commission', async () => {
      const { session } = await setup({ rate: 10 });
      const e = await enroll(s1, session);
      const rows = await q<{ r: string }>('select commission_rate::text as r from public.academy_enrollments where id = $1', [e]);
      expect(rows[0].r).toBe('0.00');
    });
  });

  // ---------------------------------------------------------------------------
  describe('Paiements et échéancier', () => {
    it('le premier paiement active l’inscription et fige la session', async () => {
      const { session } = await setup();
      const e = await enroll(s1, session);
      expect((await balance(s1, e)).status).toBe('pending');
      await pay(e, 40000);
      expect(await balance(s1, e)).toEqual({ price: 100000, paid: 40000, remaining: 60000, fully_paid: false, status: 'active' });
      const err = await errorOf(
        as(db, admin, () =>
          q(`select public.academy_set_installments($1, array[100000]::bigint[], array[current_date]::date[])`, [session]),
        ),
      );
      expect(err).toMatch(/session_frozen/);
      const err2 = await errorOf(as(db, admin, () => q('update public.academy_sessions set commission_rate = 50 where id = $1', [session])));
      expect(err2).toMatch(/session_frozen/);
    });

    it('refuse un paiement supérieur au reste dû', async () => {
      const { session } = await setup();
      const e = await enroll(s1, session);
      await pay(e, 90000);
      expect(await errorOf(pay(e, 20000))).toMatch(/payment_exceeds_due/);
      await pay(e, 10000);
      expect((await balance(s1, e)).fully_paid).toBe(true);
    });

    it('seul l’admin enregistre un paiement', async () => {
      const { session } = await setup();
      const e = await enroll(s1, session);
      const err = await errorOf(as(db, s1, () => q(`select public.academy_record_payment($1, 1000, 'Orange Money')`, [e])));
      expect(err).toMatch(/forbidden/);
    });

    it('répartit les paiements sur les tranches dans l’ordre', async () => {
      const { session } = await setup();
      const e = await enroll(s1, session);
      await pay(e, 50000);
      const rows = await as(db, s1, () =>
        q<{ rank: number; state: string; paid_amount: number }>(
          'select rank, state, paid_amount::int from public.academy_installment_states where enrollment_id = $1 order by rank',
          [e],
        ),
      );
      expect(rows).toEqual([
        { rank: 1, state: 'paid', paid_amount: 40000 },
        { rank: 2, state: 'partial', paid_amount: 10000 },
        { rank: 3, state: 'unpaid', paid_amount: 0 },
      ]);
    });

    it('signale une tranche en retard, et un délai accordé la repousse', async () => {
      const { session } = await setup();
      const e = await enroll(s1, session);
      await pay(e, 40000);
      // Tranche 2 échue hier (modification directe en test).
      await q(`update public.academy_installments set due_on = current_date - 40 where session_id = $1 and rank = 1`, [session]);
      await q(`update public.academy_installments set due_on = current_date - 1 where session_id = $1 and rank = 2`, [session]);
      const overdue = () =>
        as(db, s1, () =>
          q<{ overdue_count: number }>('select overdue_count from public.academy_enrollment_balances where enrollment_id = $1', [e]),
        ).then((r) => r[0].overdue_count);
      expect(await overdue()).toBe(1);
      await as(db, admin, () => q(`select public.academy_grant_extension($1, 2, current_date + 5, 'Maladie')`, [e]));
      expect(await overdue()).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  describe('Annulation (pas de désistement)', () => {
    it('l’étudiant peut annuler une inscription non payée', async () => {
      const { session } = await setup();
      const e = await enroll(s1, session);
      await as(db, s1, () => q('select public.academy_cancel_enrollment($1)', [e]));
      expect((await balance(s1, e)).status).toBe('cancelled');
      await enroll(s1, session); // la place est de nouveau disponible pour lui
    });

    it('refuse l’annulation après un paiement, même pour l’admin', async () => {
      const { session } = await setup();
      const e = await enroll(s1, session);
      await pay(e, 1000);
      expect(await errorOf(as(db, s1, () => q('select public.academy_cancel_enrollment($1)', [e])))).toMatch(
        /enrollment_not_cancellable/,
      );
      expect(await errorOf(as(db, admin, () => q('select public.academy_cancel_enrollment($1)', [e])))).toMatch(
        /enrollment_not_cancellable/,
      );
    });

    it('un étudiant ne peut pas annuler l’inscription d’un autre', async () => {
      const { session } = await setup();
      const e = await enroll(s1, session);
      expect(await errorOf(as(db, s2, () => q('select public.academy_cancel_enrollment($1)', [e])))).toMatch(/not_found/);
    });
  });

  // ---------------------------------------------------------------------------
  describe('Accès aux contenus', () => {
    it('séances, documents et fichiers réservés aux inscrits actifs', async () => {
      const { session } = await setup();
      await as(db, admin, () =>
        q(
          `insert into public.academy_meetings (session_id, title_fr, starts_at, external_url)
           values ($1, 'Séance 1', now() + interval '1 day', 'https://meet.example.com/x')`,
          [session],
        ),
      );
      await as(db, admin, () =>
        q(
          `insert into public.academy_resources (session_id, kind, title_fr, file_path) values ($1, 'document', 'Support', $2)`,
          [session, `${session}/support.pdf`],
        ),
      );
      await q(`insert into storage.objects (bucket_id, name) values ('academy-files', $1)`, [`${session}/support.pdf`]);

      const visible = (user: string) =>
        as(db, user, async () => ({
          meetings: (await q('select id from public.academy_meetings where session_id = $1', [session])).length,
          resources: (await q('select id from public.academy_resources where session_id = $1', [session])).length,
          files: (await q(`select id from storage.objects where bucket_id = 'academy-files' and name like $1`, [`${session}/%`]))
            .length,
        }));

      const e = await enroll(s1, session);
      expect(await visible(s1)).toEqual({ meetings: 0, resources: 0, files: 0 }); // en attente de paiement
      await pay(e, 40000);
      expect(await visible(s1)).toEqual({ meetings: 1, resources: 1, files: 1 });
      expect(await visible(s2)).toEqual({ meetings: 0, resources: 0, files: 0 }); // non inscrit
    });

    it('un étudiant ne peut pas ajouter de document', async () => {
      const { session } = await setup();
      const err = await errorOf(
        as(db, s1, () =>
          q(`insert into public.academy_resources (session_id, kind, title_fr, url) values ($1, 'link', 'Spam', 'https://x.y')`, [
            session,
          ]),
        ),
      );
      expect(err).not.toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  describe('Fondations du paiement en ligne', () => {
    it('les fonctions de paiement en ligne sont interdites aux utilisateurs', async () => {
      const { session } = await setup();
      const e = await enroll(s1, session);
      const err = await errorOf(
        as(db, s1, () => q(`select public.academy_open_online_payment($1, 40000, 'notchpay', 'trx_1')`, [e])),
      );
      expect(err).toMatch(/permission denied/);
    });

    it('un paiement en ligne ne compte qu’une fois confirmé, et une seule fois', async () => {
      const { session } = await setup();
      const e = await enroll(s1, session);
      await q(`select public.academy_open_online_payment($1, 40000, 'notchpay', 'trx_ok')`, [e]);
      expect((await balance(s1, e)).paid).toBe(0);
      const r1 = await q<{ r: string }>(`select public.academy_settle_online_payment('trx_ok', true) as r`);
      const r2 = await q<{ r: string }>(`select public.academy_settle_online_payment('trx_ok', true) as r`);
      expect([r1[0].r, r2[0].r]).toEqual(['confirmed', 'confirmed']);
      expect(await balance(s1, e)).toMatchObject({ paid: 40000, status: 'active' });
    });

    it('un paiement en ligne échoué ne compte pas', async () => {
      const { session } = await setup();
      const e = await enroll(s1, session);
      await q(`select public.academy_open_online_payment($1, 40000, 'notchpay', 'trx_ko')`, [e]);
      await q(`select public.academy_settle_online_payment('trx_ko', false)`);
      expect(await balance(s1, e)).toMatchObject({ paid: 0, status: 'pending' });
    });
  });

  // ---------------------------------------------------------------------------
  it('les actions sensibles sont journalisées', async () => {
    const rows = await q<{ action: string }>(
      `select distinct action from public.audit_log where action like 'academy.%' order by action`,
    );
    const actions = rows.map((r) => r.action);
    expect(actions).toEqual(
      expect.arrayContaining([
        'academy.courses.insert',
        'academy.sessions.insert',
        'academy.installments.set',
        'academy.enrollment.create',
        'academy.enrollment.cancel',
        'academy.payment.record',
        'academy.extension.grant',
        'academy.payment.online_confirmed',
      ]),
    );
  });
});
