/**
 * Banc de test SQL : PostgreSQL en WebAssembly (PGlite), sans Docker.
 *
 * On reproduit le minimum de l'environnement Supabase dont dépendent nos
 * migrations (schéma `auth`, rôles anon / authenticated / service_role,
 * privilèges par défaut identiques à Supabase), puis on applique les VRAIES
 * migrations de `supabase/migrations/`. Les tests exécutent ensuite des
 * requêtes sous l'identité d'un utilisateur, ce qui active la RLS.
 */
import { PGlite } from '@electric-sql/pglite';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const SUPABASE_SHIM = /* sql */ `
  create role anon nologin noinherit;
  create role authenticated nologin noinherit;
  create role service_role nologin noinherit bypassrls;

  create schema auth;
  create table auth.users (
    id uuid primary key default gen_random_uuid(),
    email text unique,
    raw_user_meta_data jsonb default '{}'::jsonb,
    raw_app_meta_data jsonb default '{}'::jsonb,
    created_at timestamptz default now()
  );
  create or replace function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
  grant usage on schema auth to anon, authenticated, service_role;
  grant execute on function auth.uid() to anon, authenticated, service_role;

  -- Stockage (Supabase Storage) : structure minimale pour les politiques.
  create schema storage;
  create table storage.buckets (
    id text primary key, name text not null, public boolean default false,
    file_size_limit bigint, allowed_mime_types text[]
  );
  create table storage.objects (
    id uuid primary key default gen_random_uuid(),
    bucket_id text references storage.buckets (id),
    name text, owner uuid, created_at timestamptz default now()
  );
  alter table storage.objects enable row level security;
  create or replace function storage.foldername(name text) returns text[]
    language sql immutable as $$ select string_to_array(name, '/') $$;
  grant usage on schema storage to anon, authenticated, service_role;
  grant all on storage.objects to anon, authenticated, service_role;
  grant select on storage.buckets to anon, authenticated, service_role;

  -- Privilèges par défaut de Supabase sur le schéma public.
  grant usage on schema public to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
`;

const MIGRATIONS_DIR = path.resolve(__dirname, '../../supabase/migrations');

export type TestDb = PGlite;

export async function createTestDb(): Promise<TestDb> {
  const db = new PGlite();
  await db.exec(SUPABASE_SHIM);
  const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort();
  for (const file of files) {
    const sql = readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
    try {
      await db.exec(sql);
    } catch (e) {
      throw new Error(`Migration ${file} failed: ${(e as Error).message}`);
    }
  }
  return db;
}

let counter = 0;

/** Crée un utilisateur auth (le trigger crée son profil). Retourne son id. */
export async function createUser(
  db: TestDb,
  opts: { email?: string; username?: string; admin?: boolean; meta?: Record<string, unknown> } = {},
): Promise<string> {
  counter += 1;
  const email = opts.email ?? `user${counter}_${Date.now()}@test.local`;
  const meta = {
    first_name: 'Prenom',
    last_name: `Nom${counter}`,
    phone_whatsapp: '+237690000000',
    ...(opts.username ? { username: opts.username } : {}),
    ...(opts.meta ?? {}),
  };
  const { rows } = await db.query<{ id: string }>(
    'insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id',
    [email, JSON.stringify(meta)],
  );
  const id = rows[0].id;
  if (opts.admin) {
    await db.query(`insert into public.user_roles (user_id, role) values ($1, 'admin')`, [id]);
  }
  return id;
}

/**
 * Exécute `fn` sous l'identité d'un utilisateur connecté (rôle `authenticated`
 * + auth.uid() = userId), ou anonyme si userId = null. La RLS s'applique.
 */
export async function as<T>(db: TestDb, userId: string | null, fn: () => Promise<T>): Promise<T> {
  await db.exec(`select set_config('request.jwt.claim.sub', '${userId ?? ''}', false)`);
  await db.exec(userId ? 'set role authenticated' : 'set role anon');
  try {
    return await fn();
  } finally {
    await db.exec('reset role');
    await db.exec(`select set_config('request.jwt.claim.sub', '', false)`);
  }
}

/** Exécute une requête et renvoie l'erreur Postgres (message) ou null. */
export async function errorOf(p: Promise<unknown>): Promise<string | null> {
  try {
    await p;
    return null;
  } catch (e) {
    return (e as Error).message;
  }
}
