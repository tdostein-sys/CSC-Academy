import { NextResponse, type NextRequest } from 'next/server';
import { dispatchPendingDeliveries } from '@/lib/notifications';
import { runAcademyDailyTasks, type AcademyDailyResult } from '@/lib/academy/reminders';

/**
 * Tâche planifiée (une fois par jour, voir vercel.json) :
 *  - CSC Academy : libération des places non payées, rappels de paiement
 *    J-3 / J et avis de blocage J+3, enregistrements de visio (suppression
 *    après 7 jours) ;
 *  - reprise des envois de notifications en attente / en échec.
 * À appeler avec l'en-tête :
 *   Authorization: Bearer <CRON_SECRET>
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  let academy: AcademyDailyResult = { releasedHolds: 0, reminders: 0, recordingsUpdated: 0, recordingsDeleted: 0 };
  try {
    academy = await runAcademyDailyTasks();
  } catch (e) {
    console.error('[cron] tâches Academy impossibles', (e as Error).message);
  }
  const result = await dispatchPendingDeliveries(100);
  return NextResponse.json({ ...result, academy });
}
