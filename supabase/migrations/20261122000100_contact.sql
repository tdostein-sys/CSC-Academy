-- =============================================================================
-- Page Contact : coordonnées CSC, formulaire et boîte de réception admin
-- =============================================================================
-- ⚠ Migration livrée NON EXÉCUTÉE : à relire puis appliquer manuellement dans
--   Supabase (SQL Editor), APRÈS celle des replays.
--   Elle ne supprime rien et ne modifie la structure d'aucune table existante :
--   elle ajoute deux tables et des fonctions `contact_*`, et une ligne
--   « contact_page » dans les contenus éditables (texte d'accueil de la page,
--   modifiable ensuite dans Admin › Contenus).
--
-- Règles métier garanties PAR LA BASE :
--   * tout visiteur, connecté ou non, peut envoyer un message ; les champs
--     sont contrôlés (longueurs, e-mail, téléphone) ;
--   * anti-abus : 3 messages par heure et par adresse e-mail, 5 par heure et
--     par compte, 30 toutes les 10 minutes pour tout le site ;
--   * une inscription n'est rattachée au message que si elle appartient à
--     l'expéditeur connecté ;
--   * les messages ne sont lisibles que par les administrateurs (et par leur
--     auteur connecté) ; seul l'administrateur change leur statut et les
--     coordonnées affichées.
-- =============================================================================

create type public.contact_subject as enum ('payment', 'course', 'technical', 'other');
create type public.contact_status  as enum ('new', 'in_progress', 'done');

-- -----------------------------------------------------------------------------
-- Coordonnées affichées sur la page Contact (une seule ligne)
-- -----------------------------------------------------------------------------
create table public.contact_settings (
  id          boolean primary key default true check (id),
  whatsapp    text not null default '' check (whatsapp = '' or whatsapp ~ '^\+[1-9][0-9]{7,14}$'),
  phone       text not null default '' check (phone = '' or phone ~ '^\+[1-9][0-9]{7,14}$'),
  email       text not null default '' check (email = '' or (char_length(email) <= 254 and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$')),
  updated_at  timestamptz not null default now(),
  updated_by  uuid references public.profiles (id) on delete set null
);
insert into public.contact_settings (id) values (true);

-- Texte d'accueil de la page (horaires, délais de réponse…), éditable et traduit.
insert into public.site_content (key, body_fr, body_en) values
('contact_page',
$fr$Une question sur une formation, un paiement ou votre compte ? Écrivez-nous sur WhatsApp pour une réponse rapide, ou envoyez-nous un message avec le formulaire ci-dessous.

Nous répondons du lundi au samedi, de 8 h à 18 h (heure du Cameroun).$fr$,
$en$A question about a course, a payment or your account? Message us on WhatsApp for a quick answer, or send us a message with the form below.

We answer Monday to Saturday, 8 am to 6 pm (Cameroon time).$en$)
on conflict (key) do nothing;

-- -----------------------------------------------------------------------------
-- Messages reçus
-- -----------------------------------------------------------------------------
create table public.contact_requests (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz not null default now(),
  user_id        uuid references public.profiles (id) on delete set null,
  name           text not null check (char_length(name) between 2 and 80),
  email          text not null check (char_length(email) <= 254 and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  phone          text not null default '' check (phone = '' or phone ~ '^\+[1-9][0-9]{7,14}$'),
  subject        public.contact_subject not null,
  message        text not null check (char_length(message) between 10 and 2000),
  enrollment_id  uuid references public.academy_enrollments (id) on delete set null,
  locale         text not null default 'fr' check (locale in ('fr', 'en')),
  status         public.contact_status not null default 'new',
  admin_note     text not null default '' check (char_length(admin_note) <= 1000),
  handled_by     uuid references public.profiles (id) on delete set null,
  handled_at     timestamptz
);
create index contact_requests_status_idx on public.contact_requests (status, created_at desc);
create index contact_requests_email_idx  on public.contact_requests (email, created_at desc);
create index contact_requests_user_idx   on public.contact_requests (user_id, created_at desc);

-- =============================================================================
-- Fonctions
-- =============================================================================

-- Envoi d'un message (visiteur ou membre connecté). Renvoie l'identifiant.
create or replace function public.contact_submit(
  p_name text, p_email text, p_phone text, p_subject text, p_message text,
  p_enrollment uuid default null, p_locale text default 'fr'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid      uuid := auth.uid();
  v_name   text := trim(coalesce(p_name, ''));
  v_email  text := lower(trim(coalesce(p_email, '')));
  v_phone  text := trim(coalesce(p_phone, ''));
  v_msg    text := trim(coalesce(p_message, ''));
  v_enr    uuid;
  v_id     uuid;
begin
  if char_length(v_name) not between 2 and 80
     or char_length(v_email) > 254
     or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
     or (v_phone <> '' and v_phone !~ '^\+[1-9][0-9]{7,14}$')
     or char_length(v_msg) not between 10 and 2000
     or coalesce(p_subject, '') not in ('payment', 'course', 'technical', 'other') then
    raise exception 'contact_invalid';
  end if;

  -- Anti-abus.
  if (select count(*) from public.contact_requests
       where email = v_email and created_at > now() - interval '1 hour') >= 3
     or (uid is not null and (select count(*) from public.contact_requests
       where user_id = uid and created_at > now() - interval '1 hour') >= 5)
     or (select count(*) from public.contact_requests
       where created_at > now() - interval '10 minutes') >= 30 then
    raise exception 'contact_rate_limited';
  end if;

  -- Inscription concernée : seulement la sienne.
  if p_enrollment is not null and uid is not null then
    select e.id into v_enr from public.academy_enrollments e
     where e.id = p_enrollment and e.student_id = uid;
  end if;

  insert into public.contact_requests (user_id, name, email, phone, subject, message, enrollment_id, locale)
  values (uid, v_name, v_email, v_phone, p_subject::public.contact_subject, v_msg, v_enr,
          case when p_locale = 'en' then 'en' else 'fr' end)
  returning id into v_id;
  return v_id;
end;
$$;

-- Suivi d'un message par l'administrateur (statut et note interne).
create or replace function public.contact_update_request(p_id uuid, p_status text, p_note text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'forbidden';
  end if;
  if coalesce(p_status, '') not in ('new', 'in_progress', 'done') or char_length(coalesce(p_note, '')) > 1000 then
    raise exception 'contact_invalid';
  end if;
  update public.contact_requests
     set status = p_status::public.contact_status,
         admin_note = coalesce(trim(p_note), admin_note),
         handled_by = auth.uid(),
         handled_at = now()
   where id = p_id;
  if not found then
    raise exception 'not_found';
  end if;
  perform public.write_audit('contact.request.update', 'contact_requests', p_id::text,
                             jsonb_build_object('status', p_status));
end;
$$;

-- Coordonnées affichées (administrateur). Chaîne vide = non affiché.
create or replace function public.contact_update_settings(p_whatsapp text, p_phone text, p_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_wa    text := trim(coalesce(p_whatsapp, ''));
  v_phone text := trim(coalesce(p_phone, ''));
  v_email text := lower(trim(coalesce(p_email, '')));
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'forbidden';
  end if;
  if (v_wa <> '' and v_wa !~ '^\+[1-9][0-9]{7,14}$')
     or (v_phone <> '' and v_phone !~ '^\+[1-9][0-9]{7,14}$')
     or (v_email <> '' and (char_length(v_email) > 254 or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$')) then
    raise exception 'contact_invalid';
  end if;
  update public.contact_settings
     set whatsapp = v_wa, phone = v_phone, email = v_email, updated_at = now(), updated_by = auth.uid()
   where id;
  perform public.write_audit('contact.settings.update', 'contact_settings', 'true', '{}'::jsonb);
end;
$$;

-- =============================================================================
-- Privilèges & RLS
-- =============================================================================
alter table public.contact_settings enable row level security;
alter table public.contact_requests enable row level security;

revoke all on public.contact_settings, public.contact_requests from anon, authenticated;

-- Coordonnées : publiques (affichées sur la page Contact).
grant select on public.contact_settings to anon, authenticated;
create policy contact_settings_read_all on public.contact_settings
  for select to anon, authenticated using (true);

-- Messages : l'admin tout, l'auteur connecté les siens. Écriture par les fonctions seulement.
grant select on public.contact_requests to authenticated;
create policy contact_requests_select on public.contact_requests
  for select to authenticated using (public.is_admin() or user_id = auth.uid());

revoke execute on function
  public.contact_submit(text, text, text, text, text, uuid, text),
  public.contact_update_request(uuid, text, text),
  public.contact_update_settings(text, text, text)
from public, anon, authenticated;

grant execute on function public.contact_submit(text, text, text, text, text, uuid, text) to anon, authenticated;
grant execute on function
  public.contact_update_request(uuid, text, text),
  public.contact_update_settings(text, text, text)
to authenticated;
