import { beforeAll, describe, expect, it } from 'vitest';
import { as, createTestDb, createUser, errorOf, type TestDb } from './harness';

/**
 * CSC Consulting — lot C1 : créneaux, réservation, paiement, expiration,
 * annulation, report, remboursement, visio, rappels et comptes rendus,
 * vérifiés sur les vraies migrations et sous l'identité de chaque rôle.
 */
describe('CSC Consulting', () => {
  let db: TestDb;
  let admin: string;
  let advisor: string;
  let other: string;
  let paidOffer: string;
  let freeOffer: string;

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

  /** Créneaux libres ; heures converties en chaînes ISO (PGlite renvoie des Date). */
  const slots = (user: string | null, offer: string) =>
    as(db, user, () => q<{ advisor_id: string; starts_at: Date }>('select * from public.consulting_available_slots($1)', [offer])).then((rows) =>
      rows.map((r) => ({ advisor_id: r.advisor_id, starts_at: new Date(r.starts_at).toISOString() })),
    );
  const book = (user: string, offer: string, startsAt: string) =>
    as(db, user, () => q<{ id: string }>(`select public.consulting_book($1, $2::timestamptz, 'Mon projet') as id`, [offer, startsAt])).then(
      (r) => r[0].id,
    );
  const booking = (id: string) =>
    q<{ status: string; hold_expires_at: string | null; starts_at: string; ends_at: string; price: string; advisor_id: string }>(
      'select * from public.consulting_bookings where id = $1',
      [id],
    ).then((r) => r[0]);
  const pay = (id: string, amount: number, reference: string, user = admin) =>
    as(db, user, () => q<{ id: string }>(`select public.consulting_record_payment($1, $2, 'orange_money', $3) as id`, [id, amount, reference]));

  /** Nouveau conseiller actif (évite que les rendez-vous de test se chevauchent). */
  async function newAdvisor(name = 'Conseiller test') {
    const id = await createUser(db);
    await as(db, admin, () => q(`select public.consulting_set_advisor($1, $2, true)`, [id, name]));
    return id;
  }

  /** Libère le créneau d'un rendez-vous de test. */
  const retire = (id: string) => q(`update public.consulting_bookings set status = 'cancelled' where id = $1`, [id]);

  /**
   * Rendez-vous inséré directement (états horaires précis pour la visio et les
   * rappels). Conseiller dédié sauf `opts.advisor`.
   */
  async function rawBooking(
    client: string,
    minutesFromNow: number,
    opts: { status?: string; mode?: string; confirmedHoursAgo?: number; advisor?: string } = {},
  ) {
    const adv = opts.advisor ?? (await newAdvisor());
    const rows = await q<{ id: string }>(
      `insert into public.consulting_bookings
         (offer_id, client_id, advisor_id, mode, duration_minutes, price, starts_at, ends_at, slot, status, hold_expires_at, confirmed_at)
       values ($1, $2, $3, $4::public.consulting_mode, 60, 25000, now() + make_interval(mins => $5), now(), 'empty',
               $6::public.consulting_booking_status,
               case when $6 = 'pending_payment' then now() + interval '1 day' end,
               now() - make_interval(hours => $7))
       returning id`,
      [paidOffer, client, adv, opts.mode ?? 'video', minutesFromNow, opts.status ?? 'confirmed', opts.confirmedHoursAgo ?? 48],
    );
    return rows[0].id;
  }
  const advisorOf = (id: string) => booking(id).then((b) => b.advisor_id);

  beforeAll(async () => {
    db = await createTestDb();
    admin = await createUser(db, { username: 'csc_admin', admin: true });
    advisor = await createUser(db, { email: 'advisor@test.local' });
    other = await createUser(db, { email: 'other@test.local' });

    await as(db, admin, () => q(`select public.consulting_set_advisor($1, 'Conseiller CSC', true)`, [advisor]));
    // Disponible tous les jours de 08:00 à 20:00 (heure du Cameroun).
    for (let d = 1; d <= 7; d++) {
      await as(db, admin, () =>
        q(`insert into public.consulting_availability (advisor_id, weekday, start_time, end_time) values ($1, $2, '08:00', '20:00')`, [advisor, d]),
      );
    }
    paidOffer = await as(db, admin, () =>
      q<{ id: string }>(
        `insert into public.consulting_offers (title_fr, category, mode, duration_minutes, price, status)
         values ('Séance de conseil', 'crypto', 'video', 60, 25000, 'published') returning id`,
      ),
    ).then((r) => r[0].id);
    freeOffer = await as(db, admin, () =>
      q<{ id: string }>(
        `insert into public.consulting_offers (title_fr, category, mode, duration_minutes, price, once_per_client, status)
         values ('Premier échange', 'investment', 'phone', 30, 0, true, 'published') returning id`,
      ),
    ).then((r) => r[0].id);
  });

  // ---------------------------------------------------------------------------
  describe('Offres et créneaux', () => {
    it('catalogue : publiées visibles de tous, brouillons réservés à l’admin', async () => {
      const draft = await as(db, admin, () =>
        q<{ id: string }>(`insert into public.consulting_offers (title_fr, duration_minutes, price) values ('Brouillon', 60, 1000) returning id`),
      ).then((r) => r[0].id);
      const anonIds = (await as(db, null, () => q<{ id: string }>('select id from public.consulting_offers'))).map((r) => r.id);
      expect(anonIds).toContain(paidOffer);
      expect(anonIds).not.toContain(draft);
      expect(await errorOf(as(db, other, () => q(`insert into public.consulting_offers (title_fr, duration_minutes) values ('Pirate', 60)`)))).not.toBeNull();
      // Un rendez-vous présentiel exige une adresse.
      expect(
        await errorOf(as(db, admin, () => q(`insert into public.consulting_offers (title_fr, mode, duration_minutes) values ('Sur place', 'in_person', 60)`))),
      ).toContain('consulting_offers_location_required');
      expect(await slots(null, draft)).toHaveLength(0);
    });

    it('créneaux : délai minimal, horizon, pas de 30 min, heures du Cameroun', async () => {
      const list = await slots(null, paidOffer);
      expect(list.length).toBeGreaterThan(100);
      const minStart = Date.now() + 24 * 3600_000 - 60_000;
      for (const s of list) {
        const t = new Date(s.starts_at);
        expect(t.getTime()).toBeGreaterThanOrEqual(minStart);
        // Fuseau Africa/Douala = UTC+1 : 08:00–19:00 locales = 07:00–18:00 UTC.
        expect(t.getUTCMinutes() % 30).toBe(0);
        expect(t.getUTCHours()).toBeGreaterThanOrEqual(7);
        expect(t.getUTCHours() * 60 + t.getUTCMinutes()).toBeLessThanOrEqual(18 * 60);
      }
      const maxStart = Date.now() + 32 * 24 * 3600_000;
      expect(new Date(list[list.length - 1].starts_at).getTime()).toBeLessThan(maxStart);
    });

    it('« ignorer un rendez-vous » n’a d’effet que pour son client (pas de fuite des créneaux pris)', async () => {
      const owner = await createUser(db);
      const [slot] = await slots(owner, paidOffer);
      const id = await book(owner, paidOffer, slot.starts_at);
      const withIgnore = (u: string) =>
        as(db, u, () => q<{ starts_at: Date }>('select * from public.consulting_available_slots($1, $2)', [paidOffer, id])).then((r) =>
          r.map((x) => new Date(x.starts_at).toISOString()),
        );
      expect(await withIgnore(owner)).toContain(slot.starts_at);
      expect(await withIgnore(other)).not.toContain(slot.starts_at);
      await as(db, owner, () => q('select public.consulting_cancel_booking($1, null)', [id]));
    });

    it('une indisponibilité retire les créneaux concernés', async () => {
      const [first] = await slots(null, paidOffer);
      await as(db, advisor, () =>
        q(`insert into public.consulting_unavailabilities (advisor_id, period, reason)
           values ($1, tstzrange($2::timestamptz, $2::timestamptz + interval '2 hours'), 'Congé')`, [advisor, first.starts_at]),
      );
      const after = (await slots(null, paidOffer)).map((s) => s.starts_at);
      expect(after).not.toContain(first.starts_at);
      // Un client ne peut pas créer d'indisponibilité.
      expect(
        await errorOf(as(db, other, () => q(`insert into public.consulting_unavailabilities (advisor_id, period) values ($1, tstzrange(now(), now() + interval '1 hour'))`, [advisor]))),
      ).not.toBeNull();
      await as(db, admin, () => q('delete from public.consulting_unavailabilities'));
    });
  });

  // ---------------------------------------------------------------------------
  describe('Réservation', () => {
    it('offre payante : en attente de paiement, créneau réservé 24 h, conditions figées', async () => {
      const client = await createUser(db);
      const [slot] = await slots(client, paidOffer);
      const id = await book(client, paidOffer, slot.starts_at);
      const b = await booking(id);
      expect(b.status).toBe('pending_payment');
      expect(Number(b.price)).toBe(25000);
      expect(new Date(b.ends_at).getTime() - new Date(b.starts_at).getTime()).toBe(60 * 60_000);
      const holdMs = new Date(b.hold_expires_at!).getTime() - Date.now();
      expect(holdMs).toBeGreaterThan(23.9 * 3600_000);
      expect(holdMs).toBeLessThanOrEqual(24 * 3600_000 + 60_000);
      // Le créneau n'est plus proposé.
      expect((await slots(other, paidOffer)).map((s) => s.starts_at)).not.toContain(slot.starts_at);
      // Changer le prix de l'offre ne change pas le rendez-vous.
      await as(db, admin, () => q('update public.consulting_offers set price = 99000 where id = $1', [paidOffer]));
      expect(Number((await booking(id)).price)).toBe(25000);
      await as(db, admin, () => q('update public.consulting_offers set price = 25000 where id = $1', [paidOffer]));
      expect(await errorOf(q('update public.consulting_bookings set price = 1 where id = $1', [id]))).toContain('booking_terms_frozen');
    });

    it('le même créneau ne peut jamais être réservé deux fois (contrôle de la base)', async () => {
      const a = await createUser(db);
      const b = await createUser(db);
      const [slot] = await slots(a, paidOffer);
      await book(a, paidOffer, slot.starts_at);
      expect(await errorOf(book(b, paidOffer, slot.starts_at))).toContain('slot_unavailable');
      // Même en contournant la vérification des créneaux, la contrainte d'exclusion refuse.
      const err = await errorOf(
        q(
          `insert into public.consulting_bookings (offer_id, client_id, advisor_id, mode, duration_minutes, price, starts_at, ends_at, slot, status, confirmed_at)
           values ($1, $2, $3, 'video', 60, 25000, $4::timestamptz + interval '30 minutes', now(), 'empty', 'confirmed', now())`,
          [paidOffer, b, advisor, slot.starts_at],
        ),
      );
      expect(err).toContain('consulting_bookings_no_overlap');
    });

    it('créneau quelconque refusé ; profil incomplet refusé ; visiteur refusé', async () => {
      const client = await createUser(db);
      expect(await errorOf(book(client, paidOffer, new Date(Date.now() + 3 * 24 * 3600_000 + 7 * 60_000).toISOString()))).toContain('slot_unavailable');
      const incomplete = await createUser(db, { meta: { phone_whatsapp: '' } });
      const [slot] = await slots(incomplete, paidOffer);
      expect(await errorOf(book(incomplete, paidOffer, slot.starts_at))).toContain('profile_incomplete');
      expect(await errorOf(as(db, null, () => q('select public.consulting_book($1, $2::timestamptz)', [paidOffer, slot.starts_at])))).not.toBeNull();
    });

    it('offre gratuite : confirmée directement, une seule fois par client', async () => {
      const client = await createUser(db);
      const list = await slots(client, freeOffer);
      const id = await book(client, freeOffer, list[0].starts_at);
      expect((await booking(id)).status).toBe('confirmed');
      expect(await errorOf(book(client, freeOffer, list[5].starts_at))).toContain('offer_already_used');
    });

    it('un client ne peut pas avoir deux rendez-vous qui se chevauchent', async () => {
      const client = await createUser(db);
      const [s1] = await slots(client, paidOffer);
      await book(client, paidOffer, s1.starts_at);
      // Deuxième conseiller disponible sur le même créneau.
      const second = await createUser(db);
      await as(db, admin, () => q(`select public.consulting_set_advisor($1, 'Second', true)`, [second]));
      for (let d = 1; d <= 7; d++) {
        await as(db, admin, () =>
          q(`insert into public.consulting_availability (advisor_id, weekday, start_time, end_time) values ($1, $2, '08:00', '20:00')`, [second, d]),
        );
      }
      expect((await slots(client, paidOffer)).map((s) => s.starts_at)).toContain(s1.starts_at);
      expect(await errorOf(book(client, paidOffer, s1.starts_at))).toContain('client_overlap');
      await as(db, admin, () => q(`select public.consulting_set_advisor($1, 'Second', false)`, [second]));
    });
  });

  // ---------------------------------------------------------------------------
  describe('Paiement et expiration', () => {
    it('seul l’admin enregistre un paiement, au montant exact, avec une référence unique', async () => {
      const client = await createUser(db);
      const [slot] = await slots(client, paidOffer);
      const id = await book(client, paidOffer, slot.starts_at);
      expect(await errorOf(pay(id, 25000, 'OM-1', client))).toContain('forbidden');
      expect(await errorOf(pay(id, 20000, 'OM-1'))).toContain('amount_mismatch');
      expect(await errorOf(pay(id, 25000, ''))).toContain('reference_required');
      await pay(id, 25000, 'OM-REF-001');
      const b = await booking(id);
      expect(b.status).toBe('confirmed');
      expect(b.hold_expires_at).toBeNull();
      expect(await errorOf(pay(id, 25000, 'OM-REF-002'))).toContain('booking_not_payable');

      // La même référence ne peut pas confirmer un autre rendez-vous.
      const client2 = await createUser(db);
      const [slot2] = await slots(client2, paidOffer);
      const id2 = await book(client2, paidOffer, slot2.starts_at);
      expect(await errorOf(pay(id2, 25000, ' om-ref-001 '))).toContain('reference_used');
      expect((await booking(id2)).status).toBe('pending_payment');

      const events = await as(db, client, () => q<{ event: string }>('select event from public.consulting_booking_events where booking_id = $1 order by id', [id]));
      expect(events.map((e) => e.event)).toEqual(['created', 'payment_recorded', 'confirmed']);
      expect(await errorOf(q('delete from public.consulting_booking_events where booking_id = $1', [id]))).toContain('append_only');
    });

    it('sans paiement dans le délai : expirée, créneau libéré, client prévenu une seule fois', async () => {
      const client = await createUser(db);
      const [slot] = await slots(client, paidOffer);
      const id = await book(client, paidOffer, slot.starts_at);
      await q(`update public.consulting_bookings set hold_expires_at = now() - interval '1 minute' where id = $1`, [id]);
      // Le créneau redevient libre dès l'échéance, même avant le passage de la tâche.
      expect((await slots(other, paidOffer)).map((s) => s.starts_at)).toContain(slot.starts_at);

      expect(await asService(() => q<{ n: number }>('select public.consulting_expire_holds() as n'))).toEqual([{ n: 1 }]);
      expect((await booking(id)).status).toBe('expired');
      const notices = await asService(() => q<{ booking_id: string }>('select * from public.consulting_claim_expiry_notices(50)'));
      expect(notices.map((n) => n.booking_id)).toEqual([id]);
      expect(await asService(() => q('select * from public.consulting_claim_expiry_notices(50)'))).toHaveLength(0);
      // Tâche réservée au serveur.
      expect(await errorOf(as(db, client, () => q('select public.consulting_expire_holds()')))).not.toBeNull();

      // Paiement tardif : réactivé si le créneau est encore libre.
      await pay(id, 25000, 'MTN-LATE-1');
      expect((await booking(id)).status).toBe('confirmed');
    });

    it('paiement tardif refusé si le créneau a été repris entre-temps', async () => {
      const a = await createUser(db);
      const b = await createUser(db);
      const [slot] = await slots(a, paidOffer);
      const id = await book(a, paidOffer, slot.starts_at);
      await q(`update public.consulting_bookings set hold_expires_at = now() - interval '1 minute' where id = $1`, [id]);
      await book(b, paidOffer, slot.starts_at);
      expect((await booking(id)).status).toBe('expired');
      expect(await errorOf(pay(id, 25000, 'OM-TOO-LATE'))).toContain('slot_taken');
      expect((await booking(id)).status).toBe('expired');
    });
  });

  // ---------------------------------------------------------------------------
  describe('Annulation, report et remboursement', () => {
    it('client : annulation jusqu’à 24 h avant ; au-delà, refusée', async () => {
      const client = await createUser(db);
      const late = await rawBooking(client, 10 * 60);
      expect(await errorOf(as(db, client, () => q('select public.consulting_cancel_booking($1, null)', [late])))).toContain('cancel_too_late');
      expect(await errorOf(as(db, other, () => q('select public.consulting_cancel_booking($1, null)', [late])))).toContain('not_found');

      const far = (await slots(client, paidOffer))[40];
      const id = await book(client, paidOffer, far.starts_at);
      const [r] = await as(db, client, () => q<{ refund: boolean }>('select public.consulting_cancel_booking($1, null) as refund', [id]));
      expect(r.refund).toBe(false);
      expect((await booking(id)).status).toBe('cancelled');
    });

    it('admin : annule à tout moment ; remboursement seulement après annulation', async () => {
      const client = await createUser(db);
      const [slot] = await slots(client, paidOffer);
      const id = await book(client, paidOffer, slot.starts_at);
      const [p] = await pay(id, 25000, 'OM-REFUND-1');
      expect(
        await errorOf(as(db, admin, () => q(`select public.consulting_refund_payment($1, 'RB-1', '')`, [p.id]))),
      ).toContain('refund_requires_cancellation');
      const [r] = await as(db, admin, () => q<{ refund: boolean }>(`select public.consulting_cancel_booking($1, 'Conseiller indisponible') as refund`, [id]));
      expect(r.refund).toBe(true);
      expect(await errorOf(as(db, client, () => q(`select public.consulting_refund_payment($1, 'RB-1', '')`, [p.id])))).toContain('forbidden');
      await as(db, admin, () => q(`select public.consulting_refund_payment($1, 'RB-1', 'Annulation CSC')`, [p.id]));
      expect((await booking(id)).status).toBe('refunded');
      const [pay2] = await q<{ status: string; refund_reference: string }>('select status, refund_reference from public.consulting_payments where id = $1', [p.id]);
      expect(pay2).toEqual({ status: 'refunded', refund_reference: 'RB-1' });
    });

    it('report par le client vers un créneau libre ; rappels réinitialisés', async () => {
      const client = await createUser(db);
      const list = await slots(client, paidOffer);
      const ms = (s: { starts_at: string }) => new Date(s.starts_at).getTime();
      // Un créneau suivi d'un autre libre une demi-heure plus tard.
      const base = list.find((s) => list.some((x) => ms(x) === ms(s) + 30 * 60_000))!;
      const shifted = list.find((x) => ms(x) === ms(base) + 30 * 60_000);
      const id = await book(client, paidOffer, base.starts_at);
      expect(
        await errorOf(as(db, client, () => q('select public.consulting_reschedule_booking($1, $2::timestamptz)', [id, new Date(Date.now() + 5 * 24 * 3600_000 + 60_000).toISOString()]))),
      ).toContain('slot_unavailable');
      // Report d'une demi-heure : le créneau chevauche l'ancien, il est accepté.
      expect(shifted).toBeDefined();
      await as(db, client, () => q('select public.consulting_reschedule_booking($1, $2::timestamptz)', [id, shifted!.starts_at]));
      expect(new Date((await booking(id)).starts_at).toISOString()).toBe(new Date(shifted!.starts_at).toISOString());
      expect(await errorOf(as(db, other, () => q('select public.consulting_reschedule_booking($1, $2::timestamptz)', [id, list[10].starts_at])))).toContain('not_found');
    });
  });

  // ---------------------------------------------------------------------------
  describe('Visio', () => {
    it('client : 15 min avant → fin + 30 min ; conseiller dès 1 h avant ; autres refusés', async () => {
      const client = await createUser(db);
      const opts = { advisor };
      const join = (u: string, id: string) =>
        as(db, u, () => q<{ room_name: string; is_host: boolean; display_name: string }>('select * from public.consulting_join($1)', [id]));

      const soon = await rawBooking(client, 10, opts);
      const [c] = await join(client, soon);
      expect(c.is_host).toBe(false);
      expect(c.room_name).toBe(`csc-consult-${soon}`);
      const [h] = await join(advisor, soon);
      expect(h.is_host).toBe(true);
      expect(h.display_name).toBe('Conseiller CSC');
      expect((await join(admin, soon))[0].is_host).toBe(true);
      expect(await errorOf(join(other, soon))).toContain('not_found');
      expect((await booking(soon)) as unknown as { client_joined_at: string | null }).toHaveProperty('client_joined_at');
      await retire(soon);

      const later = await rawBooking(client, 40, opts);
      expect(await errorOf(join(client, later))).toContain('meeting_too_early');
      expect((await join(advisor, later))[0].is_host).toBe(true);
      await retire(later);

      const past = await rawBooking(client, -100, opts);
      expect(await errorOf(join(client, past))).toContain('meeting_over');
      const phone = await rawBooking(client, 5, { ...opts, mode: 'phone' });
      expect(await errorOf(join(client, phone))).toContain('booking_not_video');
      await retire(phone);
      expect(await errorOf(join(client, await rawBooking(client, 200, { ...opts, status: 'pending_payment' })))).toContain('booking_not_confirmed');
    });
  });

  // ---------------------------------------------------------------------------
  describe('Rappels', () => {
    it('la veille et 1 h avant, jamais deux fois', async () => {
      const client = await createUser(db);
      const tomorrow = await rawBooking(client, 20 * 60 + 2000);
      const inHalfHour = await rawBooking(client, 30 + 3000);
      // Rendez-vous décalés dans le futur lointain pour ne pas gêner : on ramène chacun à son horaire de test.
      await q(`update public.consulting_bookings set starts_at = now() + interval '20 hours' where id = $1`, [tomorrow]);
      await q(`update public.consulting_bookings set starts_at = now() + interval '30 minutes' where id = $1`, [inHalfHour]);

      const claimed = await asService(() => q<{ booking_id: string; kind: string }>('select booking_id, kind from public.consulting_claim_reminders(500)'));
      const mine = claimed.filter((r) => r.booking_id === tomorrow || r.booking_id === inHalfHour);
      expect(mine).toEqual(
        expect.arrayContaining([
          { booking_id: tomorrow, kind: 'day_before' },
          { booking_id: inHalfHour, kind: 'hour_before' },
        ]),
      );
      expect(mine).toHaveLength(2);
      const again = await asService(() => q<{ booking_id: string }>('select booking_id from public.consulting_claim_reminders(500)'));
      expect(again.filter((r) => r.booking_id === tomorrow || r.booking_id === inHalfHour)).toHaveLength(0);
      expect(await errorOf(as(db, client, () => q('select * from public.consulting_claim_reminders(10)')))).not.toBeNull();
    });

    it('pas de rappel « veille » pour un rendez-vous confirmé moins de 23 h avant', async () => {
      const client = await createUser(db);
      const id = await rawBooking(client, 20 * 60, { confirmedHoursAgo: 0 });
      const claimed = await asService(() => q<{ booking_id: string }>('select booking_id from public.consulting_claim_reminders(500)'));
      expect(claimed.map((r) => r.booking_id)).not.toContain(id);
    });
  });

  // ---------------------------------------------------------------------------
  describe('Comptes rendus', () => {
    it('rédigé par le conseiller, visible du seul client une fois publié, chaque lecture journalisée, figé', async () => {
      const client = await createUser(db);
      const id = await rawBooking(client, -120);
      const advisor = await advisorOf(id);
      const save = (u: string, subject = 'Bilan crypto') =>
        as(db, u, () =>
          q(`select public.consulting_save_report($1, current_date, $2, 'Résumé des échanges détaillé', 'Diversifier', '')`, [id, subject]),
        );
      expect(await errorOf(save(client))).toContain('forbidden');
      expect(await errorOf(save(other))).toContain('forbidden');
      await save(advisor);

      // Brouillon : invisible du client.
      expect(await errorOf(as(db, client, () => q('select public.consulting_report_view($1)', [id])))).toContain('not_found');
      const [{ report: draft }] = await as(db, advisor, () => q<{ report: { subject: string } }>('select public.consulting_report_view($1) as report', [id]));
      expect(draft.subject).toBe('Bilan crypto');
      // Le contenu n'est pas lisible directement.
      expect(await errorOf(as(db, advisor, () => q('select summary from public.consulting_reports where booking_id = $1', [id])))).toContain('permission denied');

      await as(db, advisor, () => q('select public.consulting_publish_report($1)', [id]));
      const [{ report }] = await as(db, client, () => q<{ report: { summary: string; author: string } }>('select public.consulting_report_view($1) as report', [id]));
      expect(report.summary).toBe('Résumé des échanges détaillé');
      expect(report.author).toBe('Conseiller test');
      expect(await errorOf(as(db, other, () => q('select public.consulting_report_view($1)', [id])))).toContain('not_found');

      const views = await q<{ n: number }>(
        `select count(*)::int as n from public.audit_log where action = 'consulting.report.view' and entity_id = $1`,
        [id],
      );
      expect(views[0].n).toBe(2);

      expect(await errorOf(save(advisor, 'Modifié'))).toContain('report_published');
      expect(await errorOf(q(`update public.consulting_reports set summary = 'x' where booking_id = $1`, [id]))).toContain('report_published');
    });

    it('pièces jointes : chemin rattaché au rendez-vous, ouverture journalisée', async () => {
      const client = await createUser(db);
      const id = await rawBooking(client, -120);
      const advisor = await advisorOf(id);
      await as(db, advisor, () => q(`select public.consulting_save_report($1, current_date, 'Sujet', 'Résumé suffisant', '', '')`, [id]));
      expect(
        await errorOf(as(db, advisor, () => q(`select public.consulting_add_report_file($1, 'Plan', 'autre/fichier.pdf', 10)`, [id]))),
      ).toContain('forbidden');
      const [{ fid }] = await as(db, advisor, () => q<{ fid: string }>(`select public.consulting_add_report_file($1, 'Plan', $2, 10) as fid`, [id, `${id}/plan.pdf`]));
      expect(await errorOf(as(db, client, () => q('select public.consulting_report_file_path($1)', [fid])))).toContain('not_found');
      await as(db, advisor, () => q('select public.consulting_publish_report($1)', [id]));
      const [{ path }] = await as(db, client, () => q<{ path: string }>('select public.consulting_report_file_path($1) as path', [fid]));
      expect(path).toBe(`${id}/plan.pdf`);
      expect(await errorOf(as(db, advisor, () => q('select public.consulting_remove_report_file($1)', [fid])))).toContain('report_published');
      // Le chemin n'est jamais lisible directement.
      expect(await errorOf(as(db, client, () => q('select file_path from public.consulting_report_files')))).toContain('permission denied');
    });
  });

  // ---------------------------------------------------------------------------
  describe('Cloisonnement', () => {
    it('un client ne voit que ses rendez-vous ; le conseiller voit ceux qui lui sont attribués', async () => {
      const a = await createUser(db);
      const b = await createUser(db);
      const idA = await rawBooking(a, 3000);
      await rawBooking(b, 3100);
      const seenByA = await as(db, a, () => q<{ id: string }>('select id from public.consulting_bookings'));
      expect(seenByA.map((r) => r.id)).toEqual([idA]);
      const detailsA = await as(db, a, () => q<{ id: string; client_phone: string }>('select id, client_phone from public.consulting_booking_details'));
      expect(detailsA.map((r) => r.id)).toEqual([idA]);
      expect(await as(db, b, () => q('select id from public.consulting_booking_details where id = $1', [idA]))).toHaveLength(0);
      // Le conseiller voit les coordonnées de son client, pas les autres rendez-vous.
      const advisor = await advisorOf(idA);
      expect((await as(db, advisor, () => q<{ id: string }>('select id from public.consulting_bookings'))).map((r) => r.id)).toEqual([idA]);
      const forAdvisor = await as(db, advisor, () => q<{ client_phone: string }>('select client_phone from public.consulting_booking_details where id = $1', [idA]));
      expect(forAdvisor[0].client_phone).toBe('+237690000000');
      // Aucun accès anonyme ; aucune écriture directe.
      expect(await errorOf(as(db, null, () => q('select id from public.consulting_booking_details')))).toContain('permission denied');
      expect(await errorOf(as(db, a, () => q(`update public.consulting_bookings set status = 'confirmed' where id = $1`, [idA])))).toContain('permission denied');
      expect(await errorOf(as(db, a, () => q('select * from public.consulting_reminders')))).toBeNull();
      expect(await as(db, a, () => q('select * from public.consulting_reminders'))).toHaveLength(0);
    });

    it('un conseiller désactivé perd l’accès à ses rendez-vous', async () => {
      const client = await createUser(db);
      const id = await rawBooking(client, 4000);
      const advisor = await advisorOf(id);
      expect(await as(db, advisor, () => q('select id from public.consulting_bookings where id = $1', [id]))).toHaveLength(1);
      await as(db, admin, () => q(`select public.consulting_set_advisor($1, 'Conseiller test', false)`, [advisor]));
      expect(await as(db, advisor, () => q('select id from public.consulting_bookings where id = $1', [id]))).toHaveLength(0);
    });
  });
});
