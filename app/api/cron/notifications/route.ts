import { NextResponse, type NextRequest } from 'next/server';
import { dispatchPendingDeliveries } from '@/lib/notifications';

/**
 * Reprise des envois de notifications en attente / en échec.
 * À appeler périodiquement (cron) avec l'en-tête :
 *   Authorization: Bearer <CRON_SECRET>
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const result = await dispatchPendingDeliveries(100);
  return NextResponse.json(result);
}
