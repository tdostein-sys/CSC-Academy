-- =============================================================================
-- CSC Academy — lot 3 : visioconférence intégrée (LiveKit) et enregistrements
-- =============================================================================
-- ⚠ Migration livrée NON EXÉCUTÉE : à relire puis appliquer manuellement dans
--   Supabase (SQL Editor), APRÈS celles des lots 1 et 2.
--   Elle ne supprime rien et ne modifie aucune table existante : elle ajoute
--   trois tables et des fonctions `academy_*`.
--
-- Règles métier garanties PAR LA BASE :
--   * seul l'administrateur ouvre et ferme la salle d'une séance (à partir
--     d'une heure avant le début, jamais après la fin prévue) ;
--   * un étudiant n'entre dans la salle que si son inscription est active ET
--     non bloquée (J+3), que la salle est ouverte et que la séance n'est pas
--     terminée ; chaque entrée est enregistrée (présences) ;
--   * les droits dans la salle (animateur ou étudiant) sont décidés par la
--     base, puis inscrits par notre serveur dans le jeton d'accès LiveKit ;
--   * enregistrements : visibles des seuls inscrits ayant accès, jusqu'à leur
--     date d'expiration (7 jours) ; leur emplacement de stockage n'est jamais
--     communiqué aux navigateurs ; seul le serveur (clé secrète) les déclare,
--     les termine et les supprime.
-- =============================================================================

create type public.academy_recording_status as enum ('recording', 'ready', 'failed', 'deleted');

-- -----------------------------------------------------------------------------
-- Salles de visio ouvertes par l'administrateur (une par séance)
-- -----------------------------------------------------------------------------
create table public.academy_live_rooms (
  meeting_id  uuid primary key references public.academy_meetings (id) on delete cascade,
  session_id  uuid not null references public.academy_sessions (id) on delete cascade,
  room_name   text not null unique check (char_length(room_name) <= 100),
  opened_at   timestamptz not null default now(),
  opened_by   uuid references public.profiles (id) on delete set null,
  closed_at   timestamptz
);
create index academy_live_rooms_session_idx on public.academy_live_rooms (session_id);

-- -----------------------------------------------------------------------------
-- Présences (une ligne par participant et par séance)
-- -----------------------------------------------------------------------------
create table public.academy_meeting_attendance (
  meeting_id       uuid not null references public.academy_meetings (id) on delete cascade,
  user_id          uuid not null references public.profiles (id) on delete cascade,
  first_joined_at  timestamptz not null default now(),
  last_joined_at   timestamptz not null default now(),
  joins            integer not null default 1 check (joins >= 1),
  primary key (meeting_id, user_id)
);

-- -----------------------------------------------------------------------------
-- Enregistrements (fichiers stockés hors Supabase, ex. Cloudflare R2)
-- -----------------------------------------------------------------------------
create table public.academy_recordings (
  id                uuid primary key default gen_random_uuid(),
  meeting_id        uuid not null references public.academy_meetings (id) on delete cascade,
  session_id        uuid not null references public.academy_sessions (id) on delete cascade,
  -- Identifiant de l'enregistrement chez LiveKit et chemin du fichier :
  -- jamais lisibles par les navigateurs (colonnes non accordées).
  egress_id         text not null unique check (char_length(egress_id) between 1 and 100),
  object_key        text not null check (char_length(object_key) between 1 and 300),
  status            public.academy_recording_status not null default 'recording',
  started_at        timestamptz not null default now(),
  ended_at          timestamptz,
  duration_seconds  integer check (duration_seconds >= 0),
  size_bytes        bigint check (size_bytes >= 0),
  expires_at        timestamptz not null default now() + interval '7 days',
  deleted_at        timestamptz
);
create index academy_recordings_session_idx on public.academy_recordings (session_id, started_at desc);
create index academy_recordings_expiry_idx on public.academy_recordings (expires_at) where status <> 'deleted';

comment on column public.academy_recordings.expires_at is
  'Date de suppression : 7 jours après la fin de l''enregistrement (le fichier est alors effacé du stockage).';

-- =============================================================================
-- Fonctions
-- =============================================================================

-- Ouverture de la salle par l'administrateur. Renvoie le nom de la salle.
-- Possible d'une heure avant le début jusqu'à la fin prévue ; une salle
-- fermée peut être rouverte dans ce même créneau.
create or replace function public.academy_open_live_room(p_meeting uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  m      public.academy_meetings;
  v_room text := 'csc-academy-' || p_meeting::text;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'forbidden';
  end if;
  select * into m from public.academy_meetings where id = p_meeting;
  if not found then
    raise exception 'not_found';
  end if;
  if m.external_url is not null then
    raise exception 'meeting_external';
  end if;
  if now() < m.starts_at - interval '1 hour' then
    raise exception 'meeting_too_early';
  end if;
  if now() > m.starts_at + make_interval(mins => m.duration_minutes) then
    raise exception 'meeting_over';
  end if;

  insert into public.academy_live_rooms (meeting_id, session_id, room_name, opened_by)
  values (m.id, m.session_id, v_room, auth.uid())
  on conflict (meeting_id) do update
    set closed_at = null, opened_by = excluded.opened_by;

  perform public.write_audit('academy.live.open', 'academy_meetings', m.id::text,
                             jsonb_build_object('session_id', m.session_id));
  return v_room;
end;
$$;

-- Fermeture de la salle par l'administrateur (plus aucune entrée possible).
create or replace function public.academy_close_live_room(p_meeting uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'forbidden';
  end if;
  update public.academy_live_rooms set closed_at = now()
   where meeting_id = p_meeting and closed_at is null;
  if found then
    perform public.write_audit('academy.live.close', 'academy_meetings', p_meeting::text, '{}'::jsonb);
  end if;
end;
$$;

-- Fermeture automatique (serveur) : salle vidée ou terminée côté LiveKit.
create or replace function public.academy_live_room_finished(p_room text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.academy_live_rooms set closed_at = now()
   where room_name = p_room and closed_at is null;
$$;

-- Entrée dans la salle : décide du rôle (animateur / étudiant) et enregistre
-- la présence. Le serveur n'émet un jeton LiveKit qu'après cette vérification.
create or replace function public.academy_join_meeting(p_meeting uuid)
returns table (room_name text, is_host boolean, ends_at timestamptz, display_name text)
language plpgsql
security definer
set search_path = public
as $$
declare
  uid      uuid := auth.uid();
  m        public.academy_meetings;
  r        public.academy_live_rooms;
  v_admin  boolean;
  v_end    timestamptz;
begin
  if uid is null then
    raise exception 'unauthorized';
  end if;
  select * into m from public.academy_meetings where id = p_meeting;
  if not found then
    raise exception 'not_found';
  end if;
  v_admin := public.is_admin(uid);

  if not v_admin and not public.academy_can_access_session(m.session_id, uid) then
    -- Inscrit actif mais bloqué pour retard : message dédié ; sinon refus simple.
    if exists (select 1 from public.academy_enrollments e
                where e.session_id = m.session_id and e.student_id = uid and e.status = 'active') then
      raise exception 'access_blocked';
    end if;
    raise exception 'forbidden';
  end if;

  if m.external_url is not null then
    raise exception 'meeting_external';
  end if;

  -- Fin de la séance : fin prévue + 30 minutes de marge (dépassement).
  v_end := m.starts_at + make_interval(mins => m.duration_minutes) + interval '30 minutes';
  if now() > v_end then
    raise exception 'meeting_over';
  end if;

  select * into r from public.academy_live_rooms where meeting_id = m.id;
  if not found or r.closed_at is not null then
    raise exception 'meeting_not_live';
  end if;

  if not v_admin then
    insert into public.academy_meeting_attendance as a (meeting_id, user_id)
    values (m.id, uid)
    on conflict (meeting_id, user_id) do update
      set last_joined_at = now(), joins = a.joins + 1;
  end if;

  return query
    select r.room_name, v_admin, v_end,
           coalesce(nullif(trim(p.first_name || ' ' || p.last_name), ''), 'CSC')
      from public.profiles p
     where p.id = uid;
end;
$$;

-- Enregistrements (serveur uniquement) -----------------------------------------

-- Déclare un enregistrement qui démarre.
create or replace function public.academy_recording_started(p_meeting uuid, p_egress_id text, p_object_key text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.academy_recordings (meeting_id, session_id, egress_id, object_key)
  select m.id, m.session_id, p_egress_id, p_object_key
    from public.academy_meetings m
   where m.id = p_meeting
  on conflict (egress_id) do nothing
  returning id into v_id;
  return v_id;
end;
$$;

-- Termine un enregistrement (prêt ou échoué). Le compte à rebours de 7 jours
-- part de la fin de l'enregistrement. Sans effet si déjà terminé.
create or replace function public.academy_recording_finished(
  p_egress_id text, p_ok boolean, p_duration_seconds integer default null, p_size_bytes bigint default null
)
returns void
language sql
security definer
set search_path = public
as $$
  update public.academy_recordings
     set status = case when p_ok then 'ready' else 'failed' end::public.academy_recording_status,
         ended_at = now(),
         duration_seconds = greatest(p_duration_seconds, 0),
         size_bytes = greatest(p_size_bytes, 0),
         expires_at = now() + interval '7 days'
   where egress_id = p_egress_id and status = 'recording';
$$;

-- Enregistrements arrivés à expiration (fichier à effacer du stockage).
create or replace function public.academy_expired_recordings(p_limit integer default 100)
returns table (id uuid, object_key text)
language sql
stable
security definer
set search_path = public
as $$
  select r.id, r.object_key
    from public.academy_recordings r
   where r.status <> 'deleted' and r.expires_at <= now()
   order by r.expires_at
   limit least(greatest(coalesce(p_limit, 100), 1), 500);
$$;

-- Le fichier a été effacé du stockage.
create or replace function public.academy_mark_recording_deleted(p_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.academy_recordings
     set status = 'deleted', deleted_at = now()
   where id = p_id and status <> 'deleted';
$$;

-- Suppression anticipée demandée par l'administrateur : l'enregistrement
-- expire immédiatement (le serveur efface ensuite le fichier).
create or replace function public.academy_expire_recording(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'forbidden';
  end if;
  update public.academy_recordings set expires_at = now()
   where id = p_id and status <> 'deleted';
  if not found then
    raise exception 'not_found';
  end if;
  perform public.write_audit('academy.recording.delete', 'academy_recordings', p_id::text, '{}'::jsonb);
end;
$$;

-- =============================================================================
-- Privilèges & RLS
-- =============================================================================
alter table public.academy_live_rooms          enable row level security;
alter table public.academy_meeting_attendance  enable row level security;
alter table public.academy_recordings          enable row level security;

revoke all on public.academy_live_rooms, public.academy_meeting_attendance, public.academy_recordings
  from anon, authenticated;

-- Salles : visibles (ouverte / fermée) de ceux qui ont accès à la session.
grant select on public.academy_live_rooms to authenticated;
create policy academy_live_rooms_select on public.academy_live_rooms
  for select to authenticated using (public.academy_can_access_session(session_id));

-- Présences : chacun les siennes, l'admin tout.
grant select on public.academy_meeting_attendance to authenticated;
create policy academy_attendance_select on public.academy_meeting_attendance
  for select to authenticated using (user_id = auth.uid() or public.is_admin());

-- Enregistrements : l'admin tout ; les inscrits ayant accès, les enregistrements
-- prêts et non expirés. Identifiant LiveKit et chemin du fichier non accordés.
grant select (id, meeting_id, session_id, status, started_at, ended_at, duration_seconds, size_bytes, expires_at, deleted_at)
  on public.academy_recordings to authenticated;
create policy academy_recordings_select on public.academy_recordings
  for select to authenticated
  using (
    public.is_admin()
    or (status = 'ready' and expires_at > now() and public.academy_can_access_session(session_id))
  );

-- Fonctions
revoke execute on function
  public.academy_open_live_room(uuid),
  public.academy_close_live_room(uuid),
  public.academy_live_room_finished(text),
  public.academy_join_meeting(uuid),
  public.academy_recording_started(uuid, text, text),
  public.academy_recording_finished(text, boolean, integer, bigint),
  public.academy_expired_recordings(integer),
  public.academy_mark_recording_deleted(uuid),
  public.academy_expire_recording(uuid)
from public, anon, authenticated;

grant execute on function
  public.academy_open_live_room(uuid),
  public.academy_close_live_room(uuid),
  public.academy_join_meeting(uuid),
  public.academy_expire_recording(uuid)
to authenticated;

-- Serveur uniquement (clé secrète) : notifications LiveKit et tâche planifiée.
grant execute on function
  public.academy_live_room_finished(text),
  public.academy_recording_started(uuid, text, text),
  public.academy_recording_finished(text, boolean, integer, bigint),
  public.academy_expired_recordings(integer),
  public.academy_mark_recording_deleted(uuid)
to service_role;
