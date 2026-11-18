/**
 * Variables d'environnement PUBLIQUES (inlinées dans le bundle client par Next).
 * Les références doivent rester littérales (process.env.NEXT_PUBLIC_X).
 */
export const publicEnv = {
  siteUrl: (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, ''),
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
  supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '',
};

export function assertSupabaseConfigured() {
  if (!publicEnv.supabaseUrl || !publicEnv.supabaseKey) {
    throw new Error(
      'Supabase non configuré : renseignez NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY dans .env.local',
    );
  }
}
