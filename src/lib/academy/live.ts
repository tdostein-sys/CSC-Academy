import 'server-only';
import {
  AccessToken,
  EgressClient,
  EgressStatus,
  EncodedFileOutput,
  EncodedFileType,
  RoomServiceClient,
  S3Upload,
  TrackSource,
  type EgressInfo,
} from 'livekit-server-sdk';
import { createAdminClient } from '@/lib/supabase/admin';
import { presignUrl } from '@/lib/s3-presign';
import { ADMIN_LINK_SECONDS, ATTR_HAND, ATTR_ROLE, linkLifetimeSeconds, recordingObjectKey, studentSources, type StudentAccess } from './live-shared';

/*
 * Visio CSC Academy (LiveKit Cloud) et enregistrements (stockage compatible
 * S3, ex. Cloudflare R2). Serveur uniquement : les clés ne quittent jamais
 * le serveur. Chaque fonction est appelée APRÈS la vérification des droits
 * par la base (academy_join_meeting, academy_open_live_room…).
 */

// -----------------------------------------------------------------------------
// Configuration
// -----------------------------------------------------------------------------
export function liveConfig() {
  const url = process.env.LIVEKIT_URL?.trim() ?? '';
  const key = process.env.LIVEKIT_API_KEY?.trim() ?? '';
  const secret = process.env.LIVEKIT_API_SECRET?.trim() ?? '';
  if (!/^wss?:\/\/[^/]+/.test(url) || !key || !secret) return null;
  return { wsUrl: url.replace(/\/$/, ''), httpUrl: url.replace(/^ws/, 'http').replace(/\/$/, ''), key, secret };
}

export function storageConfig() {
  const endpoint = process.env.RECORDINGS_S3_ENDPOINT?.trim().replace(/\/$/, '') ?? '';
  const bucket = process.env.RECORDINGS_S3_BUCKET?.trim() ?? '';
  const accessKeyId = process.env.RECORDINGS_S3_ACCESS_KEY_ID?.trim() ?? '';
  const secretAccessKey = process.env.RECORDINGS_S3_SECRET_ACCESS_KEY?.trim() ?? '';
  if (!/^https:\/\/[^/]+$/.test(endpoint) || !bucket || !accessKeyId || !secretAccessKey) return null;
  return { endpoint, bucket, accessKeyId, secretAccessKey, region: 'auto' };
}

function requireLive() {
  const cfg = liveConfig();
  if (!cfg) throw new Error('live_not_configured');
  return cfg;
}

const rooms = () => {
  const c = requireLive();
  return new RoomServiceClient(c.httpUrl, c.key, c.secret);
};
const egress = () => {
  const c = requireLive();
  return new EgressClient(c.httpUrl, c.key, c.secret);
};

// -----------------------------------------------------------------------------
// Salle et jetons d'accès
// -----------------------------------------------------------------------------

/** Crée la salle si besoin (sans effet si elle existe déjà). */
export async function ensureRoom(room: string) {
  await rooms().createRoom({
    name: room,
    emptyTimeout: 10 * 60, // fermée 10 min après le départ du dernier participant
    departureTimeout: 60,
    maxParticipants: 60,
  });
}

/** Ferme la salle : tout le monde est déconnecté. */
export async function closeRoom(room: string) {
  try {
    await rooms().deleteRoom(room);
  } catch {
    // Salle déjà fermée : rien à faire.
  }
}

/**
 * Jeton d'accès LiveKit. Animateur : publie caméra, micro et partage d'écran,
 * administre la salle. Étudiant : écoute, regarde et écrit dans le chat ; il
 * ne publie rien tant que l'animateur ne l'y autorise pas. Personne ne peut
 * changer lui-même son nom ni ses attributs (main levée posée par le serveur).
 */
export async function liveToken(opts: { room: string; identity: string; name: string; isHost: boolean; ttlSeconds: number }) {
  const c = requireLive();
  const at = new AccessToken(c.key, c.secret, {
    identity: opts.identity,
    name: opts.name,
    ttl: Math.max(600, Math.min(opts.ttlSeconds, 4 * 3600)),
    attributes: { [ATTR_ROLE]: opts.isHost ? 'host' : 'student' },
  });
  at.addGrant({
    roomJoin: true,
    room: opts.room,
    canSubscribe: true,
    canPublishData: true,
    canUpdateOwnMetadata: false,
    canPublish: opts.isHost,
    ...(opts.isHost
      ? { roomAdmin: true, canPublishSources: [TrackSource.CAMERA, TrackSource.MICROPHONE, TrackSource.SCREEN_SHARE, TrackSource.SCREEN_SHARE_AUDIO] }
      : {}),
  });
  return at.toJwt();
}

/** Rôle d'un participant connecté (lu dans les attributs posés par le serveur). */
export async function participantRole(room: string, identity: string): Promise<'host' | 'student' | null> {
  try {
    const p = await rooms().getParticipant(room, identity);
    return p.attributes?.[ATTR_ROLE] === 'host' ? 'host' : 'student';
  } catch {
    return null;
  }
}

/**
 * Micro / caméra d'un étudiant. Les droits LiveKit sont remplacés en bloc :
 * tout est donc renvoyé à chaque fois. Un droit retiré coupe aussitôt la
 * source correspondante.
 */
export async function setStudentAccess(room: string, identity: string, access: StudentAccess) {
  const sources = studentSources(access).map((s) => (s === 'microphone' ? TrackSource.MICROPHONE : TrackSource.CAMERA));
  await rooms().updateParticipant(room, identity, {
    permission: {
      canSubscribe: true,
      canPublishData: true,
      canUpdateMetadata: false,
      canPublish: sources.length > 0,
      canPublishSources: sources,
    },
    ...(access.mic ? { attributes: { [ATTR_HAND]: '' } } : {}),
  });
}

/** Lever / baisser la main (valeur = heure de la demande, pour l'ordre d'arrivée). */
export async function setHand(room: string, identity: string, up: boolean) {
  await rooms().updateParticipant(room, identity, { attributes: { [ATTR_HAND]: up ? String(Date.now()) : '' } });
}

/** Retire la parole à tous les étudiants et baisse toutes les mains. */
export async function muteAllStudents(room: string) {
  const list = await rooms().listParticipants(room);
  await Promise.all(
    list
      .filter((p) => p.attributes?.[ATTR_ROLE] === 'student')
      .map((p) => setStudentAccess(room, p.identity, { mic: false, camera: false }).catch(() => undefined)),
  );
  await Promise.all(
    list.filter((p) => p.attributes?.[ATTR_HAND]).map((p) => setHand(room, p.identity, false).catch(() => undefined)),
  );
}

// -----------------------------------------------------------------------------
// Enregistrements
// -----------------------------------------------------------------------------

const FINAL_STATUSES = [EgressStatus.EGRESS_COMPLETE, EgressStatus.EGRESS_FAILED, EgressStatus.EGRESS_ABORTED, EgressStatus.EGRESS_LIMIT_REACHED];

/**
 * Lance l'enregistrement de la salle (vue « orateur » : l'animateur ou son
 * partage d'écran en grand), écrit directement dans notre stockage.
 * Sans stockage configuré, la séance a lieu sans enregistrement.
 */
export async function startRecording(meetingId: string, sessionId: string, room: string): Promise<'started' | 'already' | 'disabled'> {
  const st = storageConfig();
  if (!st || !liveConfig()) return 'disabled';
  const admin = createAdminClient();
  const { data: active } = await admin.from('academy_recordings').select('id').eq('meeting_id', meetingId).eq('status', 'recording').limit(1);
  if (active && active.length > 0) return 'already';

  const objectKey = recordingObjectKey(sessionId, meetingId);
  const output = new EncodedFileOutput({
    fileType: EncodedFileType.MP4,
    filepath: objectKey,
    output: {
      case: 's3',
      value: new S3Upload({
        accessKey: st.accessKeyId,
        secret: st.secretAccessKey,
        region: st.region,
        endpoint: st.endpoint,
        bucket: st.bucket,
        forcePathStyle: true,
      }),
    },
  });
  const info = await egress().startRoomCompositeEgress(room, output, { layout: 'speaker' });
  const { error } = await admin.rpc('academy_recording_started', { p_meeting: meetingId, p_egress_id: info.egressId, p_object_key: objectKey });
  if (error) console.error('[live] enregistrement non déclaré en base', error.message);
  return 'started';
}

/** Met à jour la base quand LiveKit signale la fin d'un enregistrement. */
export async function recordEgressResult(info: EgressInfo) {
  if (!FINAL_STATUSES.includes(info.status)) return;
  const file = info.fileResults?.[0];
  const size = file ? Number(file.size) : 0;
  const duration = file ? Math.round(Number(file.duration) / 1e9) : 0;
  const ok = size > 0 && (info.status === EgressStatus.EGRESS_COMPLETE || info.status === EgressStatus.EGRESS_LIMIT_REACHED);
  const { error } = await createAdminClient().rpc('academy_recording_finished', {
    p_egress_id: info.egressId,
    p_ok: ok,
    p_duration_seconds: duration,
    p_size_bytes: size,
  });
  if (error) console.error('[live] fin d’enregistrement non enregistrée', error.message);
}

/** Arrête les enregistrements en cours d'une séance. */
export async function stopRecordings(meetingId: string) {
  if (!liveConfig()) return;
  const { data } = await createAdminClient().from('academy_recordings').select('egress_id').eq('meeting_id', meetingId).eq('status', 'recording');
  for (const r of (data ?? []) as { egress_id: string }[]) {
    try {
      await recordEgressResult(await egress().stopEgress(r.egress_id));
    } catch {
      // Déjà arrêté : le rattrapage quotidien ou la notification LiveKit mettra la base à jour.
    }
  }
}

/**
 * Rattrapage : interroge LiveKit pour les enregistrements restés « en cours »
 * (notification manquée, site en local…).
 */
export async function reconcileRecordings(): Promise<number> {
  if (!liveConfig()) return 0;
  const admin = createAdminClient();
  const { data } = await admin
    .from('academy_recordings')
    .select('egress_id, started_at')
    .eq('status', 'recording')
    .lt('started_at', new Date(Date.now() - 60_000).toISOString())
    .limit(50);
  let done = 0;
  for (const r of (data ?? []) as { egress_id: string; started_at: string }[]) {
    try {
      const [info] = await egress().listEgress({ egressId: r.egress_id });
      if (info && FINAL_STATUSES.includes(info.status)) {
        await recordEgressResult(info);
        done += 1;
      } else if (!info && Date.now() - new Date(r.started_at).getTime() > 6 * 3600_000) {
        await admin.rpc('academy_recording_finished', { p_egress_id: r.egress_id, p_ok: false });
        done += 1;
      }
    } catch {
      // LiveKit injoignable : nouvel essai au prochain passage.
    }
  }
  return done;
}

const objectPath = (bucket: string, key: string) => `/${bucket}/${key}`;

/**
 * Lien de lecture temporaire, valable jusqu'à `until` (fin du droit de
 * lecture) sans dépasser `maxSeconds`. Rien après ce délai.
 */
export function playbackUrl(objectKey: string, until: string, maxSeconds = ADMIN_LINK_SECONDS): string | null {
  const st = storageConfig();
  if (!st) return null;
  const lifetime = linkLifetimeSeconds(until, Date.now(), maxSeconds);
  if (lifetime <= 0) return null;
  return presignUrl({
    method: 'GET',
    endpoint: st.endpoint,
    path: objectPath(st.bucket, objectKey),
    region: st.region,
    accessKeyId: st.accessKeyId,
    secretAccessKey: st.secretAccessKey,
    expiresIn: lifetime,
    query: { 'response-content-type': 'video/mp4', 'response-content-disposition': 'inline' },
  });
}

/**
 * Efface du stockage les enregistrements expirés (7 jours), puis les marque
 * supprimés en base. Un échec laisse l'enregistrement dans la liste : il sera
 * retenté au prochain passage.
 */
export async function purgeExpiredRecordings(onlyId?: string): Promise<number> {
  const st = storageConfig();
  if (!st) return 0;
  const admin = createAdminClient();
  const { data, error } = await admin.rpc('academy_expired_recordings', { p_limit: 100 });
  if (error) {
    console.error('[live] liste des enregistrements expirés indisponible', error.message);
    return 0;
  }
  let purged = 0;
  for (const r of (data ?? []) as { id: string; object_key: string }[]) {
    if (onlyId && r.id !== onlyId) continue;
    const url = presignUrl({
      method: 'DELETE',
      endpoint: st.endpoint,
      path: objectPath(st.bucket, r.object_key),
      region: st.region,
      accessKeyId: st.accessKeyId,
      secretAccessKey: st.secretAccessKey,
      expiresIn: 300,
    });
    try {
      const res = await fetch(url, { method: 'DELETE', cache: 'no-store' });
      if (!res.ok && res.status !== 404) {
        console.error('[live] suppression du fichier refusée', res.status);
        continue;
      }
      await admin.rpc('academy_mark_recording_deleted', { p_id: r.id });
      purged += 1;
    } catch {
      // Stockage injoignable : nouvel essai au prochain passage.
    }
  }
  return purged;
}
