/**
 * Visio CSC Academy : règles partagées entre le serveur et le navigateur
 * (aucun secret ici).
 */

/** Attributs de participant posés par NOTRE serveur (jamais par le navigateur). */
export const ATTR_ROLE = 'csc.role';
export const ATTR_HAND = 'csc.hand';

export type LiveSource = 'microphone' | 'camera' | 'screen_share';

/** Numéros des sources dans le protocole LiveKit (TrackSource). */
const SOURCE_CODES: Record<LiveSource, number> = { camera: 1, microphone: 2, screen_share: 3 };

/** Droits d'un étudiant dans la salle, décidés par l'animateur. */
export interface StudentAccess {
  mic: boolean;
  camera: boolean;
}

/** Sources qu'un étudiant peut publier (vide = rien : il écoute et regarde). */
export function studentSources(a: StudentAccess): LiveSource[] {
  const out: LiveSource[] = [];
  if (a.mic) out.push('microphone');
  if (a.camera) out.push('camera');
  return out;
}

/**
 * Le participant peut-il publier cette source ? Dans LiveKit, une liste de
 * sources vide signifie « toutes » : seul `canPublish` fait alors foi.
 */
export function canPublishSource(
  perm: { canPublish?: boolean; canPublishSources?: number[] } | undefined,
  source: LiveSource,
): boolean {
  if (!perm?.canPublish) return false;
  const list = perm.canPublishSources ?? [];
  return list.length === 0 || list.includes(SOURCE_CODES[source]);
}

/** Accès actuel d'un étudiant, lu dans ses droits LiveKit. */
export function accessFromPermission(perm: { canPublish?: boolean; canPublishSources?: number[] } | undefined): StudentAccess {
  return { mic: canPublishSource(perm, 'microphone'), camera: canPublishSource(perm, 'camera') };
}

/** Réponses des actions de visio (`error` = clé de message traduite). */
export type LiveActionResult = { ok: true; recording?: 'started' | 'already' | 'disabled' | 'failed' } | { ok: false; error: string };
export type LiveJoinResult = { ok: true; token: string; serverUrl: string; isHost: boolean; endsAt: string } | { ok: false; error: string };

/** Nom de la salle LiveKit d'une séance (identique à la base). */
export const liveRoomName = (meetingId: string) => `csc-academy-${meetingId}`;

/** Chemin du fichier d'enregistrement dans le stockage. */
export function recordingObjectKey(sessionId: string, meetingId: string, now = new Date()): string {
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  return `recordings/${sessionId}/${meetingId}/${stamp}.mp4`;
}

/** Durée lisible (ex. 59 min, 1 h 05). */
export function formatDuration(seconds: number | null | undefined): string {
  const s = Math.max(0, Math.round(Number(seconds ?? 0)));
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}`;
}

/** Taille lisible en Mo / Go. */
export function formatSize(bytes: number | string | null | undefined, locale: 'fr' | 'en'): string {
  const b = Number(bytes ?? 0) || 0;
  const fmt = (v: number) => v.toLocaleString(locale === 'fr' ? 'fr-FR' : 'en-US', { maximumFractionDigits: 1 });
  if (b >= 1e9) return `${fmt(b / 1e9)} ${locale === 'fr' ? 'Go' : 'GB'}`;
  return `${fmt(Math.max(b / 1e6, 0.1))} ${locale === 'fr' ? 'Mo' : 'MB'}`;
}
