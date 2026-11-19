import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { Profile } from '@/lib/types';

export interface SessionUser {
  id: string;
  email: string;
  mustChangePassword: boolean;
  profile: Profile;
  isAdmin: boolean;
  /** Conseiller CSC Consulting actif (vérifié en base). */
  isAdvisor: boolean;
  /** Renseigné si l'utilisateur a accepté la charte ambassadeur. */
  ambassador: { code: string; status: 'active' | 'suspended' } | null;
  unreadNotifications: number;
}

/**
 * Utilisateur courant (ou null). Mis en cache pour la durée d'un rendu :
 * plusieurs composants peuvent l'appeler sans requêtes supplémentaires.
 * L'identité vient du JWT vérifié (getClaims) ; les rôles viennent de la base.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return null;
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;

  const [profileRes, adminRes, unreadRes, ambassadorRes, advisorRes] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', claims.sub).single(),
    supabase.rpc('is_admin'),
    supabase.from('notifications').select('id', { count: 'exact', head: true }).is('read_at', null),
    supabase.from('ambassadors').select('code, status').eq('user_id', claims.sub).maybeSingle(),
    supabase.rpc('consulting_is_advisor'),
  ]);

  if (!profileRes.data) return null;

  return {
    id: claims.sub,
    email: String(claims.email ?? profileRes.data.email),
    mustChangePassword: Boolean((claims.app_metadata as Record<string, unknown> | undefined)?.must_change_password),
    profile: profileRes.data as Profile,
    isAdmin: adminRes.data === true,
    isAdvisor: advisorRes.data === true,
    ambassador: (ambassadorRes.data as SessionUser['ambassador']) ?? null,
    unreadNotifications: unreadRes.count ?? 0,
  };
});

/** Exige une session ; sinon redirige vers la connexion. */
export async function requireUser(nextPath?: string): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) {
    redirect(nextPath ? `/auth/login?next=${encodeURIComponent(nextPath)}` : '/auth/login');
  }
  if (user.mustChangePassword) redirect('/auth/change-password');
  return user;
}

/** Exige le rôle administrateur (vérifié en base, pas seulement côté client). */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser('/admin');
  if (!user.isAdmin) redirect('/dashboard');
  return user;
}

/**
 * Variante pour les actions serveur : renvoie l'utilisateur ou lève une erreur
 * (une action ne doit jamais faire confiance à l'interface).
 */
export async function assertAdmin(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user || !user.isAdmin || user.mustChangePassword) throw new Error('forbidden');
  return user;
}

/** Exige d'être collaborateur CSC Consulting (administrateur ou conseiller actif). */
export async function requireConsultingStaff(nextPath = '/consulting/manage'): Promise<SessionUser> {
  const user = await requireUser(nextPath);
  if (!user.isAdmin && !user.isAdvisor) redirect('/dashboard');
  return user;
}

/** Variante pour les actions serveur (la base revérifie ensuite chaque droit). */
export async function assertConsultingStaff(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user || user.mustChangePassword || (!user.isAdmin && !user.isAdvisor)) throw new Error('forbidden');
  return user;
}

/** Exige d'être ambassadeur (actif ou suspendu) ; sinon renvoie vers la charte. */
export async function requireAmbassador(nextPath: string): Promise<SessionUser & { ambassador: NonNullable<SessionUser['ambassador']> }> {
  const user = await requireUser(nextPath);
  if (!user.ambassador) redirect('/ambassador');
  return user as SessionUser & { ambassador: NonNullable<SessionUser['ambassador']> };
}

export async function assertUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user || user.mustChangePassword) throw new Error('unauthorized');
  return user;
}
