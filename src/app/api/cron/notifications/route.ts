import { NextResponse, type NextRequest } from 'next/server';
import { dispatchPendingDeliveries } from '@/lib/notifications';
import { runAcademyDailyTasks, type AcademyDailyResult } from '@/lib/academy/reminders';
import { runConsultingTasks, runLoggedJob } from '@/lib/consulting/tasks';
import { isCronAuthorized } from '@/lib/cron';

/**
 * Tâche planifiée (une fois par jour, voir vercel.json) :
 *  - CSC Academy : libération des places non payées, rappels de paiement
 *    J-3 / J et avis de blocage J+3, enregistrements de visio (suppression
 *    après 7 jours) ;
 *  - CSC Consulting : filet de sécurité de la tâche toutes les 15 minutes
 *    (/api/cron/frequent) — expirations, avis, rappels ;
 *  - reprise des envois de notifications en attente / en échec.
 * À appeler avec l'en-tête :
 *   Authorization: Bearer <CRON_SECRET>
 */
export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  let academy: AcademyDailyResult = { releasedHolds: 0, reminders: 0, recordingsUpdated: 0, recordingsDeleted: 0 };
  try {
    academy = await runAcademyDailyTasks();
  } catch (e) {
    console.error('[cron] tâches Academy impossibles', (e as Error).message);
  }
  const consulting = await runLoggedJob('consulting.daily', runConsultingTasks);
  const result = await dispatchPendingDeliveries(100);
  return NextResponse.json({ ...result, academy, consulting });
}
