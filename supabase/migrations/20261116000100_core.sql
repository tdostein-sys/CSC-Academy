-- =============================================================================
-- CSC — Socle : profils, rôles, contenus éditables, notifications, audit
-- =============================================================================
-- Conventions :
--   * Montants en FCFA (XAF) stockés en bigint (pas de centimes en XAF).
--   * RLS activée sur TOUTES les tables. Les écritures sensibles passent par des
--     fonctions SECURITY DEFINER qui vérifient elles-mêmes les droits.
--   * auth.uid() = utilisateur courant (fourni par Supabase Auth).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Profils
-- -----------------------------------------------------------------------------
create table public.profiles (
  id              uuid primary key references auth.users (id) on delete cascade,
  username        text,
  email           text not null,
  first_name      text not null default '',
  last_name       text not null default '',
  phone_whatsapp  text not null default '',
  locale          text not null default 'fr' check (locale in ('fr', 'en')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint profiles_username_format
    check (username is null or username ~ '^[a-z0-9_.]{3,32}$')
);

create unique index profiles_username_key on public.profiles (lower(username));
create unique index profiles_email_key on public.profiles (lower(email));

comment on table public.profiles is 'Profil applicatif, 1-1 avec auth.users.';

-- -----------------------------------------------------------------------------
-- Rôles (seul le rôle admin est stocké ; ambassadeur et étudiant sont déduits)
-- -----------------------------------------------------------------------------
create type public.app_role as enum ('admin');

create table public.user_roles (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  role       public.app_role not null,
  granted_at timestamptz not null default now(),
  granted_by uuid references public.profiles (id),
  primary key (user_id, role)
);

-- Fonction utilitaire : l'utilisateur courant est-il admin ?
-- SECURITY DEFINER pour éviter une récursion RLS sur user_roles.
create or replace function public.is_admin(uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles r
    where r.user_id = uid and r.role = 'admin'
  );
$$;

-- -----------------------------------------------------------------------------
-- Création automatique du profil à l'inscription
-- -----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
begin
  insert into public.profiles (id, email, username, first_name, last_name, phone_whatsapp, locale)
  values (
    new.id,
    coalesce(new.email, ''),
    nullif(lower(meta ->> 'username'), ''),
    coalesce(meta ->> 'first_name', ''),
    coalesce(meta ->> 'last_name', ''),
    coalesce(meta ->> 'phone_whatsapp', ''),
    case when meta ->> 'locale' = 'en' then 'en' else 'fr' end
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Synchronise l'e-mail si l'utilisateur le change dans Supabase Auth.
create or replace function public.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email is distinct from old.email then
    update public.profiles set email = coalesce(new.email, ''), updated_at = now()
    where id = new.id;
  end if;
  return new;
end;
$$;

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row execute function public.handle_user_email_change();

-- Horodatage générique
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-- -----------------------------------------------------------------------------
-- Contenus éditables par l'admin (charte ambassadeur, textes d'accueil…)
-- -----------------------------------------------------------------------------
create table public.site_content (
  key        text primary key,
  body_fr    text not null default '',
  body_en    text not null default '',
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id)
);

insert into public.site_content (key, body_fr, body_en) values
('ambassador_charter',
$fr$## Devenir ambassadeur CSC

### Critères
- Avoir un compte CSC complet (nom, prénom, numéro WhatsApp).
- Être actif sur les réseaux sociaux et disposer d'un réseau de contacts.
- Respecter l'éthique CSC : transparence, pas de promesse de gains.

### Missions
- Participer aux campagnes lancées par CSC.
- Suivre le mode opératoire (modop) et la vidéo de chaque campagne.
- Déclarer honnêtement chaque compte créé et son volume de trading.

En cliquant sur « D'accord », vous acceptez cette charte.$fr$,
$en$## Become a CSC ambassador

### Criteria
- Have a complete CSC account (first name, last name, WhatsApp number).
- Be active on social media and have a network of contacts.
- Respect CSC ethics: transparency, no promise of earnings.

### Missions
- Take part in the campaigns launched by CSC.
- Follow the operating procedure (modop) and video of each campaign.
- Honestly declare each account created and its trading volume.

By clicking "I agree", you accept this charter.$en$);

-- -----------------------------------------------------------------------------
-- Notifications (centre de notifications + file d'envoi multicanal)
-- -----------------------------------------------------------------------------
create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  type       text not null,
  title      text not null,
  body       text not null default '',
  link       text,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);

create type public.notification_channel as enum ('email', 'whatsapp');
create type public.delivery_status as enum ('pending', 'sent', 'failed', 'skipped');

create table public.notification_deliveries (
  id              uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.notifications (id) on delete cascade,
  channel         public.notification_channel not null,
  status          public.delivery_status not null default 'pending',
  attempts        int not null default 0,
  last_error      text,
  next_attempt_at timestamptz not null default now(),
  sent_at         timestamptz,
  created_at      timestamptz not null default now(),
  unique (notification_id, channel)
);
create index notification_deliveries_queue_idx
  on public.notification_deliveries (status, next_attempt_at)
  where status = 'pending';

-- Réserve un lot d'envois à traiter (serveur uniquement). Le verrouillage
-- « skip locked » + report de next_attempt_at évite qu'un même envoi soit
-- traité deux fois par deux exécutions simultanées.
create or replace function public.claim_notification_deliveries(p_limit int default 25)
returns setof public.notification_deliveries
language sql
security definer
set search_path = public
as $$
  update public.notification_deliveries d
     set attempts = d.attempts + 1,
         next_attempt_at = now() + interval '10 minutes'
   where d.id in (
     select id from public.notification_deliveries
      where status = 'pending' and next_attempt_at <= now()
      order by created_at
      limit greatest(1, least(p_limit, 200))
      for update skip locked
   )
  returning d.*;
$$;

-- L'utilisateur marque ses propres notifications comme lues.
create or replace function public.mark_notifications_read(ids uuid[] default null)
returns void
language sql
security definer
set search_path = public
as $$
  update public.notifications
     set read_at = now()
   where user_id = auth.uid()
     and read_at is null
     and (ids is null or id = any (ids));
$$;

-- -----------------------------------------------------------------------------
-- Journal d'audit (append-only)
-- -----------------------------------------------------------------------------
create table public.audit_log (
  id          bigint generated always as identity primary key,
  actor_id    uuid references public.profiles (id),
  action      text not null,
  entity      text not null,
  entity_id   text,
  data        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index audit_log_created_idx on public.audit_log (created_at desc);
create index audit_log_entity_idx on public.audit_log (entity, entity_id);

-- Écriture uniquement via cette fonction (appelée par les autres fonctions
-- métier ou par le serveur avec la clé service).
create or replace function public.write_audit(
  p_action text, p_entity text, p_entity_id text, p_data jsonb default '{}'::jsonb
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.audit_log (actor_id, action, entity, entity_id, data)
  values (auth.uid(), p_action, p_entity, p_entity_id, coalesce(p_data, '{}'::jsonb));
$$;

-- Empêche toute modification / suppression du journal, même par erreur.
create or replace function public.audit_log_immutable()
returns trigger
language plpgsql
as $$
begin
  raise exception 'audit_log is append-only';
end;
$$;

create trigger audit_log_no_update before update or delete on public.audit_log
  for each row execute function public.audit_log_immutable();

-- Mise à jour d'un contenu éditable (admin uniquement, auditée)
create or replace function public.update_site_content(p_key text, p_body_fr text, p_body_en text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.site_content
     set body_fr = p_body_fr, body_en = p_body_en, updated_at = now(), updated_by = auth.uid()
   where key = p_key;
  if not found then
    raise exception 'unknown_content_key';
  end if;
  perform public.write_audit('site_content.update', 'site_content', p_key, '{}'::jsonb);
end;
$$;

-- =============================================================================
-- Privilèges & RLS
-- =============================================================================
alter table public.profiles                enable row level security;
alter table public.user_roles              enable row level security;
alter table public.site_content            enable row level security;
alter table public.notifications           enable row level security;
alter table public.notification_deliveries enable row level security;
alter table public.audit_log               enable row level security;

-- On part d'un état fermé, puis on ouvre explicitement.
revoke all on public.profiles, public.user_roles, public.site_content,
              public.notifications, public.notification_deliveries, public.audit_log
  from anon, authenticated;

-- profiles : lecture de son profil (ou tout pour l'admin) ; mise à jour limitée
-- à certaines colonnes de son propre profil.
grant select on public.profiles to authenticated;
grant update (first_name, last_name, phone_whatsapp, locale) on public.profiles to authenticated;

create policy profiles_select_own_or_admin on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_admin());

create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- user_roles : lecture de ses propres rôles ; aucune écriture côté client.
grant select on public.user_roles to authenticated;
create policy user_roles_select_own_or_admin on public.user_roles
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- site_content : lecture publique ; écriture via update_site_content().
grant select on public.site_content to anon, authenticated;
create policy site_content_read_all on public.site_content
  for select to anon, authenticated
  using (true);

-- notifications : chacun voit les siennes ; écriture via le serveur / RPC.
grant select on public.notifications to authenticated;
create policy notifications_select_own on public.notifications
  for select to authenticated
  using (user_id = auth.uid());

-- notification_deliveries : admin en lecture seule (supervision).
grant select on public.notification_deliveries to authenticated;
create policy deliveries_select_admin on public.notification_deliveries
  for select to authenticated
  using (public.is_admin());

-- audit_log : admin en lecture seule.
grant select on public.audit_log to authenticated;
create policy audit_select_admin on public.audit_log
  for select to authenticated
  using (public.is_admin());

-- Fonctions : on retire l'exécution publique par défaut puis on accorde au cas par cas.
revoke execute on function public.write_audit(text, text, text, jsonb) from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.handle_user_email_change() from public, anon, authenticated;
revoke execute on function public.claim_notification_deliveries(int) from public, anon, authenticated;
grant execute on function public.is_admin(uuid) to authenticated;
grant execute on function public.mark_notifications_read(uuid[]) to authenticated;
grant execute on function public.update_site_content(text, text, text) to authenticated;
