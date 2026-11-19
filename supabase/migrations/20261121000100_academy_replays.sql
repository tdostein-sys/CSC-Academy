-- =============================================================================
-- CSC Academy — replays : visionnage unique et limité dans le temps
-- =============================================================================
-- ⚠ Migration livrée NON EXÉCUTÉE : à relire puis appliquer manuellement dans
--   Supabase (SQL Editor), APRÈS celle du lot 3.
--   Elle ne supprime rien et ne modifie aucune table existante : elle ajoute
--   deux tables et des fonctions `academy_*`.
--
-- Règles métier garanties PAR LA BASE :
--   * un étudiant ne lance le visionnage d'un enregistrement qu'UNE seule fois ;
--     le visionnage reste ouvert pendant une durée fixée par l'administrateur
--     (2 heures par défaut) : il peut recharger la page et reprendre la
--     lecture pendant ce délai, jamais au-delà ;
--   * il faut, au lancement comme à chaque reprise, une inscription active et
--     non bloquée (même règle que pour la salle de visio) ;
--   * l'administrateur regarde sans limite et peut réinitialiser le
--     visionnage d'un étudiant (l'ancien visionnage est conservé, marqué
--     « réinitialisé », pour l'historique).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Réglage : durée d'un visionnage (une seule ligne)
-- -----------------------------------------------------------------------------
create table public.academy_replay_settings (
  id          boolean primary key default true check (id),
  view_hours  integer not null default 2 check (view_hours between 1 and 48),
  updated_at  timestamptz not null default now()
);
insert into public.academy_replay_settings (id) values (true);

-- -----------------------------------------------------------------------------
-- Visionnages (un en cours ou terminé par étudiant et par enregistrement)
-- -----------------------------------------------------------------------------
create table public.academy_replay_views (
  id            uuid primary key default gen_random_uuid(),
  recording_id  uuid not null references public.academy_recordings (id) on delete cascade,
  meeting_id    uuid not null references public.academy_meetings (id) on delete cascade,
  user_id       uuid not null references public.profiles (id) on delete cascade,
  started_at    timestamptz not null default now(),
  expires_at    timestamptz not null,
  reset_at      timestamptz,
  reset_by      uuid references public.profiles (id) on delete set null,
  check (expires_at > started_at)
);
-- Un seul visionnage « actif » (non réinitialisé) par étudiant et enregistrement.
create unique index academy_replay_views_current_idx
  on public.academy_replay_views (recording_id, user_id) where reset_at is null;
create index academy_replay_views_user_idx on public.academy_replay_views (user_id);

-- =============================================================================
-- Fonctions
-- =============================================================================

-- Accès à un replay. Renvoie l'état et l'heure de fin du droit de lecture :
--   'admin'     : administrateur, sans limite (fin = expiration du fichier) ;
--   'active'    : visionnage en cours (fin = début + durée réglée) ;
--   'available' : jamais visionné (seulement si p_start = false) ;
--   'watched'   : déjà visionné, délai écoulé.
-- Avec p_start = true, un premier visionnage est créé ; un visionnage terminé
-- est refusé (replay_already_watched). Sans p_start, rien n'est créé.
create or replace function public.academy_replay_access(p_recording uuid, p_start boolean default false)
returns table (state text, expires_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  uid     uuid := auth.uid();
  r       public.academy_recordings;
  v       public.academy_replay_views;
  v_hours integer;
begin
  if uid is null then
    raise exception 'unauthorized';
  end if;
  select * into r from public.academy_recordings where id = p_recording;
  if not found or r.status <> 'ready' or r.expires_at <= now() then
    raise exception 'not_found';
  end if;

  if public.is_admin(uid) then
    return query select 'admin'::text, r.expires_at;
    return;
  end if;

  if not public.academy_can_access_session(r.session_id, uid) then
    if exists (select 1 from public.academy_enrollments e
                where e.session_id = r.session_id and e.student_id = uid and e.status = 'active') then
      raise exception 'access_blocked';
    end if;
    raise exception 'forbidden';
  end if;

  select * into v from public.academy_replay_views x
   where x.recording_id = r.id and x.user_id = uid and x.reset_at is null;

  if found then
    if v.expires_at > now() then
      return query select 'active'::text, least(v.expires_at, r.expires_at);
      return;
    end if;
    if p_start then
      raise exception 'replay_already_watched';
    end if;
    return query select 'watched'::text, v.expires_at;
    return;
  end if;

  if not p_start then
    return query select 'available'::text, null::timestamptz;
    return;
  end if;

  select s.view_hours into v_hours from public.academy_replay_settings s where s.id;
  insert into public.academy_replay_views (recording_id, meeting_id, user_id, expires_at)
  values (r.id, r.meeting_id, uid, now() + make_interval(hours => coalesce(v_hours, 2)))
  on conflict (recording_id, user_id) where reset_at is null do nothing
  returning * into v;
  if v.id is null then
    -- Deux clics simultanés : le visionnage vient d'être créé par l'autre.
    select * into v from public.academy_replay_views x
     where x.recording_id = r.id and x.user_id = uid and x.reset_at is null;
  end if;
  return query select 'active'::text, least(v.expires_at, r.expires_at);
end;
$$;

-- Réinitialisation par l'administrateur : l'étudiant pourra regarder à nouveau.
create or replace function public.academy_reset_replay_view(p_recording uuid, p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'forbidden';
  end if;
  update public.academy_replay_views
     set reset_at = now(), reset_by = auth.uid()
   where recording_id = p_recording and user_id = p_user and reset_at is null;
  if not found then
    raise exception 'not_found';
  end if;
  perform public.write_audit('academy.replay.reset', 'academy_recordings', p_recording::text,
                             jsonb_build_object('user_id', p_user));
end;
$$;

-- Durée d'un visionnage (administrateur).
create or replace function public.academy_set_replay_view_hours(p_hours integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'forbidden';
  end if;
  if p_hours is null or p_hours < 1 or p_hours > 48 then
    raise exception 'amount_invalid';
  end if;
  update public.academy_replay_settings set view_hours = p_hours, updated_at = now() where id;
  perform public.write_audit('academy.replay.hours', 'academy_replay_settings', 'true',
                             jsonb_build_object('view_hours', p_hours));
end;
$$;

-- =============================================================================
-- Privilèges & RLS
-- =============================================================================
alter table public.academy_replay_settings enable row level security;
alter table public.academy_replay_views    enable row level security;

revoke all on public.academy_replay_settings, public.academy_replay_views from anon, authenticated;

-- Réglage : lisible de tous les connectés (affichage de la durée).
grant select on public.academy_replay_settings to authenticated;
create policy academy_replay_settings_select on public.academy_replay_settings
  for select to authenticated using (true);

-- Visionnages : chacun les siens, l'admin tout. Écriture par les fonctions seulement.
grant select on public.academy_replay_views to authenticated;
create policy academy_replay_views_select on public.academy_replay_views
  for select to authenticated using (user_id = auth.uid() or public.is_admin());

revoke execute on function
  public.academy_replay_access(uuid, boolean),
  public.academy_reset_replay_view(uuid, uuid),
  public.academy_set_replay_view_hours(integer)
from public, anon, authenticated;

grant execute on function
  public.academy_replay_access(uuid, boolean),
  public.academy_reset_replay_view(uuid, uuid),
  public.academy_set_replay_view_hours(integer)
to authenticated;
