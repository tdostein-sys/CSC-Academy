import { NextResponse, type NextRequest } from 'next/server';
import { WebhookReceiver } from 'livekit-server-sdk';
import { createAdminClient } from '@/lib/supabase/admin';
import { liveConfig, recordEgressResult } from '@/lib/academy/live';

/**
 * Notifications envoyées par LiveKit Cloud (à déclarer dans LiveKit ›
 * Settings › Webhooks, adresse : <site>/api/livekit/webhook).
 * Signature vérifiée avec nos clés LiveKit : un appel non signé est refusé.
 *  - fin d'enregistrement → enregistrement prêt (ou échoué) en base ;
 *  - salle terminée (tout le monde est parti) → salle fermée en base.
 */
export async function POST(request: NextRequest) {
  const cfg = liveConfig();
  if (!cfg) return NextResponse.json({ error: 'unavailable' }, { status: 503 });

  const body = await request.text();
  let event;
  try {
    event = await new WebhookReceiver(cfg.key, cfg.secret).receive(body, request.headers.get('authorization') ?? undefined);
  } catch {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    if ((event.event === 'egress_ended' || event.event === 'egress_updated') && event.egressInfo) {
      await recordEgressResult(event.egressInfo);
    } else if (event.event === 'room_finished' && event.room?.name) {
      const { error } = await createAdminClient().rpc('academy_live_room_finished', { p_room: event.room.name });
      if (error) console.error('[live] fermeture de salle non enregistrée', error.message);
    }
  } catch (e) {
    console.error('[live] notification LiveKit non traitée', (e as Error).message);
  }
  return NextResponse.json({ ok: true });
}
