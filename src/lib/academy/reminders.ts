import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { notify } from '@/lib/notifications';
import { formatDate, formatXAF } from '@/lib/format';
import { localized } from '@/lib/localized';
import { purgeExpiredRecordings, reconcileRecordings } from './live';

interface ReminderRow {
  enrollment_id: string;
  student_id: string;
  rank: number;
  kind: 'due_soon' | 'due_today' | 'blocked';
  amount_due: number | string;
  due_on: string;
  blocks_on: string;
  course_title_fr: string;
  course_title_en: string;
}

/**
 * Tâche quotidienne CSC Academy (appelée par /api/cron/notifications) :
 *  1. libère les places réservées non payées depuis 3 jours ;
 *  2. envoie les rappels J-3 et J et les avis de blocage (J+3) ;
 *  3. visio : met à jour les enregistrements terminés et efface du stockage
 *     ceux qui ont plus de 7 jours.
 * La base choisit les rappels à envoyer et garantit qu'aucun ne part deux
 * fois ; le serveur se contente de les rédiger dans la langue de chacun.
 */
export interface AcademyDailyResult {
  releasedHolds: number;
  reminders: number;
  recordingsUpdated: number;
  recordingsDeleted: number;
}

export async function runAcademyDailyTasks(): Promise<AcademyDailyResult> {
  const admin = createAdminClient();
  const result: AcademyDailyResult = { releasedHolds: 0, reminders: 0, recordingsUpdated: 0, recordingsDeleted: 0 };

  try {
    result.recordingsUpdated = await reconcileRecordings();
    result.recordingsDeleted = await purgeExpiredRecordings();
  } catch (e) {
    console.error('[academy] entretien des enregistrements impossible', (e as Error).message);
  }

  const { data: released, error: relErr } = await admin.rpc('academy_release_expired_holds', { p_session: null });
  if (relErr) console.error('[academy] libération des réservations impossible', relErr.message);
  else result.releasedHolds = Number(released ?? 0);

  const { data, error } = await admin.rpc('academy_claim_reminders', { p_limit: 500 });
  if (error) {
    console.error('[academy] rappels impossibles', error.message);
    return result;
  }
  for (const r of (data ?? []) as ReminderRow[]) {
    const title = (l: 'fr' | 'en') => localized(l, r.course_title_fr, r.course_title_en);
    const amount = (l: 'fr' | 'en') => formatXAF(r.amount_due, l);
    const link = `/student/${r.enrollment_id}`;
    if (r.kind === 'due_soon') {
      await notify({
        userIds: [r.student_id],
        type: 'academy.reminder_due_soon',
        params: (l) => ({ courseTitle: title(l), rank: r.rank, amount: amount(l), dueDate: formatDate(r.due_on, l) }),
        link,
      });
    } else if (r.kind === 'due_today') {
      await notify({
        userIds: [r.student_id],
        type: 'academy.reminder_due_today',
        params: (l) => ({ courseTitle: title(l), rank: r.rank, amount: amount(l), blockDate: formatDate(r.blocks_on, l) }),
        link,
      });
    } else {
      await notify({
        userIds: [r.student_id],
        type: 'academy.access_blocked',
        params: (l) => ({ courseTitle: title(l), rank: r.rank, amount: amount(l) }),
        link,
      });
    }
    result.reminders += 1;
  }
  return result;
}
