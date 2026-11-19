import { beforeAll, describe, expect, it } from 'vitest';
import { as, createTestDb, createUser, errorOf, type TestDb } from './harness';

/**
 * CSC Academy — replays : un seul visionnage par étudiant et par
 * enregistrement, reprise possible pendant la durée réglée, réinitialisation
 * par l'administrateur. Vérifié sur les vraies migrations.
 */
describe('CSC Academy — replays', () => {
  let db: TestDb;
  let admin: string;
  let outsider: string;
  let session: string;
  let counter = 0;

  const q = <T = Record<string, unknown>>(sql: string, params: unknown[] = []) =>
    db.query<T>(sql, params).then((r) => r.rows);

  const asService = async <T,>(fn: () => Promise<T>) => {
    await db.exec('set role service_role');
    try {
      return await fn();
    } finally {
      await db.exec('reset role');
    }
  };

  async function setup(amounts: number[], offsets: number[]) {
    const course = await as(db, admin, () =>
      q<{ id: string }>(`insert into public.academy_courses (title_fr, status) values ('Replay test', 'published') returning id`),
    ).then((r) => r[0].id);
    const s = await as(db, admin, () =>
      q<{ id: string }>(
        `insert into public.academy_sessions (course_id, label_fr, starts_on, ends_on, seats)
         values ($1, 'Session replay', current_date - 30, current_date + 90, 50) returning id`,
        [course],
      ),
    ).then((r) => r[0].id);
    const dates = offsets.map((d) => `current_date + (${d})`);
    await as(db, admin, () => q(`select public.academy_set_installments($1, $2::bigint[], array[${dates.join(',')}]::date[])`, [s, amounts]));
    await as(db, admin, () => q('select public.academy_set_enrollment_open($1, true)', [s]));
    return s;
  }

  const enroll = (user: string, s: string) =>
    as(db, user, () => q<{ id: string }>('select public.academy_enroll($1, null) as id', [s])).then((r) => r[0].id);
  const pay = (enrollment: string, amount: number) =>
    as(db, admin, () => q(`select public.academy_record_payment($1, $2, 'Orange Money', 'REF')`, [enrollment, amount]));

  /** Enregistrement prêt d'une séance de la session. */
  async function recording(s = session) {
    const m = await as(db, admin, () =>
      q<{ id: string }>(
        `insert into public.academy_meetings (session_id, title_fr, starts_at, duration_minutes)
         values ($1, 'Séance', now() - interval '2 hours', 60) returning id`,
        [s],
      ),
    ).then((r) => r[0].id);
    const egress = `EG_R${++counter}`;
    const [{ id }] = await asService(() => q<{ id: string }>(`select public.academy_recording_started($1, $2, 'recordings/r.mp4') as id`, [m, egress]));
    await asService(() => q(`select public.academy_recording_finished($1, true, 3600, 1000)`, [egress]));
    return id;
  }

  const access = (user: string, rec: string, start = false) =>
    as(db, user, () => q<{ state: string; expires_at: string | null }>('select * from public.academy_replay_access($1, $2)', [rec, start])).then((r) => r[0]);

  /** Fait comme si le visionnage avait commencé il y a plus longtemps que sa durée. */
  const expireView = (rec: string, user: string) =>
    q(`update public.academy_replay_views set started_at = now() - interval '3 hours', expires_at = now() - interval '1 minute'
        where recording_id = $1 and user_id = $2 and reset_at is null`, [rec, user]);

  async function paidStudent(s = session) {
    const u = await createUser(db);
    await pay(await enroll(u, s), 50000);
    return u;
  }

  beforeAll(async () => {
    db = await createTestDb();
    admin = await createUser(db, { username: 'csc_admin', admin: true });
    outsider = await createUser(db, { email: 'outsider-replay@test.local' });
    session = await setup([50000], [30]);
  });

  it('premier visionnage : créé au clic, ouvert pendant 2 h par défaut', async () => {
    const student = await paidStudent();
    const rec = await recording();

    expect(await access(student, rec)).toEqual({ state: 'available', expires_at: null });
    // Consulter l'état ne crée rien.
    expect(await q('select 1 from public.academy_replay_views where recording_id = $1', [rec])).toHaveLength(0);

    const started = await access(student, rec, true);
    expect(started.state).toBe('active');
    const [{ hours }] = await q<{ hours: number }>(
      'select round(extract(epoch from expires_at - started_at) / 3600) as hours from public.academy_replay_views where recording_id = $1',
      [rec],
    );
    expect(Number(hours)).toBe(2);
  });

  it('reprise pendant le délai : même visionnage, même heure de fin', async () => {
    const student = await paidStudent();
    const rec = await recording();
    const first = await access(student, rec, true);

    const resumed = await access(student, rec, true);
    const viewed = await access(student, rec);
    expect(resumed).toEqual(first);
    expect(viewed).toEqual(first);
    expect(await q('select 1 from public.academy_replay_views where recording_id = $1 and user_id = $2', [rec, student])).toHaveLength(1);
  });

  it('délai écoulé : « déjà visionné », nouveau visionnage refusé', async () => {
    const student = await paidStudent();
    const rec = await recording();
    await access(student, rec, true);
    await expireView(rec, student);

    expect((await access(student, rec)).state).toBe('watched');
    expect(await errorOf(access(student, rec, true))).toContain('replay_already_watched');
    expect(await q('select 1 from public.academy_replay_views where recording_id = $1 and user_id = $2', [rec, student])).toHaveLength(1);
  });

  it('refuse inconnu, inscription non payée et étudiant bloqué', async () => {
    const rec = await recording();
    expect(await errorOf(access(outsider, rec, true))).toContain('forbidden');

    const pending = await createUser(db);
    await enroll(pending, session);
    expect(await errorOf(access(pending, rec, true))).toContain('forbidden');

    // Tranche 1 échue depuis 10 jours et incomplète : bloqué (J+3).
    const late = await setup([40000, 30000], [-10, 30]);
    const lateStudent = await createUser(db);
    await pay(await enroll(lateStudent, late), 10000);
    const lateRec = await recording(late);
    expect(await errorOf(access(lateStudent, lateRec, true))).toContain('access_blocked');
    expect(await q('select 1 from public.academy_replay_views where user_id = $1', [lateStudent])).toHaveLength(0);
  });

  it('étudiant bloqué en cours de visionnage : la reprise est refusée', async () => {
    const late = await setup([40000, 30000], [30, 60]);
    const student = await createUser(db);
    const e = await enroll(student, late);
    await pay(e, 40000);
    const rec = await recording(late);
    await access(student, rec, true);
    // La 2e tranche passe en retard de plus de 3 jours.
    await q(`update public.academy_installments set due_on = current_date - 10 where session_id = $1 and rank = 2`, [late]);
    expect(await errorOf(access(student, rec))).toContain('access_blocked');
  });

  it('enregistrement expiré ou supprimé : introuvable', async () => {
    const student = await paidStudent();
    const rec = await recording();
    await q(`update public.academy_recordings set expires_at = now() - interval '1 minute' where id = $1`, [rec]);
    expect(await errorOf(access(student, rec, true))).toContain('not_found');
  });

  it('l’admin regarde sans limite et sans visionnage enregistré', async () => {
    const rec = await recording();
    const a = await access(admin, rec, true);
    expect(a.state).toBe('admin');
    expect(await q('select 1 from public.academy_replay_views where recording_id = $1', [rec])).toHaveLength(0);
  });

  it('réinitialisation par l’admin : nouveau visionnage possible, historique conservé', async () => {
    const student = await paidStudent();
    const rec = await recording();
    await access(student, rec, true);
    await expireView(rec, student);

    expect(await errorOf(as(db, student, () => q('select public.academy_reset_replay_view($1, $2)', [rec, student])))).toContain('forbidden');
    await as(db, admin, () => q('select public.academy_reset_replay_view($1, $2)', [rec, student]));
    expect((await access(student, rec)).state).toBe('available');
    expect((await access(student, rec, true)).state).toBe('active');
    const rows = await q<{ reset_at: string | null }>('select reset_at from public.academy_replay_views where recording_id = $1 and user_id = $2 order by started_at', [rec, student]);
    expect(rows).toHaveLength(2);
    expect(rows[0].reset_at).not.toBeNull();
    expect(rows[1].reset_at).toBeNull();
    // Rien à réinitialiser : refus explicite.
    expect(await errorOf(as(db, admin, () => q('select public.academy_reset_replay_view($1, $2)', [rec, outsider])))).toContain('not_found');
  });

  it('durée réglable par l’admin seulement (1 à 48 h)', async () => {
    expect(await errorOf(as(db, outsider, () => q('select public.academy_set_replay_view_hours(5)')))).toContain('forbidden');
    expect(await errorOf(as(db, admin, () => q('select public.academy_set_replay_view_hours(0)')))).toContain('amount_invalid');
    await as(db, admin, () => q('select public.academy_set_replay_view_hours(5)'));

    const student = await paidStudent();
    const rec = await recording();
    await access(student, rec, true);
    const [{ hours }] = await q<{ hours: number }>(
      'select round(extract(epoch from expires_at - started_at) / 3600) as hours from public.academy_replay_views where recording_id = $1',
      [rec],
    );
    expect(Number(hours)).toBe(5);
    await as(db, admin, () => q('select public.academy_set_replay_view_hours(2)'));
  });

  it('visionnages : chacun voit les siens, écriture directe interdite', async () => {
    const a = await paidStudent();
    const b = await paidStudent();
    const rec = await recording();
    await access(a, rec, true);
    expect(await as(db, a, () => q('select id from public.academy_replay_views where recording_id = $1', [rec]))).toHaveLength(1);
    expect(await as(db, b, () => q('select id from public.academy_replay_views where recording_id = $1', [rec]))).toHaveLength(0);
    expect(await errorOf(as(db, b, () => q(`delete from public.academy_replay_views where recording_id = $1`, [rec])))).toMatch(/permission denied/);
    expect(
      await errorOf(as(db, a, () => q(`update public.academy_replay_views set expires_at = now() + interval '9 days' where recording_id = $1`, [rec]))),
    ).toMatch(/permission denied/);
  });
});
