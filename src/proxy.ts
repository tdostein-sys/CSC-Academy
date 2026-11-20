import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { PASSWORD_CHANGE_ALLOWED, isProtectedPath } from '@/lib/routes';
import {
  EPHEMERAL_COOKIE,
  LAST_ACTIVITY_COOKIE,
  SESSION_START_COOKIE,
  asSessionCookie,
  policyCookieOptions,
  sessionVerdict,
} from '@/lib/session-policy';

/**
 * Proxy (ex-middleware) :
 *  1. rafraîchit la session Supabase (cookies) à chaque requête ;
 *  2. applique la politique de session : déconnexion après 30 min sans
 *     activité et au-delà de 7 jours (cookies httpOnly horodatés), même si
 *     le navigateur est resté fermé ou en veille ;
 *  3. redirige vers la connexion les visiteurs non connectés sur les pages protégées ;
 *  4. impose le changement de mot de passe initial (drapeau dans app_metadata,
 *     modifiable uniquement côté serveur).
 * Il s'agit de contrôles « optimistes » : chaque page et chaque action serveur
 * revérifient les droits, et la RLS protège la base.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return response; // Supabase non configuré : on laisse passer (pages publiques).

  // « Rester connecté » décoché : cookies de connexion sans durée de vie.
  const ephemeral = request.cookies.get(EPHEMERAL_COOKIE)?.value === '1';

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, ephemeral ? asSessionCookie(options) : options));
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  const { pathname, search } = request.nextUrl;

  const redirectTo = (path: string, params: Record<string, string> = {}) => {
    const target = request.nextUrl.clone();
    target.pathname = path;
    target.search = '';
    Object.entries(params).forEach(([k, v]) => target.searchParams.set(k, v));
    const res = NextResponse.redirect(target);
    // Conserve les cookies de session éventuellement rafraîchis (ou effacés).
    response.cookies.getAll().forEach((c) => res.cookies.set(c));
    return res;
  };

  if (claims) {
    const verdict = sessionVerdict(Date.now(), request.cookies.get(LAST_ACTIVITY_COOKIE)?.value, request.cookies.get(SESSION_START_COOKIE)?.value);
    if (verdict !== 'ok') {
      // Session trop ancienne ou inactive : déconnexion côté serveur.
      await supabase.auth.signOut({ scope: 'local' });
      for (const name of [LAST_ACTIVITY_COOKIE, SESSION_START_COOKIE, EPHEMERAL_COOKIE]) {
        response.cookies.set(name, '', { path: '/', maxAge: 0 });
      }
      if (pathname.startsWith('/api/')) return response;
      return redirectTo('/auth/login', { raison: verdict, ...(isProtectedPath(pathname) ? { next: pathname + search } : {}) });
    }

    // Les préchargements de liens ne sont pas une activité de l'utilisateur.
    const prefetch = request.headers.get('next-router-prefetch') === '1' || request.headers.get('purpose') === 'prefetch';
    const now = String(Date.now());
    const opts = policyCookieOptions(ephemeral);
    if (!prefetch) response.cookies.set(LAST_ACTIVITY_COOKIE, now, opts);
    if (!request.cookies.get(SESSION_START_COOKIE)?.value) response.cookies.set(SESSION_START_COOKIE, now, opts);
  }

  if (!claims && isProtectedPath(pathname)) {
    return redirectTo('/auth/login', { next: pathname + search });
  }

  const mustChange = Boolean((claims?.app_metadata as Record<string, unknown> | undefined)?.must_change_password);
  if (claims && mustChange && !PASSWORD_CHANGE_ALLOWED.includes(pathname) && !pathname.startsWith('/api/')) {
    return redirectTo('/auth/change-password');
  }

  return response;
}

export const config = {
  matcher: [
    // Tout sauf les fichiers statiques et les images.
    '/((?!_next/static|_next/image|favicon.ico|icon.png|logo-csc.png|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|pdf)$).*)',
  ],
};
