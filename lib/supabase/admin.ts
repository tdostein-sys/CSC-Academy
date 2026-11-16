import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { assertSupabaseConfigured, publicEnv } from '@/lib/env';

/**
 * Client Supabase avec la clé secrète : CONTOURNE LA RLS.
 * À n'utiliser que côté serveur, après avoir vérifié les droits de l'appelant,
 * pour des opérations système (notifications, résolution du nom d'utilisateur,
 * métadonnées d'authentification).
 */
export function createAdminClient() {
  assertSupabaseConfigured();
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!secret) throw new Error('SUPABASE_SECRET_KEY manquant dans .env.local');
  return createClient(publicEnv.supabaseUrl, secret, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
