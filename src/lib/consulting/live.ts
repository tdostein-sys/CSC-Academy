import 'server-only';
import { AccessToken, RoomServiceClient, TrackSource } from 'livekit-server-sdk';
import { liveConfig } from '@/lib/academy/live';

/*
 * Visio CSC Consulting (même projet LiveKit Cloud que CSC Academy).
 * Consultation en tête-à-tête : le conseiller et le client publient tous
 * deux caméra, micro et partage d'écran. Aucun enregistrement
 * (confidentialité). Chaque fonction est appelée APRÈS consulting_join()
 * ou consulting_can_manage() : la base décide qui entre, et quand.
 */

export { liveConfig };

export const consultRoomName = (bookingId: string) => `csc-consult-${bookingId}`;

function rooms() {
  const c = liveConfig();
  if (!c) throw new Error('live_not_configured');
  return new RoomServiceClient(c.httpUrl, c.key, c.secret);
}

/** Crée la salle si besoin (2 participants + 1 collaborateur supplémentaire au plus). */
export async function ensureConsultRoom(room: string) {
  await rooms().createRoom({ name: room, emptyTimeout: 10 * 60, departureTimeout: 60, maxParticipants: 3 });
}

/** Termine la consultation : tout le monde est déconnecté. */
export async function closeConsultRoom(room: string) {
  try {
    await rooms().deleteRoom(room);
  } catch {
    // Salle déjà fermée : rien à faire.
  }
}

/** Jeton d'accès nominatif, valable jusqu'à la fin de la fenêtre d'accès. */
export async function consultToken(opts: { room: string; identity: string; name: string; isHost: boolean; ttlSeconds: number }) {
  const c = liveConfig();
  if (!c) throw new Error('live_not_configured');
  const at = new AccessToken(c.key, c.secret, {
    identity: opts.identity,
    name: opts.name,
    ttl: Math.max(600, Math.min(opts.ttlSeconds, 6 * 3600)),
    attributes: { role: opts.isHost ? 'host' : 'client' },
  });
  at.addGrant({
    roomJoin: true,
    room: opts.room,
    canSubscribe: true,
    canPublish: true,
    canPublishData: true,
    canUpdateOwnMetadata: false,
    canPublishSources: [TrackSource.CAMERA, TrackSource.MICROPHONE, TrackSource.SCREEN_SHARE, TrackSource.SCREEN_SHARE_AUDIO],
    ...(opts.isHost ? { roomAdmin: true } : {}),
  });
  return at.toJwt();
}
