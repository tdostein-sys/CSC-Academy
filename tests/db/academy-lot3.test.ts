import { beforeAll, describe, expect, it } from 'vitest';
import { as, createTestDb, createUser, errorOf, type TestDb } from './harness';

/**
 * CSC Academy — lot 3 : salles de visio, présences et enregistrements,
 * vérifiés sur les vraies migrations et sous l'identité de chaque rôle.
 */
describe('CSC Academy — lot 3', () => {
  let db: TestDb;
  let admin: string;
  let outsider: string;
  let session: string;

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

  /** Session avec échéancier ; `offsets` = échéances en jours depuis aujourd'hui. */
  async function setup(amounts: number[], offsets: number[]) {
    const course = await as(db, admin, () =>
      q<{ id: string }>(`insert into public.academy_courses (title_fr, status) values ('Visio test', 'published') returning id`),
    ).then((r) => r[0].id);
    const s = await as(db, admin, () =>
      q<{ id: string }>(
        `insert into public.academy_sessions (course_id, label_fr, starts_on, ends_on, seats)
         values ($1, 'Session visio', current_date - 30, current_date + 90, 50) returning id`,
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

  /** Séance commençant dans `minutes` minutes (négatif = déjà commencée). */
  const meeting = (minutes: number, external: string | null = null, s = session) =>
    as(db, admin, () =>
      q<{ id: string }>(
        `insert into public.academy_meetings (session_id, title_fr, starts_at, duration_minutes, external_url)
         values ($1, 'Séance', now() + make_interval(mins => $2), 60, $3) returning id`,
        [s, minutes, external],
      ),
    ).then((r) => r[0].id);

  const open = (user: string, m: string) => as(db, user, () => q<{ room: string }>('select public.academy_open_live_room($1) as room', [m]));
  const join = (user: string, m: string) =>
    as(db, user, () => q<{ room_name: string; is_host: boolean; ends_at: string; display_name: string }>('select * from public.academy_join_meeting($1)', [m]));

  beforeAll(async () => {
    db = await createTestDb();
    admin = await createUser(db, { username: 'csc_admin', admin: true });
    outsider = await createUser(db, { email: 'outsider-l3@test.local' });
    session = await setup([50000], [30]);
  });

  // ---------------------------------------------------------------------------
  describe('Ouverture de la salle', () => {
    it('réservée à l’admin, dans le créneau (1 h avant → fin prévue)', async () => {
      const m = await meeting(30);
      expect(await errorOf(open(outsider, m))).toContain('forbidden');
      expect((await open(admin, m))[0].room).toBe(`csc-academy-${m}`);

      expect(await errorOf(open(admin, await meeting(90)))).toContain('meeting_too_early');
      expect(await errorOf(open(admin, await meeting(-61)))).toContain('meeting_over');
      expect(await errorOf(open(admin, await meeting(0, 'https://meet.google.com/abc')))).toContain('meeting_external');
    });

    it('fermeture puis réouverture', async () => {
      const m = await meeting(0);
      await open(admin, m);
      expect(await errorOf(as(db, outsider, () => q('select public.academy_close_live_room($1)', [m])))).toContain('forbidden');
      await as(db, admin, () => q('select public.academy_close_live_room($1)', [m]));
      const closed = await q<{ closed_at: string | null }>('select closed_at from public.academy_live_rooms where meeting_id = $1', [m]);
      expect(closed[0].closed_at).not.toBeNull();
      await open(admin, m);
      const reopened = await q<{ closed_at: string | null }>('select closed_at from public.academy_live_rooms where meeting_id = $1', [m]);
      expect(reopened[0].closed_at).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  describe('Entrée dans la salle', () => {
    it('étudiant à jour : entre une fois la salle ouverte, présence enregistrée', async () => {
      const student = await createUser(db);
      await pay(await enroll(student, session), 50000);
      const m = await meeting(-5);

      expect(await errorOf(join(student, m))).toContain('meeting_not_live');
      await open(admin, m);
      const [r] = await join(student, m);
      expect(r.is_host).toBe(false);
      expect(r.room_name).toBe(`csc-academy-${m}`);
      expect(r.display_name).toMatch(/^Prenom Nom/);
      await join(student, m);

      const att = await as(db, student, () => q<{ joins: number }>('select joins from public.academy_meeting_attendance where meeting_id = $1', [m]));
      expect(att).toEqual([{ joins: 2 }]);
      // La salle est visible de l'étudiant, pas d'un inconnu.
      expect(await as(db, student, () => q('select meeting_id from public.academy_live_rooms where meeting_id = $1', [m]))).toHaveLength(1);
      expect(await as(db, outsider, () => q('select meeting_id from public.academy_live_rooms where meeting_id = $1', [m]))).toHaveLength(0);

      await as(db, admin, () => q('select public.academy_close_live_room($1)', [m]));
      expect(await errorOf(join(student, m))).toContain('meeting_not_live');
    });

    it('l’admin entre comme animateur, sans présence enregistrée', async () => {
      const m = await meeting(10);
      await open(admin, m);
      const [r] = await join(admin, m);
      expect(r.is_host).toBe(true);
      expect(await q('select 1 from public.academy_meeting_attendance where meeting_id = $1', [m])).toHaveLength(0);
    });

    it('refuse inconnu, inscription non payée, étudiant bloqué, séance terminée', async () => {
      const m = await meeting(-10);
      await open(admin, m);
      expect(await errorOf(join(outsider, m))).toContain('forbidden');

      const pending = await createUser(db);
      await enroll(pending, session);
      expect(await errorOf(join(pending, m))).toContain('forbidden');

      // Tranche 1 échue depuis 10 jours et incomplète : bloqué (J+3).
      const late = await setup([40000, 30000], [-10, 30]);
      const lateStudent = await createUser(db);
      await pay(await enroll(lateStudent, late), 10000);
      const lm = await meeting(-10, null, late);
      await open(admin, lm);
      expect(await errorOf(join(lateStudent, lm))).toContain('access_blocked');

      // Séance commencée il y a 2 h (fin prévue + 30 min dépassée).
      const student = await createUser(db);
      await pay(await enroll(student, session), 50000);
      const old = await meeting(-120);
      await q(`insert into public.academy_live_rooms (meeting_id, session_id, room_name) values ($1, $2, $3)`, [old, session, `csc-academy-${old}`]);
      expect(await errorOf(join(student, old))).toContain('meeting_over');
    });

    it('fermeture automatique par le serveur uniquement', async () => {
      const m = await meeting(0);
      const [{ room }] = await open(admin, m);
      expect(await errorOf(as(db, admin, () => q('select public.academy_live_room_finished($1)', [room])))).toMatch(/permission denied/);
      await asService(() => q('select public.academy_live_room_finished($1)', [room]));
      const r = await q<{ closed_at: string | null }>('select closed_at from public.academy_live_rooms where meeting_id = $1', [m]);
      expect(r[0].closed_at).not.toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  describe('Enregistrements', () => {
    it('déclarés par le serveur seulement, visibles des inscrits une fois prêts, jusqu’à expiration', async () => {
      const student = await createUser(db);
      await pay(await enroll(student, session), 50000);
      const m = await meeting(0);

      expect(
        await errorOf(as(db, admin, () => q(`select public.academy_recording_started($1, 'EG_x', 'recordings/x.mp4')`, [m]))),
      ).toMatch(/permission denied/);

      const [{ id }] = await asService(() => q<{ id: string }>(`select public.academy_recording_started($1, 'EG_1', 'recordings/1.mp4') as id`, [m]));
      // Doublon (même enregistrement LiveKit) : ignoré.
      const [{ id: dup }] = await asService(() => q<{ id: string | null }>(`select public.academy_recording_started($1, 'EG_1', 'recordings/1.mp4') as id`, [m]));
      expect(dup).toBeNull();

      const visible = () =>
        as(db, student, () => q<{ id: string }>('select id, status, expires_at from public.academy_recordings where meeting_id = $1', [m]));
      expect(await visible()).toHaveLength(0); // encore en cours

      await asService(() => q(`select public.academy_recording_finished('EG_1', true, 3540, 700000000)`));
      expect((await visible()).map((r) => r.id)).toEqual([id]);
      // Chemin du fichier et identifiant LiveKit : jamais lisibles.
      expect(await errorOf(as(db, student, () => q('select object_key from public.academy_recordings')))).toMatch(/permission denied/);
      expect(await errorOf(as(db, student, () => q('select egress_id from public.academy_recordings')))).toMatch(/permission denied/);
      expect(await as(db, outsider, () => q('select id from public.academy_recordings where meeting_id = $1', [m]))).toHaveLength(0);

      const r = await q<{ days: number }>(`select round(extract(epoch from expires_at - now()) / 86400) as days from public.academy_recordings where id = $1`, [id]);
      expect(Number(r[0].days)).toBe(7);

      // Expiration : invisible, puis listée pour effacement, puis marquée supprimée.
      await q(`update public.academy_recordings set expires_at = now() - interval '1 minute' where id = $1`, [id]);
      expect(await visible()).toHaveLength(0);
      const expired = await asService(() => q<{ id: string; object_key: string }>('select * from public.academy_expired_recordings(10)'));
      expect(expired).toContainEqual({ id, object_key: 'recordings/1.mp4' });
      await asService(() => q('select public.academy_mark_recording_deleted($1)', [id]));
      const after = await asService(() => q<{ id: string }>('select * from public.academy_expired_recordings(10)'));
      expect(after.map((x) => x.id)).not.toContain(id);
    });

    it('suppression anticipée : admin uniquement', async () => {
      const m = await meeting(0);
      const [{ id }] = await asService(() => q<{ id: string }>(`select public.academy_recording_started($1, 'EG_2', 'recordings/2.mp4') as id`, [m]));
      await asService(() => q(`select public.academy_recording_finished('EG_2', false)`));
      expect((await q<{ status: string }>('select status from public.academy_recordings where id = $1', [id]))[0].status).toBe('failed');

      expect(await errorOf(as(db, outsider, () => q('select public.academy_expire_recording($1)', [id])))).toContain('forbidden');
      await as(db, admin, () => q('select public.academy_expire_recording($1)', [id]));
      const expired = await asService(() => q<{ id: string }>('select * from public.academy_expired_recordings(10)'));
      expect(expired.map((x) => x.id)).toContain(id);
    });
  });
});
