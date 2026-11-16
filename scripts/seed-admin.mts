/**
 * Crée (ou met à jour) le premier administrateur CSC.
 *
 *   npm run seed:admin                    # crée csc_admin s'il n'existe pas
 *   npm run seed:admin -- --reset-password # réinitialise son mot de passe
 *
 * Variables lues dans .env.local :
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY,
 *   SEED_ADMIN_USERNAME (défaut csc_admin), SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD
 *
 * Le changement du mot de passe est imposé à la première connexion
 * (app_metadata.must_change_password = true). Le mot de passe n'est jamais
 * affiché ni journalisé.
 */
import { createClient } from '@supabase/supabase-js';

function env(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (!v) {
    console.error(`✖ Variable manquante : ${name} (à renseigner dans .env.local)`);
    process.exit(1);
  }
  return v;
}

const url = env('NEXT_PUBLIC_SUPABASE_URL');
const secret = env('SUPABASE_SECRET_KEY');
const username = env('SEED_ADMIN_USERNAME', 'csc_admin').toLowerCase();
const email = env('SEED_ADMIN_EMAIL').toLowerCase();
const password = env('SEED_ADMIN_PASSWORD');
const resetPassword = process.argv.includes('--reset-password');

if (!/^[a-z0-9_.]{3,32}$/.test(username)) {
  console.error('✖ SEED_ADMIN_USERNAME invalide (3-32 caractères : a-z, 0-9, _ ou .)');
  process.exit(1);
}
if (password.length < 12 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
  console.error('✖ SEED_ADMIN_PASSWORD trop faible : 12 caractères minimum, avec lettres et chiffres.');
  process.exit(1);
}

const supabase = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });

async function main() {
  // 1. L'utilisateur existe-t-il déjà (par nom d'utilisateur ou par e-mail) ?
  const { data: existing, error: findErr } = await supabase
    .from('profiles')
    .select('id, username, email')
    .or(`username.eq.${username},email.eq.${email}`)
    .limit(1)
    .maybeSingle();
  if (findErr) throw new Error(`Lecture des profils impossible : ${findErr.message}. Les migrations sont-elles appliquées ?`);

  let userId: string;

  if (!existing) {
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { username, first_name: 'Admin', last_name: 'CSC', locale: 'fr' },
      app_metadata: { must_change_password: true },
    });
    if (error || !data.user) throw new Error(`Création impossible : ${error?.message}`);
    userId = data.user.id;
    console.log(`✔ Utilisateur « ${username} » créé (${email}).`);
  } else {
    userId = existing.id;
    console.log(`ℹ Utilisateur existant trouvé (${existing.email}).`);
    if (existing.username !== username) {
      const { error } = await supabase.from('profiles').update({ username }).eq('id', userId);
      if (error) throw new Error(`Mise à jour du nom d'utilisateur impossible : ${error.message}`);
    }
    if (resetPassword) {
      const { error } = await supabase.auth.admin.updateUserById(userId, {
        password,
        app_metadata: { must_change_password: true },
      });
      if (error) throw new Error(`Réinitialisation impossible : ${error.message}`);
      console.log('✔ Mot de passe réinitialisé (changement imposé à la prochaine connexion).');
    }
  }

  // 2. Rôle administrateur (idempotent).
  const { error: roleErr } = await supabase
    .from('user_roles')
    .upsert({ user_id: userId, role: 'admin' }, { onConflict: 'user_id,role', ignoreDuplicates: true });
  if (roleErr) throw new Error(`Attribution du rôle impossible : ${roleErr.message}`);

  // 3. Trace dans le journal d'audit.
  await supabase.from('audit_log').insert({
    actor_id: null,
    action: existing ? (resetPassword ? 'seed.admin_password_reset' : 'seed.admin_ensured') : 'seed.admin_created',
    entity: 'user',
    entity_id: userId,
    data: { username },
  });

  console.log(`✔ « ${username} » dispose du rôle administrateur.`);
  console.log('→ Connectez-vous avec ce nom d’utilisateur ; un nouveau mot de passe vous sera demandé.');
}

main().catch((e: Error) => {
  console.error(`✖ ${e.message}`);
  process.exit(1);
});
