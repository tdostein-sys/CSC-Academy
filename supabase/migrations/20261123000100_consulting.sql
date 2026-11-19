-- =============================================================================
-- CSC Consulting — lot C1 : offres, conseillers, disponibilités, rendez-vous,
-- paiements, rappels, visio et comptes rendus
-- =============================================================================
-- ⚠ Migration livrée NON EXÉCUTÉE : à relire puis appliquer manuellement dans
--   Supabase (SQL Editor), APRÈS les migrations précédentes.
--   Elle ne modifie et ne supprime aucune table existante : elle ajoute
--   l'extension btree_gist, des tables `consulting_*`, la table `job_runs`
--   et un espace de stockage privé « consulting-files ».
--   Retour arrière : supabase/rollbacks/20261123000100_consulting.down.sql
--
-- Règles métier garanties PAR LA BASE (jamais uniquement par l'interface) :
--   * un même créneau ne peut JAMAIS être réservé deux fois pour un même
--     conseiller (contrainte d'exclusion sur la plage horaire), ni un client
--     avoir deux rendez-vous qui se chevauchent ;
--   * le client ne réserve qu'un créneau réellement libre (disponibilités du
--     conseiller, indisponibilités, délai minimal, horizon de réservation) ;
--   * prix, durée et mode de l'offre sont FIGÉS sur le rendez-vous ;
--   * rendez-vous payant : réservé 24 h (réglable) en attente de paiement,
--     puis expiré et le créneau libéré ; seul un paiement enregistré par
--     l'administrateur (référence unique, montant exact) le confirme — jamais
--     un simple retour de navigateur ;
--   * annulation / report par le client jusqu'à 24 h avant (réglable) ;
--   * remboursement possible seulement d'un rendez-vous annulé ;
--   * historique des rendez-vous en ajout seul ;
--   * compte rendu : lisible du seul client concerné (une fois publié) et des
--     collaborateurs autorisés ; CHAQUE lecture est journalisée ; figé une
--     fois publié.
-- =============================================================================

create extension if not exists btree_gist with schema extensions;

create type public.consulting_offer_status   as enum ('draft', 'published', 'archived');
create type public.consulting_mode           as enum ('video', 'phone', 'in_person');
create type public.consulting_category       as enum ('financial', 'stock', 'crypto', 'investment', 'other');
create type public.consulting_booking_status as enum ('pending_payment', 'confirmed', 'expired', 'cancelled', 'refunded');
create type public.consulting_payment_status as enum ('pending', 'confirmed', 'failed', 'refunded');
create type public.consulting_report_status  as enum ('draft', 'published');

-- -----------------------------------------------------------------------------
-- Réglages (une seule ligne)
-- -----------------------------------------------------------------------------
create table public.consulting_settings (
  id                       boolean primary key default true check (id),
  hold_hours               smallint not null default 24 check (hold_hours between 1 and 72),
  min_notice_hours         smallint not null default 24 check (min_notice_hours between 0 and 168),
  horizon_days             smallint not null default 30 check (horizon_days between 7 and 90),
  cancel_limit_hours       smallint not null default 24 check (cancel_limit_hours between 0 and 168),
  slot_step_minutes        smallint not null default 30 check (slot_step_minutes in (15, 30, 60)),
  payment_instructions_fr  text not null default '' check (char_length(payment_instructions_fr) <= 2000),
  payment_instructions_en  text not null default '' check (char_length(payment_instructions_en) <= 2000),
  source_locale            text not null default 'fr' check (source_locale in ('fr', 'en')),
  updated_at               timestamptz not null default now(),
  updated_by               uuid references public.profiles (id) on delete set null
);
insert into public.consulting_settings (id) values (true);

comment on column public.consulting_settings.hold_hours is
  'Durée pendant laquelle un rendez-vous payant non réglé garde son créneau (24 h par défaut).';

-- -----------------------------------------------------------------------------
-- Conseillers (collaborateurs qui animent les consultations)
-- -----------------------------------------------------------------------------
create table public.consulting_advisors (
  user_id       uuid primary key references public.profiles (id) on delete restrict,
  display_name  text not null check (char_length(trim(display_name)) between 2 and 120),
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  created_by    uuid references public.profiles (id) on delete set null default auth.uid()
);

-- -----------------------------------------------------------------------------
-- Offres de conseil
-- -----------------------------------------------------------------------------
create table public.consulting_offers (
  id                uuid primary key default gen_random_uuid(),
  title_fr          text not null default '' check (char_length(title_fr) <= 120),
  title_en          text not null default '' check (char_length(title_en) <= 120),
  description_fr    text not null default '' check (char_length(description_fr) <= 20000),
  description_en    text not null default '' check (char_length(description_en) <= 20000),
  conditions_fr     text not null default '' check (char_length(conditions_fr) <= 2000),
  conditions_en     text not null default '' check (char_length(conditions_en) <= 2000),
  source_locale     text not null default 'fr' check (source_locale in ('fr', 'en')),
  category          public.consulting_category not null default 'investment',
  mode              public.consulting_mode not null default 'video',
  location          text not null default '' check (char_length(location) <= 300),
  duration_minutes  smallint not null check (duration_minutes between 15 and 240),
  price             bigint not null default 0 check (price between 0 and 100000000),
  once_per_client   boolean not null default false,
  status            public.consulting_offer_status not null default 'draft',
  created_by        uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint consulting_offers_title_required
    check (greatest(char_length(trim(title_fr)), char_length(trim(title_en))) >= 3),
  constraint consulting_offers_location_required
    check (mode <> 'in_person' or char_length(trim(location)) >= 3)
);
create index consulting_offers_status_idx on public.consulting_offers (status, created_at desc);

create trigger consulting_offers_touch before update on public.consulting_offers
  for each row execute function public.touch_updated_at();

comment on column public.consulting_offers.once_per_client is
  'Offre réservable une seule fois par client (ex. premier échange gratuit).';

-- -----------------------------------------------------------------------------
-- Disponibilités habituelles (heure du Cameroun) et indisponibilités
-- -----------------------------------------------------------------------------
create table public.consulting_availability (
  id          uuid primary key default gen_random_uuid(),
  advisor_id  uuid not null references public.consulting_advisors (user_id) on delete cascade,
  weekday     smallint not null check (weekday between 1 and 7),  -- 1 = lundi … 7 = dimanche
  start_time  time not null,
  end_time    time not null,
  created_at  timestamptz not null default now(),
  constraint consulting_availability_order check (end_time > start_time)
);
create index consulting_availability_advisor_idx on public.consulting_availability (advisor_id, weekday);

create table public.consulting_unavailabilities (
  id          uuid primary key default gen_random_uuid(),
  advisor_id  uuid not null references public.consulting_advisors (user_id) on delete cascade,
  period      tstzrange not null check (not isempty(period) and not lower_inf(period) and not upper_inf(period)),
  reason      text not null default '' check (char_length(reason) <= 300),
  created_by  uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at  timestamptz not null default now()
);
create index consulting_unavailabilities_idx on public.consulting_unavailabilities using gist (advisor_id, period);

-- -----------------------------------------------------------------------------
-- Rendez-vous
-- -----------------------------------------------------------------------------
create table public.consulting_bookings (
  id                   uuid primary key default gen_random_uuid(),
  ref                  bigint generated always as identity unique,
  offer_id             uuid not null references public.consulting_offers (id) on delete restrict,
  client_id            uuid not null references public.profiles (id) on delete restrict,
  advisor_id           uuid not null references public.consulting_advisors (user_id) on delete restrict,
  -- Conditions de l'offre figées à la réservation :
  mode                 public.consulting_mode not null,
  location             text not null default '',
  duration_minutes     smallint not null check (duration_minutes between 15 and 240),
  price                bigint not null check (price >= 0),
  starts_at            timestamptz not null,
  ends_at              timestamptz not null,
  slot                 tstzrange not null,
  client_message       text not null default '' check (char_length(client_message) <= 2000),
  status               public.consulting_booking_status not null,
  hold_expires_at      timestamptz,
  confirmed_at         timestamptz,
  cancelled_at         timestamptz,
  cancelled_by         uuid references public.profiles (id) on delete set null,
  cancel_reason        text check (char_length(cancel_reason) <= 500),
  expiry_notified_at   timestamptz,
  client_joined_at     timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint consulting_bookings_hold check (status <> 'pending_payment' or hold_expires_at is not null),
  -- LA règle : jamais deux rendez-vous actifs qui se chevauchent pour un même
  -- conseiller, ni pour un même client (vérifié par la base, même en cas de
  -- clics simultanés).
  constraint consulting_bookings_no_overlap
    exclude using gist (advisor_id with =, slot with &&) where (status in ('pending_payment', 'confirmed')),
  constraint consulting_bookings_client_overlap
    exclude using gist (client_id with =, slot with &&) where (status in ('pending_payment', 'confirmed'))
);
create index consulting_bookings_client_idx on public.consulting_bookings (client_id, starts_at desc);
create index consulting_bookings_advisor_idx on public.consulting_bookings (advisor_id, starts_at);
create index consulting_bookings_status_idx on public.consulting_bookings (status, starts_at);

-- Fin et plage horaire toujours recalculées depuis le début et la durée.
create or replace function public.consulting_bookings_compute()
returns trigger
language plpgsql
as $$
begin
  new.ends_at := new.starts_at + make_interval(mins => new.duration_minutes);
  new.slot := tstzrange(new.starts_at, new.ends_at, '[)');
  if tg_op = 'UPDATE' then
    if new.offer_id <> old.offer_id or new.client_id <> old.client_id or new.price <> old.price
       or new.duration_minutes <> old.duration_minutes or new.mode <> old.mode then
      raise exception 'booking_terms_frozen';
    end if;
    new.updated_at := now();
  end if;
  return new;
end;
$$;

create trigger consulting_bookings_compute before insert or update on public.consulting_bookings
  for each row execute function public.consulting_bookings_compute();

-- Historique des rendez-vous (ajout seul)
create table public.consulting_booking_events (
  id          bigint generated always as identity primary key,
  booking_id  uuid not null references public.consulting_bookings (id) on delete restrict,
  event       text not null check (event in ('created', 'confirmed', 'payment_recorded', 'expired', 'cancelled',
                                             'rescheduled', 'refunded', 'report_published')),
  actor_id    uuid references public.profiles (id) on delete set null default auth.uid(),
  data        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index consulting_booking_events_idx on public.consulting_booking_events (booking_id, created_at);

create or replace function public.consulting_append_only()
returns trigger
language plpgsql
as $$
begin
  raise exception 'append_only';
end;
$$;

create trigger consulting_booking_events_append_only before update or delete on public.consulting_booking_events
  for each row execute function public.consulting_append_only();

-- -----------------------------------------------------------------------------
-- Paiements
-- -----------------------------------------------------------------------------
create table public.consulting_payments (
  id                  uuid primary key default gen_random_uuid(),
  booking_id          uuid not null references public.consulting_bookings (id) on delete restrict,
  amount              bigint not null check (amount > 0 and amount <= 100000000),
  currency            text not null default 'XAF' check (currency = 'XAF'),
  provider            text not null default 'manual' check (provider in ('manual', 'notchpay')),
  status              public.consulting_payment_status not null default 'confirmed',
  method              text not null check (char_length(method) between 2 and 60),
  reference           text not null default '' check (char_length(reference) <= 120),
  provider_reference  text unique check (char_length(provider_reference) <= 120),
  paid_on             date not null default public.academy_today(),
  proof_path          text check (char_length(proof_path) <= 300),
  recorded_by         uuid references public.profiles (id) on delete set null default auth.uid(),
  confirmed_at        timestamptz,
  refunded_at         timestamptz,
  refund_reference    text check (char_length(refund_reference) <= 120),
  refund_reason       text check (char_length(refund_reason) <= 500),
  refunded_by         uuid references public.profiles (id) on delete set null,
  created_at          timestamptz not null default now(),
  constraint consulting_payments_manual_ref check (provider <> 'manual' or method = 'cash' or char_length(trim(reference)) >= 2),
  constraint consulting_payments_online_ref check (provider = 'manual' or provider_reference is not null)
);
-- Une même référence de transaction ne peut pas servir deux fois.
create unique index consulting_payments_reference_key
  on public.consulting_payments (method, lower(trim(reference))) where trim(reference) <> '';
-- Au plus un paiement en cours ou confirmé par rendez-vous.
create unique index consulting_payments_one_per_booking
  on public.consulting_payments (booking_id) where status in ('pending', 'confirmed');
create index consulting_payments_created_idx on public.consulting_payments (created_at desc);

-- -----------------------------------------------------------------------------
-- Rappels envoyés (clé unique : jamais deux fois le même rappel)
-- -----------------------------------------------------------------------------
create table public.consulting_reminders (
  booking_id  uuid not null references public.consulting_bookings (id) on delete cascade,
  kind        text not null check (kind in ('day_before', 'hour_before')),
  sent_at     timestamptz not null default now(),
  primary key (booking_id, kind)
);

-- -----------------------------------------------------------------------------
-- Comptes rendus et pièces jointes
-- -----------------------------------------------------------------------------
create table public.consulting_reports (
  booking_id         uuid primary key references public.consulting_bookings (id) on delete restrict,
  consultation_date  date not null,
  subject            text not null check (char_length(trim(subject)) between 3 and 200),
  summary            text not null default '' check (char_length(summary) <= 20000),
  recommendations    text not null default '' check (char_length(recommendations) <= 20000),
  observations       text not null default '' check (char_length(observations) <= 5000),
  status             public.consulting_report_status not null default 'draft',
  author_id          uuid references public.profiles (id) on delete set null,
  published_at       timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create table public.consulting_report_files (
  id          uuid primary key default gen_random_uuid(),
  booking_id  uuid not null references public.consulting_reports (booking_id) on delete restrict,
  title       text not null check (char_length(trim(title)) between 2 and 120),
  file_path   text not null unique check (char_length(file_path) <= 300),
  size_bytes  bigint not null default 0 check (size_bytes >= 0),
  created_by  uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at  timestamptz not null default now()
);
create index consulting_report_files_idx on public.consulting_report_files (booking_id, created_at);

-- -----------------------------------------------------------------------------
-- Journal des tâches planifiées (toutes les tâches automatiques)
-- -----------------------------------------------------------------------------
create table public.job_runs (
  id           bigint generated always as identity primary key,
  job          text not null check (char_length(job) between 2 and 60),
  started_at   timestamptz not null default now(),
  finished_at  timestamptz,
  status       text not null default 'running' check (status in ('running', 'ok', 'error')),
  details      jsonb not null default '{}'::jsonb,
  error        text check (char_length(error) <= 2000)
);
create index job_runs_job_idx on public.job_runs (job, started_at desc);

-- =============================================================================
-- Fonctions d'aide (droits)
-- =============================================================================

create or replace function public.consulting_is_advisor(uid uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.consulting_advisors a where a.user_id = uid and a.active) $$;

-- Collaborateur Consulting : administrateur ou conseiller actif.
create or replace function public.consulting_is_staff(uid uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public
as $$ select public.is_admin(uid) or public.consulting_is_advisor(uid) $$;

-- Peut gérer ce rendez-vous : administrateur, ou conseiller à qui il est attribué.
create or replace function public.consulting_can_manage(p_booking uuid, uid uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public
as $$
  select public.is_admin(uid)
      or exists (select 1 from public.consulting_bookings b
                  where b.id = p_booking and b.advisor_id = uid and public.consulting_is_advisor(uid));
$$;

-- Le client a (ou a eu) un rendez-vous sur cette offre : il garde la vue de l'offre.
create or replace function public.consulting_has_booked_offer(p_offer uuid, uid uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.consulting_bookings b where b.offer_id = p_offer and b.client_id = uid) $$;

create or replace function public.consulting_event(p_booking uuid, p_event text, p_data jsonb default '{}'::jsonb)
returns void language sql security definer set search_path = public
as $$
  insert into public.consulting_booking_events (booking_id, event, actor_id, data)
  values (p_booking, p_event, auth.uid(), coalesce(p_data, '{}'::jsonb));
$$;

-- =============================================================================
-- Créneaux et réservation
-- =============================================================================

-- Rendez-vous payants non réglés dont le délai est passé : expirés, créneau libéré.
-- Un rendez-vous ayant un paiement en ligne en cours n'expire pas.
create or replace function public.consulting_expire_holds()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  with expired as (
    update public.consulting_bookings b
       set status = 'expired', hold_expires_at = null
     where b.status = 'pending_payment'
       and b.hold_expires_at <= now()
       and not exists (select 1 from public.consulting_payments p
                        where p.booking_id = b.id and p.status = 'pending')
    returning b.id
  )
  insert into public.consulting_booking_events (booking_id, event, actor_id, data)
  select e.id, 'expired', null, '{}'::jsonb from expired e;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Créneaux libres d'une offre : un par heure de début (conseiller attribué
-- automatiquement). N'expose que des heures, jamais les rendez-vous des autres.
create or replace function public.consulting_available_slots(p_offer uuid, p_ignore_booking uuid default null)
returns table (advisor_id uuid, starts_at timestamptz)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  s        public.consulting_settings;
  o        public.consulting_offers;
  v_today  date := public.academy_today();
  v_len    interval;
  v_ignore uuid;
begin
  -- Le rendez-vous à ignorer (report) n'est pris en compte que pour son client ou l'admin.
  select b.id into v_ignore from public.consulting_bookings b
   where b.id = p_ignore_booking and (b.client_id = auth.uid() or public.is_admin());
  select * into s from public.consulting_settings where id;
  select * into o from public.consulting_offers where id = p_offer;
  if not found or (o.status <> 'published' and not public.is_admin()) then
    return;
  end if;
  v_len := make_interval(mins => o.duration_minutes);

  return query
  with days as (
    select (v_today + g)::date as d from generate_series(0, s.horizon_days) g
  ),
  candidates as (
    select a.advisor_id as adv, (gs.t at time zone 'Africa/Douala') as st
      from days
      join public.consulting_availability a on a.weekday = extract(isodow from days.d)::int
      join public.consulting_advisors ad on ad.user_id = a.advisor_id and ad.active
     cross join lateral generate_series(days.d + a.start_time,
                                        days.d + a.end_time - v_len,
                                        make_interval(mins => s.slot_step_minutes)) as gs(t)
  )
  select distinct on (c.st) c.adv, c.st
    from candidates c
   where c.st >= now() + make_interval(hours => s.min_notice_hours)
     and not exists (select 1 from public.consulting_unavailabilities u
                      where u.advisor_id = c.adv
                        and u.period && tstzrange(c.st, c.st + v_len, '[)'))
     and not exists (select 1 from public.consulting_bookings b
                      where b.advisor_id = c.adv
                        and b.id is distinct from v_ignore
                        and (b.status = 'confirmed' or (b.status = 'pending_payment' and b.hold_expires_at > now()))
                        and b.slot && tstzrange(c.st, c.st + v_len, '[)'))
   order by c.st, c.adv;
end;
$$;

-- Réservation d'un créneau par le client connecté.
create or replace function public.consulting_book(p_offer uuid, p_starts_at timestamptz, p_message text default '')
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid      uuid := auth.uid();
  p          public.profiles;
  o          public.consulting_offers;
  s          public.consulting_settings;
  v_advisor  uuid;
  v_id       uuid;
  v_status   public.consulting_booking_status;
  v_hold     timestamptz;
  v_con      text;
begin
  if v_uid is null then
    raise exception 'unauthorized' using errcode = '42501';
  end if;
  select * into p from public.profiles where id = v_uid;
  if not found
     or coalesce(trim(p.first_name), '') = ''
     or coalesce(trim(p.last_name), '') = ''
     or coalesce(trim(p.phone_whatsapp), '') = '' then
    raise exception 'profile_incomplete';
  end if;
  if char_length(coalesce(p_message, '')) > 2000 then
    raise exception 'message_too_long';
  end if;

  select * into o from public.consulting_offers where id = p_offer;
  if not found or o.status <> 'published' then
    raise exception 'offer_unavailable';
  end if;
  if o.once_per_client and exists (
       select 1 from public.consulting_bookings b
        where b.client_id = v_uid and b.offer_id = p_offer and b.status in ('pending_payment', 'confirmed')) then
    raise exception 'offer_already_used';
  end if;
  select * into s from public.consulting_settings where id;

  perform public.consulting_expire_holds();

  select a.advisor_id into v_advisor
    from public.consulting_available_slots(p_offer) a
   where a.starts_at = p_starts_at
   limit 1;
  if v_advisor is null then
    raise exception 'slot_unavailable';
  end if;

  if o.price = 0 then
    v_status := 'confirmed';
  else
    v_status := 'pending_payment';
    v_hold := least(now() + make_interval(hours => s.hold_hours), p_starts_at);
  end if;

  begin
    insert into public.consulting_bookings
      (offer_id, client_id, advisor_id, mode, location, duration_minutes, price, starts_at, ends_at, slot,
       client_message, status, hold_expires_at, confirmed_at)
    values
      (o.id, v_uid, v_advisor, o.mode, o.location, o.duration_minutes, o.price, p_starts_at, p_starts_at, 'empty',
       trim(coalesce(p_message, '')), v_status, v_hold, case when v_status = 'confirmed' then now() end)
    returning id into v_id;
  exception when exclusion_violation then
    get stacked diagnostics v_con = constraint_name;
    if v_con = 'consulting_bookings_client_overlap' then
      raise exception 'client_overlap';
    end if;
    raise exception 'slot_taken';
  end;

  perform public.consulting_event(v_id, 'created',
    jsonb_build_object('starts_at', p_starts_at, 'price', o.price, 'status', v_status));
  if v_status = 'confirmed' then
    perform public.consulting_event(v_id, 'confirmed', jsonb_build_object('free', true));
  end if;
  perform public.write_audit('consulting.booking.create', 'consulting_bookings', v_id::text,
    jsonb_build_object('offer_id', p_offer, 'starts_at', p_starts_at, 'price', o.price));
  return v_id;
end;
$$;

-- Annulation : le client pour le sien (jusqu'à la limite avant le début),
-- l'administrateur à tout moment. Renvoie vrai si un remboursement est à traiter.
create or replace function public.consulting_cancel_booking(p_booking uuid, p_reason text default null)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_admin  boolean := public.is_admin();
  b        public.consulting_bookings;
  s        public.consulting_settings;
begin
  if v_uid is null then
    raise exception 'unauthorized' using errcode = '42501';
  end if;
  select * into b from public.consulting_bookings
   where id = p_booking and (client_id = v_uid or v_admin)
   for update;
  if not found then
    raise exception 'not_found';
  end if;
  if b.status not in ('pending_payment', 'confirmed') then
    raise exception 'booking_not_cancellable';
  end if;
  select * into s from public.consulting_settings where id;
  if not v_admin and b.status = 'confirmed'
     and now() > b.starts_at - make_interval(hours => s.cancel_limit_hours) then
    raise exception 'cancel_too_late';
  end if;
  if not v_admin and now() >= b.starts_at then
    raise exception 'cancel_too_late';
  end if;

  update public.consulting_bookings
     set status = 'cancelled', cancelled_at = now(), cancelled_by = v_uid, hold_expires_at = null,
         cancel_reason = left(coalesce(nullif(trim(p_reason), ''),
                                       case when b.client_id = v_uid then 'client' else 'admin' end), 500)
   where id = p_booking;
  perform public.consulting_event(p_booking, 'cancelled',
    jsonb_build_object('by', case when b.client_id = v_uid then 'client' else 'admin' end, 'reason', p_reason));
  perform public.write_audit('consulting.booking.cancel', 'consulting_bookings', p_booking::text,
    jsonb_build_object('reason', p_reason, 'previous_status', b.status));
  return exists (select 1 from public.consulting_payments p where p.booking_id = p_booking and p.status = 'confirmed');
end;
$$;

-- Report : le client (jusqu'à la limite, vers un créneau libre de la même offre),
-- l'administrateur (n'importe quelle heure future, même conseiller).
create or replace function public.consulting_reschedule_booking(p_booking uuid, p_starts_at timestamptz)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid      uuid := auth.uid();
  v_admin    boolean := public.is_admin();
  b          public.consulting_bookings;
  s          public.consulting_settings;
  v_advisor  uuid;
  v_con      text;
begin
  if v_uid is null then
    raise exception 'unauthorized' using errcode = '42501';
  end if;
  select * into b from public.consulting_bookings
   where id = p_booking and (client_id = v_uid or v_admin)
   for update;
  if not found then
    raise exception 'not_found';
  end if;
  if b.status not in ('pending_payment', 'confirmed') then
    raise exception 'booking_not_reschedulable';
  end if;
  if p_starts_at is null or p_starts_at <= now() then
    raise exception 'date_invalid';
  end if;
  if p_starts_at = b.starts_at then
    return;
  end if;
  select * into s from public.consulting_settings where id;

  if v_admin then
    v_advisor := b.advisor_id;
  else
    if now() > b.starts_at - make_interval(hours => s.cancel_limit_hours) then
      raise exception 'reschedule_too_late';
    end if;
    perform public.consulting_expire_holds();
    select a.advisor_id into v_advisor
      from public.consulting_available_slots(b.offer_id, p_booking) a
     where a.starts_at = p_starts_at
     limit 1;
    if v_advisor is null then
      raise exception 'slot_unavailable';
    end if;
  end if;

  begin
    update public.consulting_bookings
       set starts_at = p_starts_at,
           advisor_id = v_advisor,
           hold_expires_at = case when status = 'pending_payment' then least(hold_expires_at, p_starts_at) end
     where id = p_booking;
  exception when exclusion_violation then
    get stacked diagnostics v_con = constraint_name;
    if v_con = 'consulting_bookings_client_overlap' then
      raise exception 'client_overlap';
    end if;
    raise exception 'slot_taken';
  end;
  -- Les rappels repartent pour la nouvelle date.
  delete from public.consulting_reminders where booking_id = p_booking;

  perform public.consulting_event(p_booking, 'rescheduled',
    jsonb_build_object('from', b.starts_at, 'to', p_starts_at, 'by', case when v_admin then 'admin' else 'client' end));
  perform public.write_audit('consulting.booking.reschedule', 'consulting_bookings', p_booking::text,
    jsonb_build_object('old_value', b.starts_at, 'new_value', p_starts_at));
end;
$$;

-- =============================================================================
-- Paiements
-- =============================================================================

-- Enregistrement d'un paiement par l'administrateur (Mobile Money, virement,
-- espèces… reçus hors plateforme). Montant exact, référence unique.
-- Un rendez-vous expiré dont le créneau est encore libre est réactivé.
create or replace function public.consulting_record_payment(
  p_booking uuid, p_amount bigint, p_method text, p_reference text default '',
  p_paid_on date default null, p_proof_path text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  b          public.consulting_bookings;
  v_paid_on  date := coalesce(p_paid_on, public.academy_today());
  v_id       uuid;
  v_con      text;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if char_length(trim(coalesce(p_method, ''))) < 2 then
    raise exception 'method_required';
  end if;
  if trim(coalesce(p_method, '')) <> 'cash' and char_length(trim(coalesce(p_reference, ''))) < 2 then
    raise exception 'reference_required';
  end if;
  if v_paid_on > public.academy_today() then
    raise exception 'date_invalid';
  end if;

  perform public.consulting_expire_holds();
  select * into b from public.consulting_bookings where id = p_booking for update;
  if not found then
    raise exception 'not_found';
  end if;
  if b.price = 0 then
    raise exception 'booking_free';
  end if;
  if not (b.status = 'pending_payment' or (b.status = 'expired' and b.starts_at > now())) then
    raise exception 'booking_not_payable';
  end if;
  if p_amount is null or p_amount <> b.price then
    raise exception 'amount_mismatch';
  end if;

  begin
    update public.consulting_bookings
       set status = 'confirmed', hold_expires_at = null, confirmed_at = now(), expiry_notified_at = null
     where id = p_booking;
    insert into public.consulting_payments
      (booking_id, amount, provider, status, method, reference, paid_on, proof_path, recorded_by, confirmed_at)
    values
      (p_booking, p_amount, 'manual', 'confirmed', trim(p_method), trim(coalesce(p_reference, '')),
       v_paid_on, nullif(trim(coalesce(p_proof_path, '')), ''), auth.uid(), now())
    returning id into v_id;
  exception
    when exclusion_violation then
      get stacked diagnostics v_con = constraint_name;
      if v_con = 'consulting_bookings_client_overlap' then
        raise exception 'client_overlap';
      end if;
      raise exception 'slot_taken';
    when unique_violation then
      raise exception 'reference_used';
  end;

  perform public.consulting_event(p_booking, 'payment_recorded',
    jsonb_build_object('payment_id', v_id, 'amount', p_amount, 'method', trim(p_method), 'reference', p_reference));
  perform public.consulting_event(p_booking, 'confirmed', jsonb_build_object('reactivated', b.status = 'expired'));
  perform public.write_audit('consulting.payment.record', 'consulting_payments', v_id::text,
    jsonb_build_object('booking_id', p_booking, 'amount', p_amount, 'method', trim(p_method),
                       'reference', p_reference, 'paid_on', v_paid_on));
  return v_id;
end;
$$;

-- Remboursement (administrateur) d'un rendez-vous annulé, avec sa référence.
create or replace function public.consulting_refund_payment(p_payment uuid, p_reference text, p_reason text default '')
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  pay  public.consulting_payments;
  b    public.consulting_bookings;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if char_length(trim(coalesce(p_reference, ''))) < 2 then
    raise exception 'reference_required';
  end if;
  select * into pay from public.consulting_payments where id = p_payment for update;
  if not found then
    raise exception 'not_found';
  end if;
  if pay.status <> 'confirmed' then
    raise exception 'payment_not_refundable';
  end if;
  select * into b from public.consulting_bookings where id = pay.booking_id for update;
  if b.status <> 'cancelled' then
    raise exception 'refund_requires_cancellation';
  end if;

  update public.consulting_payments
     set status = 'refunded', refunded_at = now(), refunded_by = auth.uid(),
         refund_reference = trim(p_reference), refund_reason = left(trim(coalesce(p_reason, '')), 500)
   where id = p_payment;
  update public.consulting_bookings set status = 'refunded' where id = b.id;

  perform public.consulting_event(b.id, 'refunded',
    jsonb_build_object('payment_id', p_payment, 'amount', pay.amount, 'reference', trim(p_reference)));
  perform public.write_audit('consulting.payment.refund', 'consulting_payments', p_payment::text,
    jsonb_build_object('booking_id', b.id, 'amount', pay.amount, 'reference', trim(p_reference), 'reason', p_reason));
end;
$$;

-- =============================================================================
-- Visio (LiveKit) : la base décide qui entre, et quand
-- =============================================================================
-- Client : rendez-vous confirmé en visio, de 15 min avant le début à 30 min
-- après la fin. Conseiller du rendez-vous ou administrateur (animateur) : dès
-- 1 h avant. Aucune salle n'est enregistrée (confidentialité).
create or replace function public.consulting_join(p_booking uuid)
returns table (room_name text, is_host boolean, ends_at timestamptz, display_name text)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_uid   uuid := auth.uid();
  b       public.consulting_bookings;
  v_host  boolean;
  v_end   timestamptz;
  v_early interval;
begin
  if v_uid is null then
    raise exception 'unauthorized';
  end if;
  select * into b from public.consulting_bookings where id = p_booking;
  if not found then
    raise exception 'not_found';
  end if;
  v_host := public.consulting_can_manage(p_booking, v_uid);
  if not v_host and b.client_id <> v_uid then
    raise exception 'not_found';
  end if;
  if b.mode <> 'video' then
    raise exception 'booking_not_video';
  end if;
  if b.status <> 'confirmed' then
    raise exception 'booking_not_confirmed';
  end if;
  v_end := b.ends_at + interval '30 minutes';
  if now() > v_end then
    raise exception 'meeting_over';
  end if;
  v_early := case when v_host then interval '1 hour' else interval '15 minutes' end;
  if now() < b.starts_at - v_early then
    raise exception 'meeting_too_early';
  end if;

  if not v_host and b.client_joined_at is null then
    update public.consulting_bookings set client_joined_at = now() where id = p_booking;
  end if;

  return query
    select 'csc-consult-' || b.id::text, v_host, v_end,
           coalesce(case when v_host then (select a.display_name from public.consulting_advisors a where a.user_id = v_uid) end,
                    nullif(trim(p.first_name || ' ' || p.last_name), ''), 'CSC')
      from public.profiles p
     where p.id = v_uid;
end;
$$;

-- =============================================================================
-- Tâches planifiées (serveur uniquement) : rappels et avis d'expiration
-- =============================================================================

-- Rappels à envoyer : la veille (24 h avant) et 1 h avant. Chaque rappel n'est
-- réservé qu'une fois (clé unique) : une tâche relancée ne renvoie rien.
create or replace function public.consulting_claim_reminders(p_limit integer default 200)
returns table (booking_id uuid, kind text, client_id uuid, advisor_id uuid, starts_at timestamptz,
               mode public.consulting_mode, location text, offer_title_fr text, offer_title_en text)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
begin
  return query
  with due as (
    select b.id as bid, k.kind as k
      from public.consulting_bookings b
     cross join (values ('day_before'), ('hour_before')) as k(kind)
     where b.status = 'confirmed'
       and b.starts_at > now()
       and ((k.kind = 'day_before'
             and b.starts_at <= now() + interval '24 hours'
             and b.starts_at > now() + interval '1 hour'
             and b.confirmed_at <= b.starts_at - interval '23 hours')
         or (k.kind = 'hour_before' and b.starts_at <= now() + interval '1 hour'))
       and not exists (select 1 from public.consulting_reminders r where r.booking_id = b.id and r.kind = k.kind)
     limit least(greatest(coalesce(p_limit, 200), 1), 1000)
  ),
  ins as (
    insert into public.consulting_reminders (booking_id, kind)
    select bid, k from due
    on conflict do nothing
    returning consulting_reminders.booking_id as bid, consulting_reminders.kind as k
  )
  select i.bid, i.k, b.client_id, b.advisor_id, b.starts_at, b.mode, b.location, o.title_fr, o.title_en
    from ins i
    join public.consulting_bookings b on b.id = i.bid
    join public.consulting_offers o on o.id = b.offer_id;
end;
$$;

-- Rendez-vous expirés dont le client n'a pas encore été prévenu (une seule fois).
create or replace function public.consulting_claim_expiry_notices(p_limit integer default 200)
returns table (booking_id uuid, client_id uuid, starts_at timestamptz, offer_title_fr text, offer_title_en text)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
begin
  return query
  with picked as (
    select b.id from public.consulting_bookings b
     where b.status = 'expired' and b.expiry_notified_at is null
     order by b.created_at
     limit least(greatest(coalesce(p_limit, 200), 1), 1000)
     for update skip locked
  ),
  upd as (
    update public.consulting_bookings b set expiry_notified_at = now()
      from picked where b.id = picked.id
    returning b.id, b.client_id, b.starts_at, b.offer_id
  )
  select u.id, u.client_id, u.starts_at, o.title_fr, o.title_en
    from upd u join public.consulting_offers o on o.id = u.offer_id;
end;
$$;

-- =============================================================================
-- Comptes rendus
-- =============================================================================

-- Création / modification du brouillon (conseiller du rendez-vous ou admin).
create or replace function public.consulting_save_report(
  p_booking uuid, p_consultation_date date, p_subject text, p_summary text,
  p_recommendations text, p_observations text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  b  public.consulting_bookings;
  r  public.consulting_reports;
begin
  if not public.consulting_can_manage(p_booking) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into b from public.consulting_bookings where id = p_booking;
  if not found then
    raise exception 'not_found';
  end if;
  if b.status <> 'confirmed' then
    raise exception 'booking_not_confirmed';
  end if;
  select * into r from public.consulting_reports where booking_id = p_booking for update;
  if found and r.status = 'published' then
    raise exception 'report_published';
  end if;
  if p_consultation_date is null then
    raise exception 'date_invalid';
  end if;

  insert into public.consulting_reports
    (booking_id, consultation_date, subject, summary, recommendations, observations, author_id)
  values
    (p_booking, p_consultation_date, trim(coalesce(p_subject, '')), coalesce(p_summary, ''),
     coalesce(p_recommendations, ''), coalesce(p_observations, ''), auth.uid())
  on conflict (booking_id) do update
    set consultation_date = excluded.consultation_date,
        subject = excluded.subject,
        summary = excluded.summary,
        recommendations = excluded.recommendations,
        observations = excluded.observations,
        author_id = excluded.author_id,
        updated_at = now();
  perform public.write_audit('consulting.report.save', 'consulting_reports', p_booking::text, '{}'::jsonb);
end;
$$;

-- Publication : le compte rendu devient visible du client et n'est plus modifiable.
create or replace function public.consulting_publish_report(p_booking uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.consulting_reports;
begin
  if not public.consulting_can_manage(p_booking) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into r from public.consulting_reports where booking_id = p_booking for update;
  if not found then
    raise exception 'not_found';
  end if;
  if r.status = 'published' then
    raise exception 'report_published';
  end if;
  if char_length(trim(r.summary)) < 10 then
    raise exception 'report_incomplete';
  end if;
  update public.consulting_reports set status = 'published', published_at = now(), updated_at = now()
   where booking_id = p_booking;
  perform public.consulting_event(p_booking, 'report_published', '{}'::jsonb);
  perform public.write_audit('consulting.report.publish', 'consulting_reports', p_booking::text, '{}'::jsonb);
end;
$$;

-- Compte rendu figé une fois publié (même pour une écriture directe).
create or replace function public.consulting_reports_guard()
returns trigger
language plpgsql
as $$
begin
  if old.status = 'published' then
    raise exception 'report_published';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger consulting_reports_guard before update or delete on public.consulting_reports
  for each row execute function public.consulting_reports_guard();

-- Lecture d'un compte rendu : client du rendez-vous (publié) ou collaborateur
-- autorisé. CHAQUE lecture est journalisée.
create or replace function public.consulting_report_view(p_booking uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  b        public.consulting_bookings;
  r        public.consulting_reports;
  v_staff  boolean;
begin
  if v_uid is null then
    raise exception 'unauthorized';
  end if;
  select * into b from public.consulting_bookings where id = p_booking;
  select * into r from public.consulting_reports where booking_id = p_booking;
  if b.id is null or r.booking_id is null then
    raise exception 'not_found';
  end if;
  v_staff := public.consulting_can_manage(p_booking, v_uid);
  if not v_staff and not (b.client_id = v_uid and r.status = 'published') then
    raise exception 'not_found';
  end if;

  perform public.write_audit('consulting.report.view', 'consulting_reports', p_booking::text,
    jsonb_build_object('as', case when v_staff then 'staff' else 'client' end));

  return jsonb_build_object(
    'booking_id', r.booking_id,
    'consultation_date', r.consultation_date,
    'subject', r.subject,
    'summary', r.summary,
    'recommendations', r.recommendations,
    'observations', r.observations,
    'status', r.status,
    'published_at', r.published_at,
    'updated_at', r.updated_at,
    'author', (select coalesce(a.display_name, nullif(trim(pr.first_name || ' ' || pr.last_name), ''))
                 from public.profiles pr left join public.consulting_advisors a on a.user_id = pr.id
                where pr.id = r.author_id),
    'files', coalesce((select jsonb_agg(jsonb_build_object('id', f.id, 'title', f.title, 'size_bytes', f.size_bytes,
                                                           'created_at', f.created_at) order by f.created_at)
                         from public.consulting_report_files f where f.booking_id = p_booking), '[]'::jsonb));
end;
$$;

-- Pièce jointe d'un compte rendu (brouillon uniquement). Le fichier est déposé
-- par le serveur dans le stockage privé APRÈS consulting_can_manage().
create or replace function public.consulting_add_report_file(p_booking uuid, p_title text, p_path text, p_size bigint)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  r     public.consulting_reports;
  v_id  uuid;
begin
  if not public.consulting_can_manage(p_booking) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into r from public.consulting_reports where booking_id = p_booking;
  if not found then
    raise exception 'report_missing';
  end if;
  if r.status = 'published' then
    raise exception 'report_published';
  end if;
  if p_path is null or split_part(p_path, '/', 1) <> p_booking::text then
    raise exception 'forbidden';
  end if;
  insert into public.consulting_report_files (booking_id, title, file_path, size_bytes)
  values (p_booking, trim(coalesce(p_title, '')), p_path, greatest(coalesce(p_size, 0), 0))
  returning id into v_id;
  perform public.write_audit('consulting.report.file_add', 'consulting_reports', p_booking::text,
    jsonb_build_object('file_id', v_id, 'title', p_title));
  return v_id;
end;
$$;

-- Retrait d'une pièce jointe (brouillon uniquement). Renvoie le chemin à effacer.
create or replace function public.consulting_remove_report_file(p_file uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  f  public.consulting_report_files;
  r  public.consulting_reports;
begin
  select * into f from public.consulting_report_files where id = p_file;
  if not found or not public.consulting_can_manage(f.booking_id) then
    raise exception 'not_found';
  end if;
  select * into r from public.consulting_reports where booking_id = f.booking_id;
  if r.status = 'published' then
    raise exception 'report_published';
  end if;
  delete from public.consulting_report_files where id = p_file;
  perform public.write_audit('consulting.report.file_remove', 'consulting_reports', f.booking_id::text,
    jsonb_build_object('file_id', p_file, 'title', f.title));
  return f.file_path;
end;
$$;

-- Ouverture d'une pièce jointe : mêmes droits que le compte rendu, journalisée.
-- Renvoie le chemin ; le serveur génère ensuite un lien temporaire.
create or replace function public.consulting_report_file_path(p_file uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid  uuid := auth.uid();
  f      public.consulting_report_files;
  b      public.consulting_bookings;
  r      public.consulting_reports;
begin
  if v_uid is null then
    raise exception 'unauthorized';
  end if;
  select * into f from public.consulting_report_files where id = p_file;
  if not found then
    raise exception 'not_found';
  end if;
  select * into b from public.consulting_bookings where id = f.booking_id;
  select * into r from public.consulting_reports where booking_id = f.booking_id;
  if not public.consulting_can_manage(f.booking_id, v_uid)
     and not (b.client_id = v_uid and r.status = 'published') then
    raise exception 'not_found';
  end if;
  perform public.write_audit('consulting.report.file_open', 'consulting_reports', f.booking_id::text,
    jsonb_build_object('file_id', p_file));
  return f.file_path;
end;
$$;

-- =============================================================================
-- Conseillers (administrateur)
-- =============================================================================
create or replace function public.consulting_set_advisor(p_user uuid, p_display_name text, p_active boolean default true)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles where id = p_user) then
    raise exception 'not_found';
  end if;
  insert into public.consulting_advisors (user_id, display_name, active, created_by)
  values (p_user, trim(coalesce(p_display_name, '')), coalesce(p_active, true), auth.uid())
  on conflict (user_id) do update
    set display_name = excluded.display_name, active = excluded.active;
  perform public.write_audit('consulting.advisor.set', 'consulting_advisors', p_user::text,
    jsonb_build_object('display_name', p_display_name, 'active', p_active));
end;
$$;

-- Journalisation des offres, disponibilités et réglages.
create or replace function public.consulting_config_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row jsonb := to_jsonb(coalesce(new, old));
begin
  perform public.write_audit(
    replace(tg_table_name, 'consulting_', 'consulting.') || '.' || lower(tg_op), tg_table_name,
    coalesce(v_row ->> 'id', v_row ->> 'advisor_id'),
    jsonb_strip_nulls(jsonb_build_object(
      'title', v_row ->> 'title_fr', 'status', v_row ->> 'status', 'price', v_row ->> 'price',
      'advisor_id', v_row ->> 'advisor_id', 'weekday', v_row ->> 'weekday',
      'old_value', case when tg_op = 'UPDATE' then to_jsonb(old) - 'description_fr' - 'description_en' end)));
  return coalesce(new, old);
end;
$$;

create trigger consulting_offers_audit after insert or update or delete on public.consulting_offers
  for each row execute function public.consulting_config_audit();
create trigger consulting_availability_audit after insert or update or delete on public.consulting_availability
  for each row execute function public.consulting_config_audit();
create trigger consulting_unavailabilities_audit after insert or update or delete on public.consulting_unavailabilities
  for each row execute function public.consulting_config_audit();
create trigger consulting_settings_audit after update on public.consulting_settings
  for each row execute function public.consulting_config_audit();

create or replace function public.consulting_settings_touch()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;
create trigger consulting_settings_touch before update on public.consulting_settings
  for each row execute function public.consulting_settings_touch();

-- =============================================================================
-- Vue : rendez-vous avec offre, client et conseiller
-- =============================================================================
-- Exécutée avec les droits de son propriétaire : elle filtre elle-même les
-- lignes (le client voit les siens, le conseiller ceux qui lui sont attribués,
-- l'admin tout). Elle donne au conseiller les coordonnées du client.
create view public.consulting_booking_details
with (security_invoker = false)
as
select b.id, b.ref, b.offer_id, b.client_id, b.advisor_id, b.mode, b.location, b.duration_minutes, b.price,
       b.starts_at, b.ends_at, b.client_message, b.status, b.hold_expires_at, b.confirmed_at,
       b.cancelled_at, b.cancel_reason, b.client_joined_at, b.created_at,
       o.title_fr as offer_title_fr, o.title_en as offer_title_en, o.category,
       c.first_name as client_first_name, c.last_name as client_last_name,
       c.email as client_email, c.phone_whatsapp as client_phone,
       a.display_name as advisor_name,
       r.status as report_status, r.published_at as report_published_at,
       exists (select 1 from public.consulting_payments p where p.booking_id = b.id and p.status = 'confirmed') as paid
  from public.consulting_bookings b
  join public.consulting_offers o on o.id = b.offer_id
  join public.profiles c on c.id = b.client_id
  join public.consulting_advisors a on a.user_id = b.advisor_id
  left join public.consulting_reports r on r.booking_id = b.id
 where b.client_id = auth.uid() or public.consulting_can_manage(b.id);

-- =============================================================================
-- Privilèges & RLS
-- =============================================================================
alter table public.consulting_settings          enable row level security;
alter table public.consulting_advisors          enable row level security;
alter table public.consulting_offers            enable row level security;
alter table public.consulting_availability      enable row level security;
alter table public.consulting_unavailabilities  enable row level security;
alter table public.consulting_bookings          enable row level security;
alter table public.consulting_booking_events    enable row level security;
alter table public.consulting_payments          enable row level security;
alter table public.consulting_reminders         enable row level security;
alter table public.consulting_reports           enable row level security;
alter table public.consulting_report_files      enable row level security;
alter table public.job_runs                     enable row level security;

revoke all on public.consulting_settings, public.consulting_advisors, public.consulting_offers,
              public.consulting_availability, public.consulting_unavailabilities, public.consulting_bookings,
              public.consulting_booking_events, public.consulting_payments, public.consulting_reminders,
              public.consulting_reports, public.consulting_report_files, public.job_runs,
              public.consulting_booking_details
  from anon, authenticated;

-- Réglages : lecture par tous (instructions de paiement) ; modification par l'admin.
grant select on public.consulting_settings to anon, authenticated;
grant update (hold_hours, min_notice_hours, horizon_days, cancel_limit_hours, slot_step_minutes,
              payment_instructions_fr, payment_instructions_en, source_locale)
  on public.consulting_settings to authenticated;
create policy consulting_settings_select on public.consulting_settings
  for select to anon, authenticated using (true);
create policy consulting_settings_update on public.consulting_settings
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- Conseillers : noms visibles des utilisateurs connectés ; écriture via consulting_set_advisor().
grant select on public.consulting_advisors to authenticated;
create policy consulting_advisors_select on public.consulting_advisors
  for select to authenticated using (active or public.is_admin() or user_id = auth.uid());

-- Offres : catalogue public (publiées) ; le client garde la vue de son offre ; l'admin gère.
grant select on public.consulting_offers to anon, authenticated;
grant insert (title_fr, title_en, description_fr, description_en, conditions_fr, conditions_en, source_locale,
              category, mode, location, duration_minutes, price, once_per_client, status),
      update (title_fr, title_en, description_fr, description_en, conditions_fr, conditions_en, source_locale,
              category, mode, location, duration_minutes, price, once_per_client, status),
      delete
  on public.consulting_offers to authenticated;
create policy consulting_offers_select on public.consulting_offers
  for select to anon, authenticated
  using (status = 'published' or public.is_admin() or public.consulting_has_booked_offer(id));
create policy consulting_offers_insert on public.consulting_offers
  for insert to authenticated with check (public.is_admin());
create policy consulting_offers_update on public.consulting_offers
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
-- Suppression : brouillon sans rendez-vous uniquement (clé étrangère).
create policy consulting_offers_delete on public.consulting_offers
  for delete to authenticated using (public.is_admin() and status = 'draft');

-- Disponibilités et indisponibilités : l'admin, ou le conseiller pour les siennes.
grant select, delete on public.consulting_availability, public.consulting_unavailabilities to authenticated;
grant insert (advisor_id, weekday, start_time, end_time) on public.consulting_availability to authenticated;
grant insert (advisor_id, period, reason) on public.consulting_unavailabilities to authenticated;
create policy consulting_availability_select on public.consulting_availability
  for select to authenticated using (public.is_admin() or advisor_id = auth.uid());
create policy consulting_availability_insert on public.consulting_availability
  for insert to authenticated
  with check (public.is_admin() or (advisor_id = auth.uid() and public.consulting_is_advisor()));
create policy consulting_availability_delete on public.consulting_availability
  for delete to authenticated using (public.is_admin() or (advisor_id = auth.uid() and public.consulting_is_advisor()));
create policy consulting_unavailabilities_select on public.consulting_unavailabilities
  for select to authenticated using (public.is_admin() or advisor_id = auth.uid());
create policy consulting_unavailabilities_insert on public.consulting_unavailabilities
  for insert to authenticated
  with check (public.is_admin() or (advisor_id = auth.uid() and public.consulting_is_advisor()));
create policy consulting_unavailabilities_delete on public.consulting_unavailabilities
  for delete to authenticated using (public.is_admin() or (advisor_id = auth.uid() and public.consulting_is_advisor()));

-- Rendez-vous, historique, paiements : le client les siens, le conseiller ceux
-- qui lui sont attribués, l'admin tout. Aucune écriture directe.
grant select on public.consulting_bookings, public.consulting_booking_events, public.consulting_payments to authenticated;
create policy consulting_bookings_select on public.consulting_bookings
  for select to authenticated using (client_id = auth.uid() or public.consulting_can_manage(id));
create policy consulting_booking_events_select on public.consulting_booking_events
  for select to authenticated
  using (public.consulting_can_manage(booking_id)
         or exists (select 1 from public.consulting_bookings b where b.id = booking_id and b.client_id = auth.uid()));
create policy consulting_payments_select on public.consulting_payments
  for select to authenticated
  using (public.is_admin()
         or exists (select 1 from public.consulting_bookings b where b.id = booking_id and b.client_id = auth.uid()));

-- Rappels : supervision par l'admin.
grant select on public.consulting_reminders to authenticated;
create policy consulting_reminders_select on public.consulting_reminders
  for select to authenticated using (public.is_admin());

-- Comptes rendus : seules l'existence et la date de publication sont lisibles
-- directement ; le contenu passe par consulting_report_view() (journalisée).
grant select (booking_id, status, published_at, consultation_date) on public.consulting_reports to authenticated;
create policy consulting_reports_select on public.consulting_reports
  for select to authenticated
  using (public.consulting_can_manage(booking_id)
         or (status = 'published'
             and exists (select 1 from public.consulting_bookings b where b.id = booking_id and b.client_id = auth.uid())));
grant select (id, booking_id, title, size_bytes, created_at) on public.consulting_report_files to authenticated;
create policy consulting_report_files_select on public.consulting_report_files
  for select to authenticated
  using (public.consulting_can_manage(booking_id)
         or exists (select 1 from public.consulting_reports r
                     join public.consulting_bookings b on b.id = r.booking_id
                    where r.booking_id = consulting_report_files.booking_id
                      and r.status = 'published' and b.client_id = auth.uid()));

-- Tâches planifiées : lecture par l'admin ; écriture par le serveur (clé secrète).
grant select on public.job_runs to authenticated;
create policy job_runs_select on public.job_runs
  for select to authenticated using (public.is_admin());

grant select on public.consulting_booking_details to authenticated;

-- Fonctions
revoke execute on function
  public.consulting_is_advisor(uuid),
  public.consulting_is_staff(uuid),
  public.consulting_can_manage(uuid, uuid),
  public.consulting_has_booked_offer(uuid, uuid),
  public.consulting_event(uuid, text, jsonb),
  public.consulting_expire_holds(),
  public.consulting_available_slots(uuid, uuid),
  public.consulting_book(uuid, timestamptz, text),
  public.consulting_cancel_booking(uuid, text),
  public.consulting_reschedule_booking(uuid, timestamptz),
  public.consulting_record_payment(uuid, bigint, text, text, date, text),
  public.consulting_refund_payment(uuid, text, text),
  public.consulting_join(uuid),
  public.consulting_claim_reminders(integer),
  public.consulting_claim_expiry_notices(integer),
  public.consulting_save_report(uuid, date, text, text, text, text),
  public.consulting_publish_report(uuid),
  public.consulting_report_view(uuid),
  public.consulting_add_report_file(uuid, text, text, bigint),
  public.consulting_remove_report_file(uuid),
  public.consulting_report_file_path(uuid),
  public.consulting_set_advisor(uuid, text, boolean),
  public.consulting_bookings_compute(),
  public.consulting_append_only(),
  public.consulting_reports_guard(),
  public.consulting_config_audit(),
  public.consulting_settings_touch()
from public, anon, authenticated;

grant execute on function
  public.consulting_is_advisor(uuid),
  public.consulting_is_staff(uuid),
  public.consulting_can_manage(uuid, uuid),
  public.consulting_has_booked_offer(uuid, uuid),
  public.consulting_available_slots(uuid, uuid)
to anon, authenticated;
grant execute on function
  public.consulting_book(uuid, timestamptz, text),
  public.consulting_cancel_booking(uuid, text),
  public.consulting_reschedule_booking(uuid, timestamptz),
  public.consulting_record_payment(uuid, bigint, text, text, date, text),
  public.consulting_refund_payment(uuid, text, text),
  public.consulting_join(uuid),
  public.consulting_save_report(uuid, date, text, text, text, text),
  public.consulting_publish_report(uuid),
  public.consulting_report_view(uuid),
  public.consulting_add_report_file(uuid, text, text, bigint),
  public.consulting_remove_report_file(uuid),
  public.consulting_report_file_path(uuid),
  public.consulting_set_advisor(uuid, text, boolean)
to authenticated;

-- Serveur uniquement (clé secrète) : tâches planifiées.
grant execute on function
  public.consulting_expire_holds(),
  public.consulting_claim_reminders(integer),
  public.consulting_claim_expiry_notices(integer)
to service_role;

-- =============================================================================
-- Stockage : comptes rendus (PDF, images) et justificatifs de paiement, privé.
-- Chemins : <booking_id>/<fichier> (comptes rendus), payments/<booking_id>/<fichier>.
-- Dépôt et lecture par le serveur (clé secrète) APRÈS vérification des droits
-- par la base ; accès direct réservé à l'administrateur.
-- =============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('consulting-files', 'consulting-files', false, 10485760,
        array['application/pdf', 'image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

create policy consulting_files_admin_read on storage.objects
  for select to authenticated using (bucket_id = 'consulting-files' and public.is_admin());
create policy consulting_files_admin_insert on storage.objects
  for insert to authenticated with check (bucket_id = 'consulting-files' and public.is_admin());
create policy consulting_files_admin_delete on storage.objects
  for delete to authenticated using (bucket_id = 'consulting-files' and public.is_admin());
