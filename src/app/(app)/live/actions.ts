'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { assertAdmin, assertUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { academyErrorKey } from '@/lib/academy/errors';
import {
  closeRoom,
  ensureRoom,
  liveConfig,
  liveToken,
  muteAllStudents,
  participantRole,
  setHand,
  setStudentAccess,
  startRecording,
  stopRecordings,
} from '@/lib/academy/live';
import type { LiveActionResult, LiveJoinResult } from '@/lib/academy/live-shared';

/*
 * Actions de la visio CSC Academy.
 * Double contrôle : chaque action vérifie l'utilisateur (et le rôle admin pour
 * l'animateur), PUIS la base revérifie tout (academy_join_meeting,
 * academy_open_live_room, RLS des salles). LiveKit n'est appelé qu'ensuite.
 */

const uuid = z.uuid();
const fail = (error: string) => ({ ok: false as const, error });
const NOT_CONFIGURED = 'academy.errors.live_not_configured';

async function openRoomName(meetingId: string): Promise<string | null> {
  // RLS : la salle n'est visible que de ceux qui ont accès à la session
  // (inscrits actifs non bloqués, administrateur).
  const supabase = await createClient();
  const { data } = await supabase.from('academy_live_rooms').select('room_name, closed_at').eq('meeting_id', meetingId).maybeSingle();
  const r = data as { room_name: string; closed_at: string | null } | null;
  return r && !r.closed_at ? r.room_name : null;
}

function refresh(meetingId: string) {
  revalidatePath(`/live/${meetingId}`);
  revalidatePath('/student', 'layout');
  revalidatePath('/admin/academy', 'layout');
}

/** Entrer dans la salle : la base décide du rôle, le serveur signe le jeton. */
export async function joinLive(meetingId: string): Promise<LiveJoinResult> {
  const user = await assertUser().catch(() => null);
  if (!user) return fail('errors.forbidden');
  if (!uuid.safeParse(meetingId).success) return fail('errors.generic');
  const cfg = liveConfig();
  if (!cfg) return fail(NOT_CONFIGURED);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('academy_join_meeting', { p_meeting: meetingId });
  if (error) return fail(academyErrorKey(error));
  const row = (data as { room_name: string; is_host: boolean; ends_at: string; display_name: string }[] | null)?.[0];
  if (!row) return fail('errors.generic');

  try {
    if (row.is_host) await ensureRoom(row.room_name);
    const token = await liveToken({
      room: row.room_name,
      identity: user.id,
      name: row.display_name,
      isHost: row.is_host,
      ttlSeconds: Math.floor((new Date(row.ends_at).getTime() - Date.now()) / 1000),
    });
    return { ok: true, token, serverUrl: cfg.wsUrl, isHost: row.is_host, endsAt: row.ends_at };
  } catch (e) {
    console.error('[live] jeton impossible', (e as Error).message);
    return fail('academy.live.errors.unreachable');
  }
}

/** Animateur : ouvrir la salle et lancer l'enregistrement. */
export async function openLive(meetingId: string): Promise<LiveActionResult> {
  if (!(await assertAdmin().catch(() => null))) return fail('errors.forbidden');
  if (!uuid.safeParse(meetingId).success) return fail('errors.generic');
  if (!liveConfig()) return fail(NOT_CONFIGURED);

  const supabase = await createClient();
  const { data: room, error } = await supabase.rpc('academy_open_live_room', { p_meeting: meetingId });
  if (error || typeof room !== 'string') return fail(academyErrorKey(error));
  const { data: meeting } = await supabase.from('academy_meetings').select('session_id').eq('id', meetingId).single();

  try {
    await ensureRoom(room);
  } catch (e) {
    console.error('[live] salle LiveKit impossible', (e as Error).message);
    await supabase.rpc('academy_close_live_room', { p_meeting: meetingId });
    return fail('academy.live.errors.unreachable');
  }

  let recording: 'started' | 'already' | 'disabled' | 'failed' = 'disabled';
  if (meeting) {
    try {
      recording = await startRecording(meetingId, (meeting as { session_id: string }).session_id, room);
    } catch (e) {
      console.error('[live] enregistrement impossible', (e as Error).message);
      recording = 'failed';
    }
  }
  refresh(meetingId);
  return { ok: true, recording };
}

/** Animateur : terminer la séance (tout le monde est déconnecté). */
export async function closeLive(meetingId: string): Promise<LiveActionResult> {
  if (!(await assertAdmin().catch(() => null))) return fail('errors.forbidden');
  if (!uuid.safeParse(meetingId).success) return fail('errors.generic');
  const supabase = await createClient();
  const { data } = await supabase.from('academy_live_rooms').select('room_name').eq('meeting_id', meetingId).maybeSingle();
  const { error } = await supabase.rpc('academy_close_live_room', { p_meeting: meetingId });
  if (error) return fail(academyErrorKey(error));
  if (data && liveConfig()) {
    await stopRecordings(meetingId);
    await closeRoom((data as { room_name: string }).room_name);
  }
  refresh(meetingId);
  return { ok: true };
}

const accessSchema = z.object({ meetingId: uuid, identity: uuid, mic: z.boolean(), camera: z.boolean() });

/** Animateur : donner / retirer la parole (micro) et la caméra à un étudiant. */
export async function setParticipantAccess(meetingId: string, identity: string, mic: boolean, camera: boolean): Promise<LiveActionResult> {
  if (!(await assertAdmin().catch(() => null))) return fail('errors.forbidden');
  const parsed = accessSchema.safeParse({ meetingId, identity, mic, camera });
  if (!parsed.success) return fail('errors.generic');
  const room = await openRoomName(meetingId);
  if (!room) return fail('academy.errors.meeting_not_live');
  if ((await participantRole(room, identity)) !== 'student') return fail('academy.live.errors.participantGone');
  try {
    await setStudentAccess(room, identity, { mic, camera });
    return { ok: true };
  } catch {
    return fail('academy.live.errors.unreachable');
  }
}

/** Animateur : baisser la main d'un étudiant. */
export async function lowerHand(meetingId: string, identity: string): Promise<LiveActionResult> {
  if (!(await assertAdmin().catch(() => null))) return fail('errors.forbidden');
  if (!uuid.safeParse(meetingId).success || !uuid.safeParse(identity).success) return fail('errors.generic');
  const room = await openRoomName(meetingId);
  if (!room) return fail('academy.errors.meeting_not_live');
  try {
    await setHand(room, identity, false);
    return { ok: true };
  } catch {
    return fail('academy.live.errors.participantGone');
  }
}

/** Animateur : couper tous les micros et caméras des étudiants. */
export async function muteEveryone(meetingId: string): Promise<LiveActionResult> {
  if (!(await assertAdmin().catch(() => null))) return fail('errors.forbidden');
  if (!uuid.safeParse(meetingId).success) return fail('errors.generic');
  const room = await openRoomName(meetingId);
  if (!room) return fail('academy.errors.meeting_not_live');
  try {
    await muteAllStudents(room);
    return { ok: true };
  } catch {
    return fail('academy.live.errors.unreachable');
  }
}

/** Étudiant : lever / baisser la main (posé par le serveur, jamais par le navigateur). */
export async function raiseHand(meetingId: string, up: boolean): Promise<LiveActionResult> {
  const user = await assertUser().catch(() => null);
  if (!user) return fail('errors.forbidden');
  if (!uuid.safeParse(meetingId).success || typeof up !== 'boolean') return fail('errors.generic');
  const room = await openRoomName(meetingId);
  if (!room) return fail('academy.errors.meeting_not_live');
  if ((await participantRole(room, user.id)) !== 'student') return fail('academy.live.errors.participantGone');
  try {
    await setHand(room, user.id, up);
    return { ok: true };
  } catch {
    return fail('academy.live.errors.unreachable');
  }
}
