/**
 * Politique de session (application financière, ordinateurs parfois partagés).
 * Toutes les durées se changent ici.
 *
 *  - déconnexion après IDLE_MINUTES sans activité (navigateur ET serveur) ;
 *  - avertissement WARNING_SECONDS avant, avec « Rester connecté » ;
 *  - durée maximale absolue MAX_SESSION_DAYS, même avec de l'activité ;
 *  - « Rester connecté sur cet appareil » décoché : la session se termine
 *    aussi à la fermeture du navigateur (cookies de session).
 */
export const IDLE_MINUTES = 30;
export const WARNING_SECONDS = 120;
export const MAX_SESSION_DAYS = 7;

export const IDLE_MS = IDLE_MINUTES * 60_000;
export const MAX_SESSION_MS = MAX_SESSION_DAYS * 86_400_000;

/** Cookies httpOnly posés par le proxy (horodatages en millisecondes). */
export const LAST_ACTIVITY_COOKIE = 'csc_last_activity';
export const SESSION_START_COOKIE = 'csc_session_start';
/** Présent (= « 1 ») si l'utilisateur n'a pas coché « Rester connecté ». */
export const EPHEMERAL_COOKIE = 'csc_ephemeral';

/** Motifs de déconnexion automatique, affichés sur la page de connexion. */
export type LogoutReason = 'inactivite' | 'expiree';
export const LOGOUT_REASONS: LogoutReason[] = ['inactivite', 'expiree'];

/** Canal de synchronisation entre onglets. */
export const SESSION_CHANNEL = 'csc-session';
/** Clé localStorage : dernière activité connue, tous onglets confondus. */
export const ACTIVITY_STORAGE_KEY = 'csc:last-activity';

/**
 * Verdict du serveur sur une session : encore valide, inactive trop
 * longtemps, ou au-delà de la durée maximale. Une valeur absente ou
 * illisible ne déconnecte pas (session antérieure à cette règle) : les
 * horodatages sont alors posés à partir de maintenant.
 */
export function sessionVerdict(now: number, lastActivity: string | undefined, startedAt: string | undefined): 'ok' | LogoutReason {
  const start = Number(startedAt);
  if (startedAt && Number.isFinite(start) && start > 0 && now - start > MAX_SESSION_MS) return 'expiree';
  const last = Number(lastActivity);
  if (lastActivity && Number.isFinite(last) && last > 0 && now - last > IDLE_MS) return 'inactivite';
  return 'ok';
}

/** Retire la durée de vie d'un cookie : il disparaît à la fermeture du navigateur. */
export function asSessionCookie<T extends { maxAge?: number; expires?: Date | number | string }>(options: T | undefined): T | undefined {
  if (!options) return options;
  // maxAge 0 = suppression du cookie (déconnexion) : on la laisse intacte.
  if (options.maxAge !== undefined && options.maxAge <= 0) return options;
  const rest = { ...options };
  delete rest.maxAge;
  delete rest.expires;
  return rest;
}

/** Options communes de nos cookies techniques. */
export function policyCookieOptions(ephemeral: boolean) {
  return {
    path: '/',
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    ...(ephemeral ? {} : { maxAge: MAX_SESSION_DAYS * 86_400 }),
  };
}
