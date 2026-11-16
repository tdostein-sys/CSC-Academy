import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { assertSupabaseConfigured, publicEnv } from '@/lib/env';

/**
 * Client Supabase « au nom de l'utilisateur connecté » (cookies de session).
 * Toutes les requêtes passent par la RLS.
 */
export async function createClient() {
  assertSupabaseConfigured();
  const cookieStore = await cookies();
  return createServerClient(publicEnv.supabaseUrl, publicEnv.supabaseKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Appelé depuis un Server Component : sans effet, le proxy rafraîchit la session.
        }
      },
    },
  });
}
