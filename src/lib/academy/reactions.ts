/**
 * Réactions emoji éphémères de la salle de visio. Elles passent par le canal
 * de données LiveKit (aucun stockage) : seul le code de la réaction circule ;
 * le nom affiché est celui que le serveur a inscrit dans le jeton de l'envoyeur.
 */

export const REACTIONS = [
  { code: 'like', emoji: '👍' },
  { code: 'dislike', emoji: '👎' },
  { code: 'laugh', emoji: '😂' },
  { code: 'sad', emoji: '😢' },
  { code: 'clap', emoji: '👏' },
  { code: 'heart', emoji: '❤️' },
  { code: 'wow', emoji: '😮' },
  { code: 'party', emoji: '🎉' },
] as const;

export type ReactionCode = (typeof REACTIONS)[number]['code'];

export const REACTION_TOPIC = 'csc.reaction';
/** Une réaction par seconde et par personne. */
export const REACTION_COOLDOWN_MS = 1000;
/** Nombre maximum d'emojis affichés en même temps. */
export const MAX_VISIBLE_REACTIONS = 6;
/** Durée de l'animation (montée puis disparition). */
export const REACTION_LIFETIME_MS = 3500;

const BY_CODE = new Map<string, (typeof REACTIONS)[number]>(REACTIONS.map((r) => [r.code, r]));

export const reactionEmoji = (code: ReactionCode) => BY_CODE.get(code)?.emoji ?? '';

export function encodeReaction(code: ReactionCode): Uint8Array {
  return new TextEncoder().encode(JSON.stringify({ r: code }));
}

/** Décode une réaction reçue ; tout contenu inattendu est ignoré. */
export function decodeReaction(payload: Uint8Array): ReactionCode | null {
  if (payload.byteLength > 64) return null;
  try {
    const data = JSON.parse(new TextDecoder().decode(payload)) as { r?: unknown };
    return typeof data?.r === 'string' && BY_CODE.has(data.r) ? (data.r as ReactionCode) : null;
  } catch {
    return null;
  }
}

/**
 * Limite d'envoi par personne. Appliquée à l'envoi ET à la réception : un
 * participant qui contournerait le bouton ne peut pas inonder l'écran des autres.
 */
export class ReactionLimiter {
  private last = new Map<string, number>();

  constructor(private readonly cooldownMs = REACTION_COOLDOWN_MS) {}

  allow(key: string, now: number): boolean {
    const prev = this.last.get(key);
    if (prev !== undefined && now - prev < this.cooldownMs) return false;
    this.last.set(key, now);
    if (this.last.size > 200) {
      for (const [k, t] of this.last) if (now - t >= this.cooldownMs) this.last.delete(k);
    }
    return true;
  }
}

export interface FloatingReaction {
  id: string;
  code: ReactionCode;
  name: string;
  /** Position horizontale (0 à 1) pour éviter que les emojis se superposent. */
  x: number;
}

/** Ajoute une réaction à l'écran ; au-delà du plafond, les plus anciennes disparaissent. */
export function pushReaction(list: FloatingReaction[], item: FloatingReaction, max = MAX_VISIBLE_REACTIONS): FloatingReaction[] {
  return [...list, item].slice(-max);
}
