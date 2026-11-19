import { NextResponse, type NextRequest } from 'next/server';
import { dispatchPendingDeliveries } from '@/lib/notifications';
import { runConsultingTasks, runLoggedJob } from '@/lib/consulting/tasks';
import { isCronAuthorized } from '@/lib/cron';

/**
 * Tâche fréquente (toutes les 15 minutes) : rappels « 1 h avant » et
 * expiration des réservations non payées de CSC Consulting, puis envois en
 * attente. L'offre gratuite de Vercel n'autorise qu'un cron par jour : cette
 * route est appelée par Supabase (pg_cron + pg_net), voir
 * docs/CSC_CONSULTING_LOT_C1.md. Idempotente : peut être relancée sans doublon.
 * En-tête requis : Authorization: Bearer <CRON_SECRET>
 */
export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const consulting = await runLoggedJob('consulting.frequent', runConsultingTasks);
  const deliveries = await dispatchPendingDeliveries(50).catch((e: Error) => ({ error: e.message }));
  return NextResponse.json({ consulting, deliveries });
}

/** pg_net envoie par défaut des requêtes POST : même traitement. */
export const POST = GET;
