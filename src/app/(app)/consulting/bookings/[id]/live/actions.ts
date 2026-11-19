'use server';

import { z } from 'zod';
import { assertUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { consultingErrorKey } from '@/lib/consulting/errors';
import { closeConsultRoom, consultRoomName, consultToken, ensureConsultRoom, liveConfig } from '@/lib/consulting/live';

/*
 * Visio CSC Consulting. Double contrôle : l'utilisateur est vérifié ici, puis
 * la base décide (consulting_join : client du rendez-vous confirmé, conseiller
 * attribué ou admin, dans la fenêtre horaire). LiveKit n'est appelé qu'ensuite.
 */

const uuid = z.uuid();
const fail = (error: string) => ({ ok: false as const, error });

export type ConsultJoinResult =
  | { ok: true; token: string; serverUrl: string; isHost: boolean; endsAt: string }
  | { ok: false; error: string };

export async function joinConsultation(bookingId: string): Promise<ConsultJoinResult> {
  const user = await assertUser().catch(() => null);
  if (!user) return fail('errors.forbidden');
  if (!uuid.safeParse(bookingId).success) return fail('errors.generic');
  const cfg = liveConfig();
  if (!cfg) return fail('consulting.errors.live_not_configured');

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('consulting_join', { p_booking: bookingId });
  if (error) return fail(consultingErrorKey(error));
  const row = (data as { room_name: string; is_host: boolean; ends_at: string; display_name: string }[] | null)?.[0];
  if (!row) return fail('errors.generic');

  try {
    await ensureConsultRoom(row.room_name);
    const token = await consultToken({
      room: row.room_name,
      identity: user.id,
      name: row.display_name,
      isHost: row.is_host,
      ttlSeconds: Math.floor((new Date(row.ends_at).getTime() - Date.now()) / 1000),
    });
    return { ok: true, token, serverUrl: cfg.wsUrl, isHost: row.is_host, endsAt: row.ends_at };
  } catch (e) {
    console.error('[consulting] visio impossible', (e as Error).message);
    return fail('consulting.errors.live_unreachable');
  }
}

/** Conseiller ou admin : terminer la consultation pour tous. */
export async function endConsultation(bookingId: string): Promise<{ ok: boolean; error?: string }> {
  const user = await assertUser().catch(() => null);
  if (!user) return fail('errors.forbidden');
  if (!uuid.safeParse(bookingId).success) return fail('errors.generic');
  const supabase = await createClient();
  const { data: allowed } = await supabase.rpc('consulting_can_manage', { p_booking: bookingId });
  if (allowed !== true) return fail('errors.forbidden');
  if (liveConfig()) await closeConsultRoom(consultRoomName(bookingId));
  return { ok: true };
}
