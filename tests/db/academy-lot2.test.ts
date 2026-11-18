import { beforeAll, describe, expect, it } from 'vitest';
import { as, createTestDb, createUser, errorOf, type TestDb } from './harness';

/**
 * CSC Academy — lot 2 : blocage J+3, rappels, commissions, questionnaire et
 * attestations, vérifiés sur les vraies migrations et sous l'identité de
 * chaque rôle (la RLS s'applique).
 */
describe('CSC Academy — lot 2', () => {
  let db: TestDb;
  let admin: string;
  let amb: string;
  let outsider: string;

  const q = <T = Record<string, unknown>>(sql: string, params: unknown[] = []) =>
    db.query<T>(sql, params).then((r) => r.rows);

  /** Formation publiée + session ouverte ; `offsets` = échéances en jours depuis aujourd'hui. */
  async function setup(amounts: number[], offsets: number[], rate = 10) {
    const course = await as(db, admin, () =>
      q<{ id: string }>(`insert into public.academy_courses (title_fr, status) values ('Analyse technique', 'published') returning id`),
    ).then((r) => r[0].id);
    const session = await as(db, admin, () =>
      q<{ id: string }>(
        `insert into public.academy_sessions (course_id, label_fr, starts_on, ends_on, seats, commission_rate)
         values ($1, 'Session test', current_date - 30, current_date + 90, 50, $2) returning id`,
        [course, rate],
      ),
    ).then((r) => r[0].id);
    const dates = offsets.map((d) => `current_date + (${d})`);
    await as(db, admin, () =>
      q(`select public.academy_set_installments($1, $2::bigint[], array[${dates.join(',')}]::date[])`, [session, amounts]),
    );
    await as(db, admin, () => q('select public.academy_set_enrollment_open($1, true)', [session]));
    return session;
  }

  const enroll = (user: string, session: string, code: string | null = null) =>
    as(db, user, () => q<{ id: string }>('select public.academy_enroll($1, $2) as id', [session, code])).then((r) => r[0].id);

  const pay = (enrollment: string, amount: number) =>
    as(db, admin, () => q(`select public.academy_record_payment($1, $2, 'Orange Money', 'REF')`, [enrollment, amount]));

  const canAccess = (user: string, session: string) =>
    as(db, user, () => q<{ ok: boolean }>('select public.academy_can_access_session($1) as ok', [session])).then((r) => r[0].ok);

  const asService = async <T,>(fn: () => Promise<T>) => {
    await db.exec('set role service_role');
    try {
      return await fn();
    } finally {
      await db.exec('reset role');
    }
  };

  beforeAll(async () => {
    db = await createTestDb();
    admin = await createUser(db, { username: 'csc_admin', admin: true });
    amb = await createUser(db, { email: 'amb-l2@test.local' });
    outsider = await createUser(db, { email: 'outsider-l2@test.local' });
    await as(db, amb, () => q('select public.become_ambassador()'));
  });

  // ---------------------------------------------------------------------------
  describe('Blocage pour retard (J+3)', () => {
    it('bloque l’accès 3 jours après une tranche impayée, débloque au paiement', async () => {
      const session = await setup([40000, 30000], [-10, 30]);
      const student = await createUser(db);
      const e = await enroll(student, session);
      await pay(e, 20000); // inscription active, mais tranche 1 incomplète et échue depuis 10 jours
      await as(db, admin, () =>
        q(`insert into public.academy_meetings (session_id, title_fr, starts_at) values ($1, 'Séance 1', now() + interval '1 day')`, [session]),
      );

      expect(await canAccess(student, session)).toBe(false);
      const blocked = await as(db, student, () =>
        q<{ blocked_since: string | null }>('select blocked_since from public.academy_enrollment_balances where enrollment_id = $1', [e]),
      );
      expect(blocked[0].blocked_since).not.toBeNull();
      expect(await as(db, student, () => q('select id from public.academy_meetings where session_id = $1', [session]))).toHaveLength(0);

      await pay(e, 20000); // tranche 1 soldée
      expect(await canAccess(student, session)).toBe(true);
      expect(await as(db, student, () => q('select id from public.academy_meetings where session_id = $1', [session]))).toHaveLength(1);
    });

    it('un délai accordé lève le blocage', async () => {
      const session = await setup([40000, 30000], [-10, 30]);
      const student = await createUser(db);
      const e = await enroll(student, session);
      await pay(e, 10000);
      expect(await canAccess(student, session)).toBe(false);
      await as(db, admin, () => q(`select public.academy_grant_extension($1, 1, current_date + 5, 'Accord')`, [e]));
      expect(await canAccess(student, session)).toBe(true);
    });

    it('le délai de 3 jours n’est pas encore écoulé : accès maintenu', async () => {
      const session = await setup([40000, 30000], [-1, 30]);
      const student = await createUser(db);
      const e = await enroll(student, session);
      await pay(e, 10000);
      expect(await canAccess(student, session)).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  describe('Rappels', () => {
    it('J-3, J et blocage : chacun envoyé une seule fois', async () => {
      const session = await setup([10000, 10000, 10000, 10000], [-10, 0, 2, 20]);
      const student = await createUser(db);
      const e = await enroll(student, session);
      await pay(e, 5000);

      type R = { enrollment_id: string; rank: number; kind: string; amount_due: string; course_title_fr: string };
      const first = (await asService(() => q<R>('select * from public.academy_claim_reminders(1000)'))).filter(
        (r) => r.enrollment_id === e,
      );
      const byRank = Object.fromEntries(first.map((r) => [r.rank, r.kind]));
      expect(byRank).toEqual({ 1: 'blocked', 2: 'due_today', 3: 'due_soon' });
      expect(Number(first.find((r) => r.rank === 1)!.amount_due)).toBe(5000);
      expect(first[0].course_title_fr).toBe('Analyse technique');

      const again = (await asService(() => q<R>('select * from public.academy_claim_reminders(1000)'))).filter(
        (r) => r.enrollment_id === e,
      );
      expect(again).toHaveLength(0);
    });

    it('un délai accordé relance le rappel de la nouvelle date', async () => {
      const session = await setup([10000, 10000], [1, 40]);
      const student = await createUser(db);
      const e = await enroll(student, session);
      await pay(e, 1000);
      const kinds = async () =>
        (await asService(() => q<{ enrollment_id: string; kind: string }>('select * from public.academy_claim_reminders(1000)')))
          .filter((r) => r.enrollment_id === e)
          .map((r) => r.kind);
      expect(await kinds()).toEqual(['due_soon']);
      await as(db, admin, () => q(`select public.academy_grant_extension($1, 1, current_date + 3, '')`, [e]));
      expect(await kinds()).toEqual(['due_soon']);
    });

    it('réservé au serveur', async () => {
      expect(await errorOf(as(db, admin, () => q('select * from public.academy_claim_reminders(10)')))).toMatch(/permission denied/);
      expect(await errorOf(as(db, admin, () => q('select * from public.academy_reminders')))).toMatch(/permission denied/);
    });
  });

  // ---------------------------------------------------------------------------
  describe('Commissions', () => {
    let session: string;
    let e: string;
    let code: string;

    beforeAll(async () => {
      code = await as(db, amb, () => q<{ code: string }>('select code from public.ambassadors where user_id = auth.uid()')).then(
        (r) => r[0].code,
      );
      session = await setup([60000, 40000], [0, 30], 10);
      const student = await createUser(db, { meta: { first_name: 'Awa', last_name: 'Ngono' } });
      e = await enroll(student, session, code);
      await pay(e, 60000);
    });

    const row = (user: string) =>
      as(db, user, () =>
        q<{ earned: string; due: string; amount: string; student_label: string; fully_paid: boolean }>(
          'select * from public.academy_commissions where enrollment_id = $1',
          [e],
        ),
      );

    it('rien n’est dû tant que la formation n’est pas entièrement payée', async () => {
      const [r] = await row(amb);
      expect(Number(r.amount)).toBe(10000);
      expect(Number(r.earned)).toBe(0);
      expect(r.student_label).toBe('Awa N.');
      expect(
        await errorOf(as(db, admin, () => q(`select public.academy_record_commission_payout($1, 1000, 'Orange Money')`, [e]))),
      ).toMatch(/payout_exceeds_due/);
    });

    it('formation payée : commission due, payée puis confirmée par l’ambassadeur', async () => {
      await pay(e, 40000);
      expect(Number((await row(amb))[0].due)).toBe(10000);
      expect(await row(outsider)).toHaveLength(0);

      await as(db, admin, () => q(`select public.academy_record_commission_payout($1, 6000, 'Orange Money', 'TX1')`, [e]));
      expect(Number((await row(amb))[0].due)).toBe(4000);
      expect(
        await errorOf(as(db, admin, () => q(`select public.academy_record_commission_payout($1, 5000, 'Orange Money')`, [e]))),
      ).toMatch(/payout_exceeds_due/);

      const [p] = await as(db, amb, () => q<{ id: string }>('select id from public.academy_commission_payouts where enrollment_id = $1', [e]));
      expect(await errorOf(as(db, outsider, () => q('select public.academy_confirm_commission_payout($1)', [p.id])))).toMatch(/not_found/);
      await as(db, amb, () => q('select public.academy_confirm_commission_payout($1)', [p.id]));
      const [c] = await as(db, amb, () => q<{ confirmed: string }>('select confirmed from public.academy_commissions where enrollment_id = $1', [e]));
      expect(Number(c.confirmed)).toBe(6000);
    });

    it('seul l’admin enregistre un paiement de commission', async () => {
      expect(
        await errorOf(as(db, amb, () => q(`select public.academy_record_commission_payout($1, 1000, 'Orange Money')`, [e]))),
      ).toMatch(/forbidden/);
    });
  });

  // ---------------------------------------------------------------------------
  describe('Évaluation finale et attestation', () => {
    let session: string;
    let student: string;
    let e: string;
    let q1: string;
    let q2: string;

    beforeAll(async () => {
      session = await setup([50000, 50000], [0, 30], 0);
      student = await createUser(db, { meta: { first_name: 'Paul', last_name: 'Biya' } });
      e = await enroll(student, session);
      await pay(e, 50000);
      await as(db, admin, () =>
        q(`select public.academy_save_evaluation($1, 'Évaluation finale', '', 'Lisez bien', '', 'fr', 60, 2)`, [session]),
      );
      q1 = await as(db, admin, () =>
        q<{ id: string }>(
          `select public.academy_save_question($1, null, 'Qu’est-ce qu’un stop loss ?', '', 'fr', false, 2,
             '[{"label_fr":"Un ordre de protection","correct":true},{"label_fr":"Un indicateur"}]'::jsonb) as id`,
          [session],
        ),
      ).then((r) => r[0].id);
      q2 = await as(db, admin, () =>
        q<{ id: string }>(
          `select public.academy_save_question($1, null, 'Quels sont des actifs ?', '', 'fr', true, 1,
             '[{"label_fr":"BTC","correct":true},{"label_fr":"ETH","correct":true},{"label_fr":"RSI"}]'::jsonb) as id`,
          [session],
        ),
      ).then((r) => r[0].id);
    });

    const submit = (user: string, answers: Record<string, number[]>) =>
      as(db, user, () =>
        q<{ attempt_no: number; score: number; max_score: number; percent: string; passed: boolean; certificate_id: string | null }>(
          'select * from public.academy_submit_evaluation($1, $2::jsonb)',
          [session, JSON.stringify(answers)],
        ),
      ).then((r) => r[0]);

    it('une question mal formée est refusée', async () => {
      const bad = `select public.academy_save_question($1, null, 'Question ?', '', 'fr', false, 1, $2::jsonb)`;
      expect(await errorOf(as(db, admin, () => q(bad, [session, '[{"label_fr":"A","correct":true},{"label_fr":"B","correct":true}]'])))).toMatch(
        /question_invalid/,
      );
      expect(await errorOf(as(db, admin, () => q(bad, [session, '[{"label_fr":"A","correct":true}]'])))).toMatch(/question_invalid/);
      expect(await errorOf(as(db, admin, () => q(bad, [session, '[{"label_fr":"A"},{"label_fr":"B"}]'])))).toMatch(/question_invalid/);
    });

    it('les étudiants ne voient jamais les bonnes réponses', async () => {
      expect(await errorOf(as(db, student, () => q('select public.academy_evaluation_paper($1)', [session])))).toMatch(/evaluation_closed/);
      expect(await errorOf(as(db, admin, () => q(`select public.academy_set_evaluation_status($1, 'open')`, [session])))).toBeNull();

      expect(await as(db, student, () => q('select * from public.academy_questions'))).toHaveLength(0);
      const [{ paper }] = await as(db, student, () => q<{ paper: unknown }>('select public.academy_evaluation_paper($1) as paper', [session]));
      const text = JSON.stringify(paper);
      expect(text).toContain('stop loss');
      expect(text).not.toContain('correct');
      expect(await errorOf(as(db, outsider, () => q('select public.academy_evaluation_paper($1)', [session])))).toMatch(/forbidden/);
    });

    it('correction par la base ; tentative ratée ; questions figées', async () => {
      const r = await submit(student, { [q1]: [1], [q2]: [0, 1] });
      expect(r).toMatchObject({ attempt_no: 1, score: 1, max_score: 3, passed: false });
      expect(
        await errorOf(
          as(db, admin, () =>
            q(`select public.academy_save_question($1, $2, 'Modifiée ?', '', 'fr', false, 1, '[{"label_fr":"A","correct":true},{"label_fr":"B"}]'::jsonb)`, [
              session,
              q1,
            ]),
          ),
        ),
      ).toMatch(/evaluation_locked/);
      expect(await errorOf(as(db, admin, () => q('select public.academy_delete_question($1)', [q1])))).toMatch(/evaluation_locked/);
    });

    it('réussite sans tout payer : pas d’attestation ; dernier paiement : attestation automatique', async () => {
      const r = await submit(student, { [q1]: [0], [q2]: [1, 0] });
      expect(r).toMatchObject({ attempt_no: 2, score: 3, passed: true, certificate_id: null });
      expect(await errorOf(submit(student, { [q1]: [0] }))).toMatch(/evaluation_already_passed/);

      await pay(e, 50000);
      const certs = await as(db, student, () =>
        q<{ number: string; student_name: string; score_percent: string }>('select number, student_name, score_percent from public.academy_certificates'),
      );
      expect(certs).toHaveLength(1);
      expect(certs[0].number).toMatch(/^CSC-\d{4}-\d{5}-[0-9A-F]{4}$/);
      expect(certs[0].student_name).toBe('Paul Biya');
      expect(Number(certs[0].score_percent)).toBe(100);
      expect(await as(db, outsider, () => q('select * from public.academy_certificates'))).toHaveLength(0);
    });

    it('vérification publique, puis retrait par l’admin', async () => {
      const [{ id, number }] = await as(db, admin, () =>
        q<{ id: string; number: string }>('select id, number from public.academy_certificates where enrollment_id = $1', [e]),
      );
      const verify = (n: string) =>
        as(db, null, () => q<{ student_name: string; revoked: boolean }>('select * from public.academy_verify_certificate($1)', [n]));
      expect((await verify(` ${number.toLowerCase()} `))[0]).toMatchObject({ student_name: 'Paul Biya', revoked: false });
      expect(await verify('CSC-2026-00001-0000')).toHaveLength(0);

      expect(await errorOf(as(db, admin, () => q(`select public.academy_revoke_certificate($1, '')`, [id])))).toMatch(/reason_required/);
      await as(db, admin, () => q(`select public.academy_revoke_certificate($1, 'Fraude constatée')`, [id]));
      expect((await verify(number))[0].revoked).toBe(true);
    });

    it('tentatives limitées et accès bloqué', async () => {
      const other = await createUser(db);
      const e2 = await enroll(other, session);
      await pay(e2, 50000);
      await submit(other, {});
      await submit(other, {});
      expect(await errorOf(submit(other, {}))).toMatch(/attempts_exhausted/);

      const late = await setup([10000, 10000], [-10, 30], 0);
      const lateStudent = await createUser(db);
      const e3 = await enroll(lateStudent, late);
      await pay(e3, 5000);
      await as(db, admin, () => q(`select public.academy_save_evaluation($1, 'Évaluation', '', '', '', 'fr', 50, 1)`, [late]));
      await as(db, admin, () =>
        q(`select public.academy_save_question($1, null, 'Question ?', '', 'fr', false, 1, '[{"label_fr":"A","correct":true},{"label_fr":"B"}]'::jsonb)`, [late]),
      );
      await as(db, admin, () => q(`select public.academy_set_evaluation_status($1, 'open')`, [late]));
      expect(
        await errorOf(as(db, lateStudent, () => q(`select * from public.academy_submit_evaluation($1, '{}'::jsonb)`, [late]))),
      ).toMatch(/access_blocked/);
      expect(await errorOf(as(db, lateStudent, () => q('select public.academy_evaluation_paper($1)', [late])))).toMatch(/forbidden/);
    });

    it('ouvrir une évaluation sans question est refusé', async () => {
      const empty = await setup([10000], [30], 0);
      await as(db, admin, () => q(`select public.academy_save_evaluation($1, 'Vide', '', '', '', 'fr', 50, 1)`, [empty]));
      expect(await errorOf(as(db, admin, () => q(`select public.academy_set_evaluation_status($1, 'open')`, [empty])))).toMatch(
        /evaluation_empty/,
      );
      expect(await errorOf(as(db, outsider, () => q(`select public.academy_save_evaluation($1, 'Pirate', '', '', '', 'fr', 50, 1)`, [empty])))).toMatch(
        /forbidden/,
      );
    });
  });
});
