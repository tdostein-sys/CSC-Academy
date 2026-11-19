import { beforeAll, describe, expect, it } from 'vitest';
import { as, createTestDb, createUser, errorOf, type TestDb } from './harness';

/**
 * Page Contact : envoi de messages (visiteur ou membre), anti-abus, lecture
 * réservée à l'admin et à l'auteur, coordonnées modifiables par l'admin seul.
 */
describe('Contact', () => {
  let db: TestDb;
  let admin: string;
  let n = 0;

  const q = <T = Record<string, unknown>>(sql: string, params: unknown[] = []) =>
    db.query<T>(sql, params).then((r) => r.rows);

  const submit = (
    user: string | null,
    over: Partial<{ name: string; email: string; phone: string; subject: string; message: string; enrollment: string | null }> = {},
  ) => {
    const d = { name: 'Awa Ndiaye', email: `awa${++n}@test.local`, phone: '+237690000000', subject: 'payment', message: 'Bonjour, je veux payer ma tranche.', enrollment: null, ...over };
    return as(db, user, () =>
      q<{ id: string }>('select public.contact_submit($1, $2, $3, $4, $5, $6, $7) as id', [d.name, d.email, d.phone, d.subject, d.message, d.enrollment, 'fr']),
    ).then((r) => r[0].id);
  };

  beforeAll(async () => {
    db = await createTestDb();
    admin = await createUser(db, { username: 'csc_admin', admin: true });
  });

  it('coordonnées publiques, vides au départ ; texte d’accueil créé', async () => {
    const rows = await as(db, null, () => q<{ whatsapp: string; email: string }>('select whatsapp, phone, email from public.contact_settings'));
    expect(rows).toEqual([{ whatsapp: '', phone: '', email: '' }]);
    const content = await as(db, null, () => q<{ key: string }>(`select key from public.site_content where key = 'contact_page'`));
    expect(content).toHaveLength(1);
  });

  it('un visiteur non connecté peut envoyer un message, mais pas le relire', async () => {
    const id = await submit(null);
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect(await errorOf(as(db, null, () => q('select id from public.contact_requests')))).toMatch(/permission denied/);
    const [row] = await as(db, admin, () => q<{ user_id: string | null; status: string; email: string }>('select user_id, status, email from public.contact_requests where id = $1', [id]));
    expect(row.user_id).toBeNull();
    expect(row.status).toBe('new');
  });

  it('champs contrôlés : nom, e-mail, téléphone, sujet, longueur du message', async () => {
    expect(await errorOf(submit(null, { name: 'A' }))).toContain('contact_invalid');
    expect(await errorOf(submit(null, { email: 'pas-un-email' }))).toContain('contact_invalid');
    expect(await errorOf(submit(null, { phone: '690000000' }))).toContain('contact_invalid');
    expect(await errorOf(submit(null, { subject: 'spam' }))).toContain('contact_invalid');
    expect(await errorOf(submit(null, { message: 'court' }))).toContain('contact_invalid');
    expect(await errorOf(submit(null, { message: 'x'.repeat(2001) }))).toContain('contact_invalid');
    // Téléphone facultatif ; e-mail mis en minuscules.
    const id = await submit(null, { phone: '', email: 'Awa.MAJ@Test.Local' });
    const [row] = await as(db, admin, () => q<{ email: string; phone: string }>('select email, phone from public.contact_requests where id = $1', [id]));
    expect(row).toEqual({ email: 'awa.maj@test.local', phone: '' });
  });

  it('anti-abus : 3 messages par heure et par adresse e-mail', async () => {
    const email = 'flood@test.local';
    for (let i = 0; i < 3; i++) await submit(null, { email });
    expect(await errorOf(submit(null, { email }))).toContain('contact_rate_limited');
  });

  it('membre connecté : message rattaché à son compte et à SA propre inscription seulement', async () => {
    const course = await as(db, admin, () =>
      q<{ id: string }>(`insert into public.academy_courses (title_fr, status) values ('Contact test', 'published') returning id`),
    ).then((r) => r[0].id);
    const session = await as(db, admin, () =>
      q<{ id: string }>(
        `insert into public.academy_sessions (course_id, label_fr, starts_on, ends_on, seats)
         values ($1, 'Session', current_date, current_date + 60, 10) returning id`,
        [course],
      ),
    ).then((r) => r[0].id);
    await as(db, admin, () => q(`select public.academy_set_installments($1, array[50000]::bigint[], array[current_date + 30]::date[])`, [session]));
    await as(db, admin, () => q('select public.academy_set_enrollment_open($1, true)', [session]));

    const student = await createUser(db);
    const other = await createUser(db);
    const mine = await as(db, student, () => q<{ id: string }>('select public.academy_enroll($1, null) as id', [session])).then((r) => r[0].id);
    const theirs = await as(db, other, () => q<{ id: string }>('select public.academy_enroll($1, null) as id', [session])).then((r) => r[0].id);

    const ok = await submit(student, { enrollment: mine });
    const forged = await submit(student, { enrollment: theirs });
    const rows = await as(db, student, () =>
      q<{ id: string; user_id: string; enrollment_id: string | null }>('select id, user_id, enrollment_id from public.contact_requests order by created_at'),
    );
    expect(rows.map((r) => r.id).sort()).toEqual([ok, forged].sort());
    expect(rows.find((r) => r.id === ok)?.enrollment_id).toBe(mine);
    expect(rows.find((r) => r.id === forged)?.enrollment_id).toBeNull();
    expect(rows.every((r) => r.user_id === student)).toBe(true);

    // Un autre membre ne voit pas ces messages ; écriture directe interdite.
    expect(await as(db, other, () => q('select id from public.contact_requests where user_id = $1', [student]))).toHaveLength(0);
    expect(await errorOf(as(db, student, () => q(`update public.contact_requests set status = 'done' where id = $1`, [ok])))).toMatch(/permission denied/);
    expect(await errorOf(as(db, student, () => q(`insert into public.contact_requests (name, email, subject, message) values ('x', 'x@y.z', 'other', 'xxxxxxxxxxxx')`)))).toMatch(/permission denied/);
  });

  it('suivi : statut et note par l’admin uniquement', async () => {
    const member = await createUser(db);
    const id = await submit(member);
    expect(await errorOf(as(db, member, () => q(`select public.contact_update_request($1, 'done', 'ok')`, [id])))).toContain('forbidden');
    expect(await errorOf(as(db, admin, () => q(`select public.contact_update_request($1, 'archived', null)`, [id])))).toContain('contact_invalid');
    await as(db, admin, () => q(`select public.contact_update_request($1, 'in_progress', 'Rappelé sur WhatsApp')`, [id]));
    const [row] = await as(db, admin, () =>
      q<{ status: string; admin_note: string; handled_by: string }>('select status, admin_note, handled_by from public.contact_requests where id = $1', [id]),
    );
    expect(row).toEqual({ status: 'in_progress', admin_note: 'Rappelé sur WhatsApp', handled_by: admin });
  });

  it('coordonnées : modifiables par l’admin seul, formats contrôlés', async () => {
    const member = await createUser(db);
    expect(await errorOf(as(db, member, () => q(`select public.contact_update_settings('+237690000000', '', 'csc@test.local')`)))).toContain('forbidden');
    expect(await errorOf(as(db, admin, () => q(`select public.contact_update_settings('690000000', '', '')`)))).toContain('contact_invalid');
    expect(await errorOf(as(db, admin, () => q(`select public.contact_update_settings('', '', 'pas-un-email')`)))).toContain('contact_invalid');
    await as(db, admin, () => q(`select public.contact_update_settings('+237690000000', '+237222000000', 'Contact@CSC.test')`));
    const rows = await as(db, null, () => q('select whatsapp, phone, email from public.contact_settings'));
    expect(rows).toEqual([{ whatsapp: '+237690000000', phone: '+237222000000', email: 'contact@csc.test' }]);
    expect(await errorOf(as(db, null, () => q(`update public.contact_settings set whatsapp = '+1555'`)))).toMatch(/permission denied/);
  });
});
