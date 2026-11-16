import { beforeAll, describe, expect, it } from 'vitest';
import { as, createTestDb, createUser, errorOf, type TestDb } from './harness';

/**
 * Règles critiques de CSC Ambassador, vérifiées sur les vraies migrations
 * et sous l'identité de chaque rôle (la RLS s'applique).
 */
describe('CSC Ambassador — règles métier', () => {
  let db: TestDb;
  let admin: string;
  let amb1: string;
  let amb2: string;
  let visitor: string;

  const q = <T = Record<string, unknown>>(sql: string, params: unknown[] = []) =>
    db.query<T>(sql, params).then((r) => r.rows);

  /** Crée une campagne (admin) ; la lance si demandé. */
  async function campaign(opts: { amount?: number; minVolume?: number | null; launch?: boolean } = {}): Promise<string> {
    const rows = await as(db, admin, () =>
      q<{ id: string }>(
        `insert into public.campaigns (title_fr, modop_fr, video_url, amount_per_account, min_volume)
         values ('Campagne test', 'Étapes…', 'https://youtu.be/abc', $1, $2) returning id`,
        [opts.amount ?? 2000, opts.minVolume ?? null],
      ),
    );
    if (opts.launch !== false) await as(db, admin, () => q('select public.launch_campaign($1)', [rows[0].id]));
    return rows[0].id;
  }

  const participate = (user: string, c: string, yes = true) =>
    as(db, user, () => q('select public.set_participation($1, $2)', [c, yes]));

  const submit = (user: string, c: string, uid: string, volume = 100) =>
    as(db, user, () => q<{ id: string }>('select public.submit_account($1, $2, $3) as id', [c, uid, volume])).then(
      (r) => r[0].id,
    );

  const review = (id: string, decision: 'validated' | 'rejected', reason?: string) =>
    as(db, admin, () => q('select public.review_submission($1, $2, $3)', [id, decision, reason ?? null]));

  const pay = (c: string, amb: string, amount: number) =>
    as(db, admin, () =>
      q<{ id: string }>(`select public.record_payout($1, $2, $3, 'Orange Money', 'REF') as id`, [c, amb, amount]),
    ).then((r) => r[0].id);

  const balance = (user: string, c: string) =>
    as(db, user, () =>
      q<{ earned: number; paid: number; due: number; confirmed: number }>(
        'select earned::int, paid::int, due::int, confirmed::int from public.ambassador_campaign_balances where campaign_id = $1 and ambassador_id = $2',
        [c, user],
      ),
    ).then((r) => r[0] ?? { earned: 0, paid: 0, due: 0, confirmed: 0 });

  beforeAll(async () => {
    db = await createTestDb();
    admin = await createUser(db, { username: 'csc_admin', admin: true });
    amb1 = await createUser(db, { email: 'amb1@test.local' });
    amb2 = await createUser(db, { email: 'amb2@test.local' });
    visitor = await createUser(db, { email: 'visiteur@test.local' });
    await as(db, amb1, () => q('select public.become_ambassador()'));
    await as(db, amb2, () => q('select public.become_ambassador()'));
  });

  // ---------------------------------------------------------------------------
  describe('Charte et numérotation', () => {
    it('attribue des numéros séquentiels CSC-AMB-0001, CSC-AMB-0002…', async () => {
      const rows = await q<{ code: string }>('select code from public.ambassadors order by number');
      expect(rows.map((r) => r.code)).toEqual(['CSC-AMB-0001', 'CSC-AMB-0002']);
    });

    it('accepter la charte deux fois renvoie le même numéro', async () => {
      const rows = await as(db, amb1, () => q<{ code: string }>('select public.become_ambassador() as code'));
      expect(rows[0].code).toBe('CSC-AMB-0001');
    });

    it('refuse un profil incomplet (pas de numéro WhatsApp)', async () => {
      const u = await createUser(db, { meta: { phone_whatsapp: '' } });
      const err = await errorOf(as(db, u, () => q('select public.become_ambassador()')));
      expect(err).toMatch(/profile_incomplete/);
    });

    it('un utilisateur ne peut pas s’inscrire lui-même dans la table ni choisir son numéro', async () => {
      const err = await errorOf(
        as(db, visitor, () => q('insert into public.ambassadors (user_id, number) values ($1, 1)', [visitor])),
      );
      expect(err).toMatch(/permission denied/);
    });

    it('un numéro n’est jamais réutilisé', async () => {
      const u = await createUser(db);
      // Une tentative interrompue consomme un numéro : il ne sera pas réattribué.
      await db.query(`select nextval('public.ambassador_number_seq')`);
      await as(db, u, () => q('select public.become_ambassador()'));
      const rows = await q<{ code: string }>('select code from public.ambassadors where user_id = $1', [u]);
      expect(rows[0].code).toBe('CSC-AMB-0004');
    });
  });

  // ---------------------------------------------------------------------------
  describe('Cycle de vie des campagnes', () => {
    it('les brouillons sont invisibles des ambassadeurs, les campagnes lancées visibles', async () => {
      const draft = await campaign({ launch: false });
      const launched = await campaign();
      const seen = await as(db, amb1, () => q<{ id: string }>('select id from public.campaigns'));
      expect(seen.map((r) => r.id)).toContain(launched);
      expect(seen.map((r) => r.id)).not.toContain(draft);
    });

    it('un non-ambassadeur ne voit aucune campagne', async () => {
      await campaign();
      expect(await as(db, visitor, () => q('select id from public.campaigns'))).toEqual([]);
    });

    it('seul l’admin crée, lance et clôture une campagne', async () => {
      const c = await campaign({ launch: false });
      expect(await errorOf(as(db, amb1, () => q('select public.launch_campaign($1)', [c])))).toMatch(/forbidden/);
      expect(
        await errorOf(
          as(db, amb1, () => q(`insert into public.campaigns (title_fr, amount_per_account) values ('Pirate', 1)`)),
        ),
      ).toMatch(/row-level security|permission denied/);
      await as(db, admin, () => q('select public.launch_campaign($1)', [c]));
      expect(await errorOf(as(db, amb1, () => q('select public.close_campaign($1)', [c])))).toMatch(/forbidden/);
    });

    it('le statut ne peut pas être modifié directement, même par l’admin', async () => {
      const c = await campaign({ launch: false });
      const err = await errorOf(as(db, admin, () => q(`update public.campaigns set status = 'closed' where id = $1`, [c])));
      expect(err).toMatch(/permission denied/);
    });

    it('le lancement exige un mode opératoire et une vidéo', async () => {
      const rows = await as(db, admin, () =>
        q<{ id: string }>(`insert into public.campaigns (title_fr, amount_per_account) values ('Incomplète', 1000) returning id`),
      );
      const err = await errorOf(as(db, admin, () => q('select public.launch_campaign($1)', [rows[0].id])));
      expect(err).toMatch(/campaign_incomplete/);
    });

    it('une campagne peut être saisie uniquement en anglais (traduction indisponible)', async () => {
      const rows = await as(db, admin, () =>
        q<{ id: string }>(
          `insert into public.campaigns (title_fr, title_en, modop_en, video_url, amount_per_account, source_locale)
           values ('', 'English only', 'Steps…', 'https://youtu.be/abc', 1000, 'en') returning id`,
        ),
      );
      await as(db, admin, () => q('select public.launch_campaign($1)', [rows[0].id]));
      // Mais un titre doit exister dans au moins une langue.
      const err = await errorOf(
        as(db, admin, () => q(`insert into public.campaigns (title_fr, title_en, amount_per_account) values ('', '', 1000)`)),
      );
      expect(err).toMatch(/campaigns_title_required/);
    });

    it('le montant et le volume minimum sont figés après le lancement', async () => {
      const c = await campaign({ amount: 2000 });
      const err = await errorOf(
        as(db, admin, () => q('update public.campaigns set amount_per_account = 5000 where id = $1', [c])),
      );
      expect(err).toMatch(/campaign_amount_frozen/);
      // Les textes restent modifiables.
      await as(db, admin, () => q(`update public.campaigns set title_en = 'Test campaign' where id = $1`, [c]));
    });

    it('les créations et lancements de campagne sont audités', async () => {
      const c = await campaign();
      const rows = await q<{ action: string }>(
        `select action from public.audit_log where entity = 'campaign' and entity_id = $1 order by id`,
        [c],
      );
      expect(rows.map((r) => r.action)).toEqual(['campaign.create', 'campaign.launch']);
    });

    it('seul un brouillon peut être supprimé', async () => {
      const launched = await campaign();
      const res = await as(db, admin, () => db.query('delete from public.campaigns where id = $1', [launched]));
      expect(res.affectedRows).toBe(0);
      const draft = await campaign({ launch: false });
      const res2 = await as(db, admin, () => db.query('delete from public.campaigns where id = $1', [draft]));
      expect(res2.affectedRows).toBe(1);
    });
  });

  // ---------------------------------------------------------------------------
  describe('Vues et participation', () => {
    it('une vue est comptée une seule fois par ambassadeur', async () => {
      const c = await campaign();
      for (let i = 0; i < 3; i++) await as(db, amb1, () => q('select public.record_campaign_view($1)', [c]));
      await as(db, amb2, () => q('select public.record_campaign_view($1)', [c]));
      await as(db, visitor, () => q('select public.record_campaign_view($1)', [c])); // ignorée
      const rows = await q<{ n: number }>('select count(*)::int as n from public.campaign_views where campaign_id = $1', [c]);
      expect(rows[0].n).toBe(2);
    });

    it('le choix de participation est modifiable tant que la campagne est lancée', async () => {
      const c = await campaign();
      await participate(amb1, c, false);
      await participate(amb1, c, true);
      const rows = await q<{ participates: boolean }>(
        'select participates from public.campaign_participations where campaign_id = $1 and ambassador_id = $2',
        [c, amb1],
      );
      expect(rows).toEqual([{ participates: true }]);
    });

    it('il faut avoir choisi de participer pour soumettre un compte', async () => {
      const c = await campaign();
      await participate(amb1, c, false);
      expect(await errorOf(submit(amb1, c, '700000001'))).toMatch(/not_participating/);
    });

    it('impossible de refuser après avoir soumis au moins un ID (en attente ou validé)', async () => {
      const c = await campaign();
      await participate(amb1, c);
      const id = await submit(amb1, c, '700000002');
      expect(await errorOf(participate(amb1, c, false))).toMatch(/participation_locked/);
      await review(id, 'validated');
      expect(await errorOf(participate(amb1, c, false))).toMatch(/participation_locked/);
      await participate(amb1, c, true); // reconfirmer « oui » reste possible
    });

    it('un ID rejeté ou retiré ne verrouille pas la participation', async () => {
      const c = await campaign();
      await participate(amb1, c);
      const rejected = await submit(amb1, c, '700000003');
      await review(rejected, 'rejected', 'Compte introuvable');
      const pending = await submit(amb1, c, '700000004');
      await as(db, amb1, () => q('select public.cancel_submission($1)', [pending]));
      await participate(amb1, c, false);
    });
  });

  // ---------------------------------------------------------------------------
  describe('Soumissions et unicité de l’ID Binance', () => {
    it('un même ID Binance ne peut être soumis qu’une fois sur toute la plateforme', async () => {
      const c1 = await campaign();
      const c2 = await campaign();
      await participate(amb1, c1);
      await participate(amb2, c2);
      await submit(amb1, c1, '123456789');
      // Même ambassadeur, même campagne
      expect(await errorOf(submit(amb1, c1, '123456789'))).toMatch(/binance_uid_taken/);
      // Autre ambassadeur, autre campagne, avec espaces
      expect(await errorOf(submit(amb2, c2, ' 123 456 789 '))).toMatch(/binance_uid_taken/);
    });

    it('un ID rejeté reste réservé, sauf si l’admin supprime la soumission (auditée)', async () => {
      const c = await campaign();
      await participate(amb1, c);
      await participate(amb2, c);
      const id = await submit(amb1, c, '222222222');
      await review(id, 'rejected', 'Compte introuvable');
      expect(await errorOf(submit(amb2, c, '222222222'))).toMatch(/binance_uid_taken/);

      await as(db, admin, () => q('select public.delete_rejected_submission($1)', [id]));
      await submit(amb2, c, '222222222');
      const audit = await q(`select 1 from public.audit_log where action = 'submission.delete' and entity_id = $1`, [id]);
      expect(audit.length).toBe(1);
    });

    it('une soumission validée ne peut pas être supprimée', async () => {
      const c = await campaign();
      await participate(amb1, c);
      const id = await submit(amb1, c, '333333333');
      await review(id, 'validated');
      expect(await errorOf(as(db, admin, () => q('select public.delete_rejected_submission($1)', [id])))).toMatch(
        /only_rejected_deletable/,
      );
    });

    it('refuse un ID Binance mal formé', async () => {
      const c = await campaign();
      await participate(amb1, c);
      expect(await errorOf(submit(amb1, c, '12ab'))).toMatch(/binance_uid_invalid/);
    });

    it('applique le volume de trading minimum de la campagne', async () => {
      const c = await campaign({ minVolume: 500 });
      await participate(amb1, c);
      expect(await errorOf(submit(amb1, c, '444444441', 499.99))).toMatch(/volume_below_minimum/);
      await submit(amb1, c, '444444442', 500);
    });

    it('un non-ambassadeur ne peut rien soumettre', async () => {
      const c = await campaign();
      expect(await errorOf(as(db, visitor, () => q('select public.set_participation($1, true)', [c])))).toMatch(
        /not_ambassador/,
      );
      expect(await errorOf(submit(visitor, c, '555555551'))).toMatch(/not_ambassador/);
    });

    it('un ambassadeur suspendu ne peut plus soumettre', async () => {
      const u = await createUser(db);
      await as(db, u, () => q('select public.become_ambassador()'));
      const c = await campaign();
      await participate(u, c);
      await as(db, admin, () => q(`select public.set_ambassador_status($1, 'suspended', 'Fraude')`, [u]));
      expect(await errorOf(submit(u, c, '555555552'))).toMatch(/ambassador_suspended/);
    });

    it('un ambassadeur ne voit que ses propres soumissions', async () => {
      const rows = await as(db, amb2, () => q<{ ambassador_id: string }>('select ambassador_id from public.submissions'));
      expect(rows.length).toBeGreaterThan(0);
      expect(rows.every((r) => r.ambassador_id === amb2)).toBe(true);
    });

    it('un ambassadeur ne peut ni valider, ni écrire directement une soumission', async () => {
      const c = await campaign();
      await participate(amb1, c);
      const id = await submit(amb1, c, '666666661');
      expect(await errorOf(as(db, amb1, () => q(`select public.review_submission($1, 'validated')`, [id])))).toMatch(
        /forbidden/,
      );
      expect(
        await errorOf(as(db, amb1, () => q(`update public.submissions set status = 'validated' where id = $1`, [id]))),
      ).toMatch(/permission denied/);
    });

    it('un rejet exige un motif', async () => {
      const c = await campaign();
      await participate(amb1, c);
      const id = await submit(amb1, c, '777777771');
      expect(await errorOf(review(id, 'rejected', '  '))).toMatch(/reason_required/);
    });

    it('une soumission ne peut être revue qu’une fois', async () => {
      const c = await campaign();
      await participate(amb1, c);
      const id = await submit(amb1, c, '777777772');
      await review(id, 'validated');
      expect(await errorOf(review(id, 'rejected', 'Changement d’avis'))).toMatch(/already_reviewed/);
    });

    it('l’ambassadeur peut retirer une soumission en attente, pas une soumission validée', async () => {
      const c = await campaign();
      await participate(amb1, c);
      const pending = await submit(amb1, c, '777777773');
      await as(db, amb1, () => q('select public.cancel_submission($1)', [pending]));
      const validated = await submit(amb1, c, '777777774');
      await review(validated, 'validated');
      expect(await errorOf(as(db, amb1, () => q('select public.cancel_submission($1)', [validated])))).toMatch(
        /already_reviewed/,
      );
      // Ni celle d'un autre
      const other = await (async () => {
        await participate(amb2, c);
        return submit(amb2, c, '777777775');
      })();
      expect(await errorOf(as(db, amb1, () => q('select public.cancel_submission($1)', [other])))).toMatch(/not_found/);
    });
  });

  // ---------------------------------------------------------------------------
  describe('Calcul du solde', () => {
    it('ne compte que les soumissions validées, au montant figé de la campagne', async () => {
      const c = await campaign({ amount: 2500 });
      await participate(amb1, c);
      const a = await submit(amb1, c, '810000001');
      const b = await submit(amb1, c, '810000002');
      await submit(amb1, c, '810000003'); // reste en attente
      const d = await submit(amb1, c, '810000004');
      await review(a, 'validated');
      await review(b, 'validated');
      await review(d, 'rejected', 'Volume non atteint');
      expect(await balance(amb1, c)).toEqual({ earned: 5000, paid: 0, due: 5000, confirmed: 0 });
    });

    it('soustrait les paiements (partiels) et suit les confirmations', async () => {
      const c = await campaign({ amount: 3000 });
      await participate(amb2, c);
      await review(await submit(amb2, c, '820000001'), 'validated');
      await review(await submit(amb2, c, '820000002'), 'validated');

      const p1 = await pay(c, amb2, 2000);
      expect(await balance(amb2, c)).toEqual({ earned: 6000, paid: 2000, due: 4000, confirmed: 0 });

      await as(db, amb2, () => q('select public.confirm_payout($1)', [p1]));
      await pay(c, amb2, 4000);
      expect(await balance(amb2, c)).toEqual({ earned: 6000, paid: 6000, due: 0, confirmed: 2000 });
    });

    it('le solde total agrège toutes les campagnes de l’ambassadeur', async () => {
      const rows = await as(db, amb1, () =>
        q<{ ambassador_id: string; due: number }>('select ambassador_id, due::int from public.ambassador_balances'),
      );
      expect(rows.length).toBe(1);
      expect(rows[0].ambassador_id).toBe(amb1);
      const perCampaign = await as(db, amb1, () =>
        q<{ s: number }>('select coalesce(sum(due), 0)::int as s from public.ambassador_campaign_balances'),
      );
      expect(rows[0].due).toBe(perCampaign[0].s);
    });

    it('un paiement ne peut pas dépasser le montant dû', async () => {
      const c = await campaign({ amount: 1000 });
      await participate(amb1, c);
      await review(await submit(amb1, c, '830000001'), 'validated');
      expect(await errorOf(pay(c, amb1, 1001))).toMatch(/payout_exceeds_due/);
      expect(await errorOf(pay(c, amb2, 1))).toMatch(/payout_exceeds_due/);
    });

    it('seul l’admin enregistre un paiement ; seul le bénéficiaire le confirme', async () => {
      const c = await campaign({ amount: 1000 });
      await participate(amb1, c);
      await review(await submit(amb1, c, '840000001'), 'validated');
      expect(
        await errorOf(as(db, amb1, () => q(`select public.record_payout($1, $2, 1000, 'MoMo', '')`, [c, amb1]))),
      ).toMatch(/forbidden/);
      const p = await pay(c, amb1, 1000);
      expect(await errorOf(as(db, amb2, () => q('select public.confirm_payout($1)', [p])))).toMatch(/not_found/);
      await as(db, amb1, () => q('select public.confirm_payout($1)', [p]));
    });

    it('un ambassadeur ne voit pas le solde des autres', async () => {
      const rows = await as(db, amb1, () =>
        q<{ ambassador_id: string }>('select ambassador_id from public.ambassador_campaign_balances'),
      );
      expect(rows.every((r) => r.ambassador_id === amb1)).toBe(true);
      const all = await as(db, admin, () =>
        q<{ ambassador_id: string }>('select distinct ambassador_id from public.ambassador_campaign_balances'),
      );
      expect(all.length).toBeGreaterThan(1);
    });
  });

  // ---------------------------------------------------------------------------
  describe('Clôture bloquante', () => {
    it('refuse la clôture s’il reste des soumissions en attente', async () => {
      const c = await campaign();
      await participate(amb1, c);
      await submit(amb1, c, '910000001');
      expect(await errorOf(as(db, admin, () => q('select public.close_campaign($1)', [c])))).toMatch(
        /pending_submissions/,
      );
    });

    it('refuse la clôture tant qu’un montant dû n’est pas soldé (même partiellement payé)', async () => {
      const c = await campaign({ amount: 2000 });
      await participate(amb1, c);
      await review(await submit(amb1, c, '920000001'), 'validated');
      await pay(c, amb1, 1500);
      expect(await errorOf(as(db, admin, () => q('select public.close_campaign($1)', [c])))).toMatch(/unpaid_payouts/);
    });

    it('refuse la clôture tant que l’ambassadeur n’a pas confirmé la réception', async () => {
      const c = await campaign({ amount: 2000 });
      await participate(amb1, c);
      await review(await submit(amb1, c, '930000001'), 'validated');
      await review(await submit(amb1, c, '930000002'), 'rejected', 'Doublon');
      const p = await pay(c, amb1, 2000); // payé, mais pas encore confirmé
      expect(await errorOf(as(db, admin, () => q('select public.close_campaign($1)', [c])))).toMatch(/unconfirmed_payouts/);

      await as(db, amb1, () => q('select public.confirm_payout($1)', [p]));
      await as(db, admin, () => q('select public.close_campaign($1)', [c]));
      const rows = await q<{ status: string }>('select status from public.campaigns where id = $1', [c]);
      expect(rows[0].status).toBe('closed');
    });

    it('un ID validé n’est « payé » qu’après confirmation de la réception', async () => {
      const c = await campaign({ amount: 1000 });
      await participate(amb2, c);
      const s1 = await submit(amb2, c, '935000001');
      const s2 = await submit(amb2, c, '935000002');
      await review(s1, 'validated');
      await review(s2, 'validated');
      const states = () =>
        as(db, amb2, () =>
          q<{ submission_id: string; payment_state: string }>(
            'select submission_id, payment_state from public.submission_payment_states where campaign_id = $1',
            [c],
          ),
        ).then((rows) => Object.fromEntries(rows.map((r) => [r.submission_id, r.payment_state])));

      expect(await states()).toEqual({ [s1]: 'due', [s2]: 'due' });
      const p1 = await pay(c, amb2, 1000); // paiement partiel : couvre le premier ID validé
      expect(await states()).toEqual({ [s1]: 'awaiting_confirmation', [s2]: 'due' });
      await as(db, amb2, () => q('select public.confirm_payout($1)', [p1]));
      expect(await states()).toEqual({ [s1]: 'paid', [s2]: 'due' });
      const p2 = await pay(c, amb2, 1000);
      expect(await states()).toEqual({ [s1]: 'paid', [s2]: 'awaiting_confirmation' });
      await as(db, amb2, () => q('select public.confirm_payout($1)', [p2]));
      expect(await states()).toEqual({ [s1]: 'paid', [s2]: 'paid' });
      // Un autre ambassadeur ne voit pas ces états.
      expect(await as(db, amb1, () => q('select * from public.submission_payment_states where campaign_id = $1', [c]))).toEqual([]);
    });

    it('les statistiques comptent les paiements non confirmés', async () => {
      const c = await campaign({ amount: 1000 });
      await participate(amb1, c);
      await review(await submit(amb1, c, '936000001'), 'validated');
      await pay(c, amb1, 1000);
      const [s] = await as(db, admin, () =>
        q<{ due: number; unconfirmed_payouts: number }>('select due::int, unconfirmed_payouts from public.campaign_stats where campaign_id = $1', [c]),
      );
      expect(s).toEqual({ due: 0, unconfirmed_payouts: 1 });
    });

    it('une campagne clôturée n’accepte plus ni soumission, ni modification, ni participation', async () => {
      const c = await campaign();
      await participate(amb1, c);
      await as(db, admin, () => q('select public.close_campaign($1)', [c]));
      expect(await errorOf(submit(amb1, c, '940000001'))).toMatch(/campaign_not_open/);
      expect(await errorOf(participate(amb1, c, false))).toMatch(/campaign_not_open/);
      expect(
        await errorOf(as(db, admin, () => q(`update public.campaigns set title_fr = 'Renommée' where id = $1`, [c]))),
      ).toMatch(/campaign_closed/);
      expect(await errorOf(as(db, admin, () => q('select public.close_campaign($1)', [c])))).toMatch(
        /invalid_status_transition/,
      );
    });

    it('après clôture, tout est payé et confirmé', async () => {
      const c = await campaign({ amount: 1000 });
      await participate(amb2, c);
      await review(await submit(amb2, c, '950000001'), 'validated');
      const p = await pay(c, amb2, 1000);
      await as(db, amb2, () => q('select public.confirm_payout($1)', [p]));
      await as(db, admin, () => q('select public.close_campaign($1)', [c]));
      expect(await balance(amb2, c)).toEqual({ earned: 1000, paid: 1000, due: 0, confirmed: 1000 });
    });
  });

  // ---------------------------------------------------------------------------
  describe('Statistiques (tableau de bord admin)', () => {
    it('campaign_stats compte vues uniques, participation, soumissions et montants', async () => {
      const c = await campaign({ amount: 1000 });
      await as(db, amb1, () => q('select public.record_campaign_view($1)', [c]));
      await as(db, amb1, () => q('select public.record_campaign_view($1)', [c]));
      await participate(amb1, c, true);
      await participate(amb2, c, false);
      await review(await submit(amb1, c, '960000001'), 'validated');
      await submit(amb1, c, '960000002');
      const rows = await as(db, admin, () =>
        q(
          'select views, participants, declined, pending, validated, rejected, earned::int, paid::int, due::int from public.campaign_stats where campaign_id = $1',
          [c],
        ),
      );
      expect(rows[0]).toEqual({ views: 1, participants: 1, declined: 1, pending: 1, validated: 1, rejected: 0, earned: 1000, paid: 0, due: 1000 });
    });

    it('les totaux du programme sont globaux pour l’admin, personnels pour l’ambassadeur', async () => {
      const global = await as(db, admin, () => q<{ due: number }>('select due::int from public.ambassador_program_totals'));
      const own = await as(db, amb1, () => q<{ due: number }>('select due::int from public.ambassador_program_totals'));
      const amb1Due = await q<{ due: number }>('select due::int from public.ambassador_balances where ambassador_id = $1', [amb1]);
      expect(own[0].due).toBe(amb1Due[0].due);
      expect(global[0].due).toBeGreaterThanOrEqual(own[0].due);
      expect(await as(db, visitor, () => q<{ due: number }>('select due::int from public.ambassador_program_totals'))).toEqual([{ due: 0 }]);
    });
  });

  // ---------------------------------------------------------------------------
  describe('Fichiers de mode opératoire (Storage)', () => {
    it('le bucket est privé', async () => {
      const rows = await q<{ public: boolean }>(`select public from storage.buckets where id = 'campaign-files'`);
      expect(rows[0].public).toBe(false);
    });

    it('seul l’admin dépose un fichier ; un ambassadeur ne lit que ceux des campagnes lancées', async () => {
      const launched = await campaign();
      const draft = await campaign({ launch: false });
      expect(
        await errorOf(
          as(db, amb1, () =>
            q(`insert into storage.objects (bucket_id, name) values ('campaign-files', $1)`, [`${launched}/x.pdf`]),
          ),
        ),
      ).toMatch(/row-level security/);
      await as(db, admin, () =>
        q(`insert into storage.objects (bucket_id, name) values ('campaign-files', $1), ('campaign-files', $2)`, [
          `${launched}/modop.pdf`,
          `${draft}/modop.pdf`,
        ]),
      );
      const seen = await as(db, amb1, () => q<{ name: string }>('select name from storage.objects'));
      expect(seen.map((r) => r.name)).toEqual([`${launched}/modop.pdf`]);
      expect(await as(db, visitor, () => q('select name from storage.objects'))).toEqual([]);
    });
  });
});
