import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { PASSWORD_CHANGE_ALLOWED, isProtectedPath } from '@/lib/routes';

/**
 * Proxy (ex-middleware) :
 *  1. rafraîchit la session Supabase (cookies) à chaque requête ;
 *  2. redirige vers la connexion les visiteurs non connectés sur les pages protégées ;
 *  3. impose le changement de mot de passe initial (drapeau dans app_metadata,
 *     modifiable uniquement côté serveur).
 * Il s'agit de contrôles « optimistes » : chaque page et chaque action serveur
 * revérifient les droits, et la RLS protège la base.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return response; // Supabase non configuré : on laisse passer (pages publiques).

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
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
    // Conserve les cookies de session éventuellement rafraîchis.
    response.cookies.getAll().forEach((c) => res.cookies.set(c));
    return res;
  };

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
