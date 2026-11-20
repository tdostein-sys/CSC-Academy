import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { assertSupabaseConfigured, publicEnv } from '@/lib/env';
import { EPHEMERAL_COOKIE, asSessionCookie } from '@/lib/session-policy';

/**
 * Client Supabase « au nom de l'utilisateur connecté » (cookies de session).
 * Toutes les requêtes passent par la RLS.
 *
 * `sessionOnly` (ou le cookie csc_ephemeral) : les cookies de connexion sont
 * des cookies de session, effacés à la fermeture du navigateur
 * (« Rester connecté sur cet appareil » décoché).
 */
export async function createClient(opts: { sessionOnly?: boolean } = {}) {
  assertSupabaseConfigured();
  const cookieStore = await cookies();
  const sessionOnly = opts.sessionOnly ?? cookieStore.get(EPHEMERAL_COOKIE)?.value === '1';
  return createServerClient(publicEnv.supabaseUrl, publicEnv.supabaseKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, sessionOnly ? asSessionCookie(options) : options));
        } catch {
          // Appelé depuis un Server Component : sans effet, le proxy rafraîchit la session.
        }
      },
    },
  });
}
