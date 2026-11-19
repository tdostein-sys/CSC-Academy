import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { notify } from '@/lib/notifications';
import { formatDate } from '@/lib/format';
import { localized } from '@/lib/localized';
import { bookingContext, staffIds } from './notify';
import type { ConsultingMode } from './types';

/**
 * Tâches planifiées CSC Consulting (appelées toutes les 15 minutes par
 * /api/cron/frequent, et une fois par jour par /api/cron/notifications) :
 *  1. expire les rendez-vous payants non réglés dans le délai (créneau libéré) ;
 *  2. prévient chaque client concerné, une seule fois ;
 *  3. envoie les rappels « la veille » et « 1 h avant » (client et conseiller).
 * La base choisit ce qui est dû et garantit qu'aucun envoi n'est réservé deux
 * fois : la tâche peut être relancée sans doublon.
 */
export interface ConsultingTaskResult {
  expired: number;
  expiryNotices: number;
  reminders: number;
}

interface ReminderRow {
  booking_id: string;
  kind: 'day_before' | 'hour_before';
  client_id: string;
  advisor_id: string;
  starts_at: string;
  mode: ConsultingMode;
  location: string;
  offer_title_fr: string;
  offer_title_en: string;
}

interface ExpiryRow {
  booking_id: string;
  client_id: string;
  starts_at: string;
  offer_title_fr: string;
  offer_title_en: string;
}

export async function runConsultingTasks(): Promise<ConsultingTaskResult> {
  const admin = createAdminClient();
  const result: ConsultingTaskResult = { expired: 0, expiryNotices: 0, reminders: 0 };

  const { data: expired, error: expErr } = await admin.rpc('consulting_expire_holds');
  if (expErr) throw new Error(`expiration: ${expErr.message}`);
  result.expired = Number(expired ?? 0);

  const { data: notices, error: notErr } = await admin.rpc('consulting_claim_expiry_notices', { p_limit: 200 });
  if (notErr) throw new Error(`avis d'expiration: ${notErr.message}`);
  for (const r of (notices ?? []) as ExpiryRow[]) {
    await notify({
      userIds: [r.client_id],
      type: 'consulting.expired',
      params: (l) => ({ offerTitle: localized(l, r.offer_title_fr, r.offer_title_en), date: formatDate(r.starts_at, l, true) }),
      link: `/consulting/bookings/${r.booking_id}`,
    });
    result.expiryNotices += 1;
  }

  const { data: reminders, error: remErr } = await admin.rpc('consulting_claim_reminders', { p_limit: 200 });
  if (remErr) throw new Error(`rappels: ${remErr.message}`);
  for (const r of (reminders ?? []) as ReminderRow[]) {
    const title = (l: 'fr' | 'en') => localized(l, r.offer_title_fr, r.offer_title_en);
    await notify({
      userIds: [r.client_id],
      type: r.kind === 'day_before' ? 'consulting.reminder_day' : 'consulting.reminder_hour',
      params: (l) => ({ offerTitle: title(l), date: formatDate(r.starts_at, l, true), mode: r.mode, location: r.location }),
      link: `/consulting/bookings/${r.booking_id}`,
    });
    // L'équipe est prévenue une fois, la veille (ou 1 h avant si réservé tardivement).
    if (r.kind === 'day_before' || !(await hadDayBefore(r.booking_id))) {
      const c = await bookingContext(r.booking_id);
      await notify({
        userIds: await staffIds(r.advisor_id),
        type: 'consulting.reminder_staff',
        params: (l) => ({
          clientName: c?.clientName ?? '—',
          offerTitle: title(l),
          date: formatDate(r.starts_at, l, true),
          mode: r.mode,
          phone: c?.clientPhone ?? '',
        }),
        link: `/consulting/manage/${r.booking_id}`,
      });
    }
    result.reminders += 1;
  }
  return result;
}

async function hadDayBefore(bookingId: string): Promise<boolean> {
  const { data } = await createAdminClient()
    .from('consulting_reminders')
    .select('kind')
    .eq('booking_id', bookingId)
    .eq('kind', 'day_before')
    .maybeSingle();
  return Boolean(data);
}

/**
 * Exécute une tâche en la journalisant (table job_runs) : début, fin, bilan,
 * ou erreur. Un échec est signalé dans le journal et dans les logs du serveur.
 */
export async function runLoggedJob<T extends object>(job: string, fn: () => Promise<T>): Promise<T | { error: string }> {
  const admin = createAdminClient();
  const { data: run } = await admin.from('job_runs').insert({ job }).select('id').single();
  try {
    const details = await fn();
    if (run) await admin.from('job_runs').update({ status: 'ok', finished_at: new Date().toISOString(), details }).eq('id', run.id);
    return details;
  } catch (e) {
    const message = (e as Error).message.slice(0, 2000);
    console.error(`[cron] ${job} en échec`, message);
    if (run) await admin.from('job_runs').update({ status: 'error', finished_at: new Date().toISOString(), error: message }).eq('id', run.id);
    return { error: message };
  }
}
