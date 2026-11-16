/** Préfixes de routes nécessitant une session. */
export const PROTECTED_PREFIXES = [
  '/dashboard',
  '/profile',
  '/notifications',
  '/admin',
  '/ambassador',
  '/student',
];

/** Routes accessibles même lorsqu'un changement de mot de passe est imposé. */
export const PASSWORD_CHANGE_ALLOWED = ['/auth/change-password', '/auth/logout'];

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * N'accepte que des chemins internes (« /quelque-chose »), jamais « //domaine »
 * ni une URL absolue : évite les redirections ouvertes.
 */
export function safeNextPath(next: unknown, fallback = '/dashboard'): string {
  if (typeof next !== 'string') return fallback;
  if (!next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return fallback;
  return next;
}
