'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { publicEnv } from '@/lib/env';
import { audit } from '@/lib/audit';
import { notify } from '@/lib/notifications';
import { LOCALE_COOKIE, toLocale } from '@/i18n/config';
import { safeNextPath } from '@/lib/routes';
import { formDataToObject, formError, formSuccess, fromZodError, type FormState } from '@/lib/forms';
import {
  changePasswordSchema,
  forgotPasswordSchema,
  isEmailIdentifier,
  loginSchema,
  newPasswordSchema,
  registerSchema,
} from '@/lib/validation/auth';
import {
  EPHEMERAL_COOKIE,
  LAST_ACTIVITY_COOKIE,
  LOGOUT_REASONS,
  SESSION_START_COOKIE,
  policyCookieOptions,
  type LogoutReason,
} from '@/lib/session-policy';

/** Démarre l'horloge de session (durée maximale, inactivité) après une connexion. */
async function startSessionClock(ephemeral: boolean) {
  const store = await cookies();
  const now = String(Date.now());
  const opts = policyCookieOptions(ephemeral);
  store.set(SESSION_START_COOKIE, now, opts);
  store.set(LAST_ACTIVITY_COOKIE, now, opts);
  if (ephemeral) store.set(EPHEMERAL_COOKIE, '1', opts);
  else store.delete(EPHEMERAL_COOKIE);
}

async function clearSessionClock() {
  const store = await cookies();
  for (const name of [SESSION_START_COOKIE, LAST_ACTIVITY_COOKIE, EPHEMERAL_COOKIE]) store.delete(name);
}

/** Traduit les codes d'erreur Supabase Auth en clés de traduction. */
function authErrorKey(err: { code?: string; status?: number; message?: string }): string {
  switch (err.code) {
    case 'invalid_credentials':
      return 'errors.invalidCredentials';
    case 'email_not_confirmed':
      return 'errors.emailNotConfirmed';
    case 'weak_password':
      return 'errors.weakPassword';
    case 'same_password':
      return 'validation.passwordSameAsOld';
    case 'over_request_rate_limit':
    case 'over_email_send_rate_limit':
      return 'errors.rateLimited';
  }
  if (err.status === 429) return 'errors.rateLimited';
  return 'errors.generic';
}

/** Résout « nom d'utilisateur » → e-mail (côté serveur uniquement). */
async function resolveEmail(identifier: string): Promise<string | null> {
  if (isEmailIdentifier(identifier)) return identifier.toLowerCase();
  const admin = createAdminClient();
  // Les noms d'utilisateur sont stockés en minuscules (contrainte SQL).
  const { data } = await admin.from('profiles').select('email').eq('username', identifier.toLowerCase()).maybeSingle();
  return data?.email ?? null;
}

export async function login(_prev: FormState, fd: FormData): Promise<FormState> {
  const parsed = loginSchema.safeParse(formDataToObject(fd));
  if (!parsed.success) return fromZodError(parsed.error);
  const { identifier, password, next } = parsed.data;

  const email = await resolveEmail(identifier);
  // Même message que pour un mauvais mot de passe : on ne révèle pas si le compte existe.
  if (!email) return formError('errors.invalidCredentials');

  // « Rester connecté sur cet appareil » décoché : cookies effacés à la fermeture du navigateur.
  const ephemeral = fd.get('remember') !== 'on';
  const supabase = await createClient({ sessionOnly: ephemeral });
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return formError(authErrorKey(error));
  await startSessionClock(ephemeral);

  // Applique la langue enregistrée dans le profil.
  const { data: profile } = await supabase.from('profiles').select('locale').eq('id', data.user.id).single();
  if (profile?.locale) {
    (await cookies()).set(LOCALE_COOKIE, toLocale(profile.locale), { path: '/', maxAge: 31536000, sameSite: 'lax' });
  }

  revalidatePath('/', 'layout');
  if (data.user.app_metadata?.must_change_password) redirect('/auth/change-password');
  redirect(safeNextPath(next));
}

export async function register(_prev: FormState, fd: FormData): Promise<FormState> {
  const parsed = registerSchema.safeParse(formDataToObject(fd));
  if (!parsed.success) return fromZodError(parsed.error);
  const { email, password, first_name, last_name, phone_whatsapp } = parsed.data;
  const locale = toLocale((await cookies()).get(LOCALE_COOKIE)?.value);

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${publicEnv.siteUrl}/auth/confirm?next=/dashboard`,
      data: { first_name, last_name, phone_whatsapp, locale },
    },
  });
  if (error) return formError(authErrorKey(error));

  // Supabase renvoie un utilisateur sans « identities » si l'e-mail existe déjà :
  // on affiche le même message (pas de divulgation de comptes existants).
  if (data.user && (data.user.identities?.length ?? 0) > 0) {
    await notify({ userIds: [data.user.id], type: 'system.welcome', params: { firstName: first_name }, link: '/dashboard' });
  }

  if (data.session) {
    await startSessionClock(false);
    revalidatePath('/', 'layout');
    redirect('/dashboard');
  }
  return formSuccess('auth.registerSuccessBody');
}

export async function forgotPassword(_prev: FormState, fd: FormData): Promise<FormState> {
  const parsed = forgotPasswordSchema.safeParse(formDataToObject(fd));
  if (!parsed.success) return fromZodError(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${publicEnv.siteUrl}/auth/confirm?next=/auth/reset-password`,
  });
  if (error && authErrorKey(error) === 'errors.rateLimited') return formError('errors.rateLimited');
  // Toujours le même message, que le compte existe ou non.
  return formSuccess('auth.forgotSuccess');
}

/** Nouveau mot de passe après un lien de réinitialisation (session de récupération). */
export async function resetPassword(_prev: FormState, fd: FormData): Promise<FormState> {
  const parsed = newPasswordSchema.safeParse(formDataToObject(fd));
  if (!parsed.success) return fromZodError(parsed.error);

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return formError('auth.linkInvalid');

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return formError(authErrorKey(error));

  await audit(userData.user.id, 'auth.password_reset', 'user', userData.user.id);
  redirect('/dashboard');
}

/**
 * Changement de mot de passe depuis le compte (ou changement imposé au premier
 * login). Le mot de passe ACTUEL est exigé et vérifié par le serveur ; le
 * nouveau doit être différent. Ensuite : déconnexion des autres appareils,
 * notification « mot de passe modifié » (application + e-mail).
 * Ne pas confondre avec resetPassword (lien « mot de passe oublié »).
 */
export async function changePassword(_prev: FormState, fd: FormData): Promise<FormState> {
  const parsed = changePasswordSchema.safeParse(formDataToObject(fd));
  if (!parsed.success) return fromZodError(parsed.error);

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user?.email) redirect('/auth/login');

  // Vérification du mot de passe actuel (réauthentification).
  const { error: authErr } = await supabase.auth.signInWithPassword({ email: user.email, password: parsed.data.current_password });
  if (authErr) {
    if (authErr.code === 'invalid_credentials') {
      return { status: 'error', message: 'errors.checkForm', fieldErrors: { current_password: 'auth.currentPasswordWrong' } };
    }
    return formError(authErrorKey(authErr));
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    const key = authErrorKey(error);
    return key === 'validation.passwordSameAsOld' ? { status: 'error', message: 'errors.checkForm', fieldErrors: { password: key } } : formError(key);
  }

  const forced = Boolean(user.app_metadata?.must_change_password);
  if (forced) {
    // Lève le drapeau (app_metadata n'est modifiable qu'avec la clé secrète).
    const admin = createAdminClient();
    const { error: metaErr } = await admin.auth.admin.updateUserById(user.id, {
      app_metadata: { ...user.app_metadata, must_change_password: false },
    });
    if (metaErr) return formError('errors.generic');
    // Rafraîchit le jeton pour que le nouveau app_metadata soit pris en compte.
    await supabase.auth.refreshSession();
  }

  // Les autres appareils connectés doivent se reconnecter avec le nouveau mot de passe.
  await supabase.auth.signOut({ scope: 'others' });
  await audit(user.id, forced ? 'auth.initial_password_changed' : 'auth.password_changed', 'user', user.id);
  const date = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Africa/Douala' }).format(new Date());
  await notify({ userIds: [user.id], type: 'account.password_changed', params: { date }, link: '/profile' });

  revalidatePath('/', 'layout');
  redirect(forced ? '/dashboard' : '/profile?password=changed');
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  await clearSessionClock();
  revalidatePath('/', 'layout');
  redirect('/');
}

/**
 * Déconnexion automatique demandée par le navigateur (inactivité, ou
 * déconnexion faite dans un autre onglet). Le motif est affiché sur la page
 * de connexion.
 */
export async function logoutWithReason(reason: string | null, next?: string) {
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: 'local' });
  await clearSessionClock();
  revalidatePath('/', 'layout');
  const params = new URLSearchParams();
  if (reason && LOGOUT_REASONS.includes(reason as LogoutReason)) params.set('raison', reason);
  if (next) params.set('next', safeNextPath(next));
  const qs = params.toString();
  redirect(`/auth/login${qs ? `?${qs}` : ''}`);
}

/** « Rester connecté » : une requête suffit, le proxy note l'activité. */
export async function keepSessionAlive(): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return Boolean(data?.claims);
}
