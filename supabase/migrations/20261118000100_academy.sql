-- =============================================================================
-- CSC Academy — lot 1 : formations, sessions, échéancier, inscriptions,
-- paiements, séances, documents / liens / vidéos
-- =============================================================================
-- ⚠ Migration livrée NON EXÉCUTÉE : à relire puis appliquer manuellement dans
--   Supabase (SQL Editor). Elle ne modifie aucune table existante.
--
-- Règles métier garanties PAR LA BASE (jamais uniquement par l'interface) :
--   * une formation est proposée en sessions ; chaque session a un nombre de
--     places : impossible de s'inscrire quand elle est complète ;
--   * une inscription non payée réserve la place 3 jours, puis est annulée
--     (la place est libérée) ;
--   * pas de désistement : seule une inscription sans aucun paiement peut
--     être annulée ;
--   * le prix est la somme des tranches de l'échéancier ; échéancier et taux
--     de commission sont FIGÉS dès le premier paiement de la session ;
--   * un paiement ne peut jamais dépasser le reste à payer ;
--   * le code de parrainage (numéro d'ambassadeur) et le taux de commission
--     sont figés sur l'inscription ;
--   * soldes et état des tranches TOUJOURS calculés (aucun solde stocké) ;
--   * séances, documents, liens et vidéos réservés aux inscrits actifs.
-- Fondations du paiement en ligne (Notch Pay ou autre, plus tard) : un
-- paiement a un fournisseur et un statut ; seuls les paiements confirmés
-- comptent ; deux fonctions réservées au serveur ouvrent et règlent un
-- paiement en ligne.
-- Toutes les écritures sensibles passent par des fonctions SECURITY DEFINER
-- qui vérifient elles-mêmes le rôle de l'appelant et journalisent l'action.
-- =============================================================================

create type public.academy_course_status     as enum ('draft', 'published', 'archived');
create type public.academy_level             as enum ('beginner', 'intermediate', 'advanced');
create type public.academy_enrollment_status as enum ('pending', 'active', 'cancelled');
create type public.academy_payment_status    as enum ('pending', 'confirmed', 'failed');
create type public.academy_resource_kind     as enum ('document', 'link', 'video');

-- Date du jour au Cameroun (les échéances sont des dates locales).
create or replace function public.academy_today()
returns date language sql stable
as $$ select (now() at time zone 'Africa/Douala')::date $$;

-- -----------------------------------------------------------------------------
-- Formations
-- -----------------------------------------------------------------------------
create table public.academy_courses (
  id             uuid primary key default gen_random_uuid(),
  title_fr       text not null default '' check (char_length(title_fr) <= 120),
  title_en       text not null default '' check (char_length(title_en) <= 120),
  summary_fr     text not null default '' check (char_length(summary_fr) <= 500),
  summary_en     text not null default '' check (char_length(summary_en) <= 500),
  program_fr     text not null default '' check (char_length(program_fr) <= 20000),
  program_en     text not null default '' check (char_length(program_en) <= 20000),
  source_locale  text not null default 'fr' check (source_locale in ('fr', 'en')),
  level          public.academy_level not null default 'beginner',
  status         public.academy_course_status not null default 'draft',
  created_by     uuid references public.profiles (id) default auth.uid(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint academy_courses_title_required
    check (greatest(char_length(trim(title_fr)), char_length(trim(title_en))) >= 3)
);
create index academy_courses_status_idx on public.academy_courses (status, created_at desc);

create trigger academy_courses_touch before update on public.academy_courses
  for each row execute function public.touch_updated_at();

-- -----------------------------------------------------------------------------
-- Sessions (une formation peut être proposée plusieurs fois)
-- -----------------------------------------------------------------------------
create table public.academy_sessions (
  id                       uuid primary key default gen_random_uuid(),
  course_id                uuid not null references public.academy_courses (id) on delete restrict,
  label_fr                 text not null default '' check (char_length(label_fr) <= 120),
  label_en                 text not null default '' check (char_length(label_en) <= 120),
  payment_instructions_fr  text not null default '' check (char_length(payment_instructions_fr) <= 2000),
  payment_instructions_en  text not null default '' check (char_length(payment_instructions_en) <= 2000),
  source_locale            text not null default 'fr' check (source_locale in ('fr', 'en')),
  trainer_name             text not null default '' check (char_length(trainer_name) <= 120),
  starts_on                date not null,
  ends_on                  date not null,
  seats                    integer not null check (seats between 1 and 10000),
  commission_rate          numeric(5, 2) not null default 0 check (commission_rate between 0 and 100),
  -- Colonnes modifiables uniquement par les fonctions ci-dessous :
  enrollment_open          boolean not null default false,
  frozen_at                timestamptz,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  constraint academy_sessions_label_required
    check (greatest(char_length(trim(label_fr)), char_length(trim(label_en))) >= 3),
  constraint academy_sessions_dates check (ends_on >= starts_on)
);
create index academy_sessions_course_idx on public.academy_sessions (course_id, starts_on desc);

comment on column public.academy_sessions.commission_rate is
  'Pourcentage du prix versé à l''ambassadeur parrain une fois la formation entièrement payée — figé au premier paiement.';
comment on column public.academy_sessions.frozen_at is
  'Date du premier paiement : échéancier et taux de commission ne peuvent plus changer.';

-- -----------------------------------------------------------------------------
-- Échéancier : tranches d'une session (le prix = somme des tranches)
-- -----------------------------------------------------------------------------
create table public.academy_installments (
  session_id  uuid not null references public.academy_sessions (id) on delete cascade,
  rank        smallint not null check (rank between 1 and 12),
  amount      bigint not null check (amount > 0 and amount <= 100000000),
  due_on      date not null,
  primary key (session_id, rank)
);

-- -----------------------------------------------------------------------------
-- Inscriptions
-- -----------------------------------------------------------------------------
create table public.academy_enrollments (
  id                      uuid primary key default gen_random_uuid(),
  session_id              uuid not null references public.academy_sessions (id) on delete restrict,
  student_id              uuid not null references public.profiles (id) on delete restrict,
  -- Parrain et taux figés à l'inscription :
  referral_ambassador_id  uuid references public.ambassadors (user_id) on delete restrict,
  commission_rate         numeric(5, 2) not null default 0 check (commission_rate between 0 and 100),
  status                  public.academy_enrollment_status not null default 'pending',
  hold_expires_at         timestamptz,
  activated_at            timestamptz,
  cancelled_at            timestamptz,
  cancel_reason           text check (char_length(cancel_reason) <= 500),
  created_at              timestamptz not null default now(),
  constraint academy_enrollments_no_self_referral check (referral_ambassador_id is distinct from student_id)
);
-- Une seule inscription en cours par étudiant et par session.
create unique index academy_enrollments_one_per_session
  on public.academy_enrollments (session_id, student_id) where status <> 'cancelled';
create index academy_enrollments_student_idx on public.academy_enrollments (student_id, created_at desc);
create index academy_enrollments_referral_idx on public.academy_enrollments (referral_ambassador_id)
  where referral_ambassador_id is not null;

-- -----------------------------------------------------------------------------
-- Paiements des étudiants
-- -----------------------------------------------------------------------------
create table public.academy_payments (
  id                  uuid primary key default gen_random_uuid(),
  enrollment_id       uuid not null references public.academy_enrollments (id) on delete restrict,
  amount              bigint not null check (amount > 0 and amount <= 100000000),
  provider            text not null default 'manual' check (provider in ('manual', 'notchpay')),
  status              public.academy_payment_status not null default 'confirmed',
  method              text not null check (char_length(method) between 2 and 60),
  reference           text not null default '' check (char_length(reference) <= 120),
  -- Identifiant de la transaction chez le fournisseur (paiement en ligne).
  provider_reference  text unique check (char_length(provider_reference) <= 120),
  paid_on             date not null default public.academy_today(),
  recorded_by         uuid references public.profiles (id) default auth.uid(),
  confirmed_at        timestamptz,
  created_at          timestamptz not null default now(),
  constraint academy_payments_manual_confirmed check (provider <> 'manual' or status = 'confirmed'),
  constraint academy_payments_online_ref check (provider = 'manual' or provider_reference is not null)
);
create index academy_payments_enrollment_idx on public.academy_payments (enrollment_id, created_at);

-- -----------------------------------------------------------------------------
-- Délais accordés par l'admin (nouvelle date limite pour une tranche)
-- -----------------------------------------------------------------------------
create table public.academy_due_extensions (
  enrollment_id  uuid not null references public.academy_enrollments (id) on delete cascade,
  rank           smallint not null,
  due_on         date not null,
  reason         text not null default '' check (char_length(reason) <= 500),
  granted_by     uuid references public.profiles (id) default auth.uid(),
  granted_at     timestamptz not null default now(),
  primary key (enrollment_id, rank)
);

-- -----------------------------------------------------------------------------
-- Séances (lien de visio externe en attendant la visio intégrée du lot 3)
-- -----------------------------------------------------------------------------
create table public.academy_meetings (
  id                uuid primary key default gen_random_uuid(),
  session_id        uuid not null references public.academy_sessions (id) on delete cascade,
  title_fr          text not null default '' check (char_length(title_fr) <= 120),
  title_en          text not null default '' check (char_length(title_en) <= 120),
  source_locale     text not null default 'fr' check (source_locale in ('fr', 'en')),
  starts_at         timestamptz not null,
  duration_minutes  smallint not null default 60 check (duration_minutes between 15 and 60),
  external_url      text check (external_url is null or (external_url ~ '^https://' and char_length(external_url) <= 500)),
  created_at        timestamptz not null default now(),
  constraint academy_meetings_title_required
    check (greatest(char_length(trim(title_fr)), char_length(trim(title_en))) >= 3)
);
create index academy_meetings_session_idx on public.academy_meetings (session_id, starts_at);

-- -----------------------------------------------------------------------------
-- Documents (PDF privés), liens de cours et vidéos par lien
-- -----------------------------------------------------------------------------
create table public.academy_resources (
  id             uuid primary key default gen_random_uuid(),
  session_id     uuid not null references public.academy_sessions (id) on delete cascade,
  kind           public.academy_resource_kind not null,
  title_fr       text not null default '' check (char_length(title_fr) <= 120),
  title_en       text not null default '' check (char_length(title_en) <= 120),
  source_locale  text not null default 'fr' check (source_locale in ('fr', 'en')),
  url            text check (url is null or (url ~ '^https://' and char_length(url) <= 500)),
  file_path      text check (char_length(file_path) <= 300),
  created_at     timestamptz not null default now(),
  constraint academy_resources_title_required
    check (greatest(char_length(trim(title_fr)), char_length(trim(title_en))) >= 3),
  constraint academy_resources_document_file check ((kind = 'document') = (file_path is not null)),
  constraint academy_resources_url check (kind = 'document' or url is not null)
);
create index academy_resources_session_idx on public.academy_resources (session_id, kind, created_at);

-- =============================================================================
-- Garde-fous et journalisation
-- =============================================================================

-- Session : taux de commission figé ; places jamais sous le nombre d'inscrits.
create or replace function public.academy_sessions_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_taken int;
begin
  if old.frozen_at is not null and new.commission_rate is distinct from old.commission_rate then
    raise exception 'session_frozen';
  end if;
  if new.seats < old.seats then
    select count(*) into v_taken from public.academy_enrollments
     where session_id = new.id
       and (status = 'active' or (status = 'pending' and hold_expires_at > now()));
    if new.seats < v_taken then
      raise exception 'seats_below_enrolled';
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger academy_sessions_guard before update on public.academy_sessions
  for each row execute function public.academy_sessions_guard();

-- Toute création / modification / suppression de formation, session, séance
-- ou ressource est journalisée.
create or replace function public.academy_content_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entity text := replace(tg_table_name, 'academy_', 'academy.');
  v_row    jsonb := to_jsonb(coalesce(new, old));
begin
  perform public.write_audit(
    v_entity || '.' || lower(tg_op), tg_table_name, v_row ->> 'id',
    jsonb_strip_nulls(jsonb_build_object(
      'title', coalesce(v_row ->> 'title_fr', v_row ->> 'label_fr'),
      'status', v_row ->> 'status',
      'session_id', v_row ->> 'session_id',
      'course_id', v_row ->> 'course_id')));
  return coalesce(new, old);
end;
$$;

create trigger academy_courses_audit after insert or update or delete on public.academy_courses
  for each row execute function public.academy_content_audit();
create trigger academy_sessions_audit after insert or update or delete on public.academy_sessions
  for each row execute function public.academy_content_audit();
create trigger academy_meetings_audit after insert or update or delete on public.academy_meetings
  for each row execute function public.academy_content_audit();
create trigger academy_resources_audit after insert or update or delete on public.academy_resources
  for each row execute function public.academy_content_audit();

-- =============================================================================
-- Vues calculées
-- =============================================================================

-- État de chaque tranche de chaque inscription en cours. Les paiements
-- confirmés sont affectés aux tranches dans l'ordre (tranche 1, puis 2…).
create view public.academy_installment_states
with (security_invoker = true)
as
with paid as (
  select enrollment_id, sum(amount) as paid
    from public.academy_payments
   where status = 'confirmed'
   group by enrollment_id
),
sched as (
  select e.id as enrollment_id,
         e.session_id,
         i.rank,
         i.amount,
         i.due_on as original_due_on,
         coalesce(x.due_on, i.due_on) as due_on,
         sum(i.amount) over (partition by e.id order by i.rank) as cumulative
    from public.academy_enrollments e
    join public.academy_installments i on i.session_id = e.session_id
    left join public.academy_due_extensions x on x.enrollment_id = e.id and x.rank = i.rank
   where e.status <> 'cancelled'
)
select s.enrollment_id,
       s.session_id,
       s.rank,
       s.amount,
       s.original_due_on,
       s.due_on,
       greatest(0, least(s.amount, coalesce(p.paid, 0) - (s.cumulative - s.amount)))::bigint as paid_amount,
       case
         when coalesce(p.paid, 0) >= s.cumulative then 'paid'
         when coalesce(p.paid, 0) > s.cumulative - s.amount then 'partial'
         else 'unpaid'
       end as state,
       (coalesce(p.paid, 0) < s.cumulative and s.due_on < public.academy_today()) as overdue
  from sched s
  left join paid p using (enrollment_id);

-- Résumé financier de chaque inscription.
create view public.academy_enrollment_balances
with (security_invoker = true)
as
with base as (
  select e.id as enrollment_id,
         e.session_id,
         e.student_id,
         e.status,
         coalesce((select sum(i.amount) from public.academy_installments i where i.session_id = e.session_id), 0)::bigint as price,
         coalesce((select sum(p.amount) from public.academy_payments p
                    where p.enrollment_id = e.id and p.status = 'confirmed'), 0)::bigint as paid
    from public.academy_enrollments e
)
select b.enrollment_id,
       b.session_id,
       b.student_id,
       b.status,
       b.price,
       b.paid,
       greatest(b.price - b.paid, 0)::bigint as remaining,
       (b.price > 0 and b.paid >= b.price) as fully_paid,
       (select count(*) from public.academy_installment_states st
         where st.enrollment_id = b.enrollment_id and st.overdue)::int as overdue_count,
       (select min(st.due_on) from public.academy_installment_states st
         where st.enrollment_id = b.enrollment_id and st.state <> 'paid') as next_due_on
  from base b;

-- Prix et places restantes de chaque session visible au catalogue.
-- Vue exécutée avec les droits de son propriétaire (les inscriptions des
-- autres restent invisibles) : elle n'expose QUE des totaux, et seulement
-- pour les sessions des formations publiées (ou toutes pour l'admin).
create view public.academy_session_overview
with (security_invoker = false)
as
select s.id as session_id,
       s.course_id,
       coalesce((select sum(i.amount) from public.academy_installments i where i.session_id = s.id), 0)::bigint as price,
       (select count(*) from public.academy_installments i where i.session_id = s.id)::int as installments_count,
       s.seats,
       t.taken,
       greatest(s.seats - t.taken, 0)::int as remaining
  from public.academy_sessions s
  cross join lateral (
    select count(*)::int as taken
      from public.academy_enrollments e
     where e.session_id = s.id
       and (e.status = 'active' or (e.status = 'pending' and e.hold_expires_at > now()))
  ) t
 where public.is_admin()
    or exists (select 1 from public.academy_courses c where c.id = s.course_id and c.status = 'published');

-- =============================================================================
-- Fonctions métier
-- =============================================================================

-- Accès aux contenus d'une session (séances, documents, liens, vidéos) :
-- administrateur, ou étudiant dont l'inscription est active.
-- (Le lot 2 y ajoutera le blocage pour retard de paiement.)
create or replace function public.academy_can_access_session(p_session uuid, uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin(uid)
      or exists (
           select 1 from public.academy_enrollments e
            where e.session_id = p_session and e.student_id = uid and e.status = 'active');
$$;

-- Échéancier d'une session (admin) : remplace toutes les tranches.
-- Refusé une fois la session figée (premier paiement reçu).
create or replace function public.academy_set_installments(p_session uuid, p_amounts bigint[], p_due_dates date[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  s     public.academy_sessions;
  n     int := coalesce(array_length(p_amounts, 1), 0);
  i     int;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into s from public.academy_sessions where id = p_session for update;
  if not found then
    raise exception 'not_found';
  end if;
  if s.frozen_at is not null then
    raise exception 'session_frozen';
  end if;
  if n < 1 or n > 12 or n <> coalesce(array_length(p_due_dates, 1), 0) then
    raise exception 'schedule_invalid';
  end if;
  for i in 1 .. n loop
    if p_amounts[i] is null or p_amounts[i] <= 0 or p_amounts[i] > 100000000 or p_due_dates[i] is null then
      raise exception 'schedule_invalid';
    end if;
    if i > 1 and p_due_dates[i] <= p_due_dates[i - 1] then
      raise exception 'schedule_dates_order';
    end if;
  end loop;

  delete from public.academy_installments where session_id = p_session;
  insert into public.academy_installments (session_id, rank, amount, due_on)
  select p_session, g, p_amounts[g], p_due_dates[g] from generate_series(1, n) g;

  perform public.write_audit('academy.installments.set', 'academy_sessions', p_session::text,
    jsonb_build_object('amounts', to_jsonb(p_amounts), 'due_dates', to_jsonb(p_due_dates)));
end;
$$;

-- Ouverture / fermeture des inscriptions (admin). Ouvrir exige une formation
-- publiée et un échéancier.
create or replace function public.academy_set_enrollment_open(p_session uuid, p_open boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.academy_sessions;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into s from public.academy_sessions where id = p_session for update;
  if not found then
    raise exception 'not_found';
  end if;
  if coalesce(p_open, false) then
    if not exists (select 1 from public.academy_courses c where c.id = s.course_id and c.status = 'published') then
      raise exception 'course_not_published';
    end if;
    if not exists (select 1 from public.academy_installments i where i.session_id = p_session) then
      raise exception 'schedule_missing';
    end if;
  end if;
  update public.academy_sessions set enrollment_open = coalesce(p_open, false) where id = p_session;
end;
$$;

-- Annule les réservations expirées d'une session (aucun paiement reçu ni en cours).
create or replace function public.academy_release_expired_holds(p_session uuid default null)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  update public.academy_enrollments e
     set status = 'cancelled', cancelled_at = now(), cancel_reason = 'hold_expired', hold_expires_at = null
   where e.status = 'pending'
     and e.hold_expires_at <= now()
     and (p_session is null or e.session_id = p_session)
     and not exists (select 1 from public.academy_payments p
                      where p.enrollment_id = e.id and p.status in ('pending', 'confirmed'));
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Inscription d'un utilisateur à une session, avec code de parrainage facultatif.
create or replace function public.academy_enroll(p_session uuid, p_referral_code text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_code    text := upper(regexp_replace(coalesce(p_referral_code, ''), '\s', '', 'g'));
  p         public.profiles;
  s         public.academy_sessions;
  v_ref     public.ambassadors;
  v_ref_id  uuid;
  v_taken   int;
  v_id      uuid;
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

  -- Verrou exclusif sur la session : deux inscriptions simultanées ne
  -- peuvent pas prendre la dernière place.
  select * into s from public.academy_sessions where id = p_session for update;
  if not found then
    raise exception 'not_found';
  end if;
  if not s.enrollment_open
     or s.ends_on < public.academy_today()
     or not exists (select 1 from public.academy_courses c where c.id = s.course_id and c.status = 'published') then
    raise exception 'enrollment_closed';
  end if;

  perform public.academy_release_expired_holds(p_session);

  if exists (select 1 from public.academy_enrollments
              where session_id = p_session and student_id = v_uid and status <> 'cancelled') then
    raise exception 'already_enrolled';
  end if;

  select count(*) into v_taken from public.academy_enrollments
   where session_id = p_session and status in ('active', 'pending');
  if v_taken >= s.seats then
    raise exception 'session_full';
  end if;

  if v_code <> '' then
    select * into v_ref from public.ambassadors where code = v_code;
    if not found or v_ref.status <> 'active' then
      raise exception 'referral_invalid';
    end if;
    if v_ref.user_id = v_uid then
      raise exception 'referral_self';
    end if;
    v_ref_id := v_ref.user_id;
  end if;

  insert into public.academy_enrollments
    (session_id, student_id, referral_ambassador_id, commission_rate, status, hold_expires_at)
  values
    (p_session, v_uid, v_ref_id, case when v_ref_id is null then 0 else s.commission_rate end,
     'pending', now() + interval '3 days')
  returning id into v_id;

  perform public.write_audit('academy.enrollment.create', 'academy_enrollments', v_id::text,
    jsonb_build_object('session_id', p_session, 'referral', nullif(v_code, '')));
  return v_id;
end;
$$;

-- Annulation d'une inscription SANS AUCUN paiement (l'étudiant pour la
-- sienne, ou l'admin). Pas de désistement une fois un paiement reçu.
create or replace function public.academy_cancel_enrollment(p_id uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  e public.academy_enrollments;
begin
  if auth.uid() is null then
    raise exception 'unauthorized' using errcode = '42501';
  end if;
  select * into e from public.academy_enrollments
   where id = p_id and (student_id = auth.uid() or public.is_admin())
   for update;
  if not found then
    raise exception 'not_found';
  end if;
  if e.status <> 'pending'
     or exists (select 1 from public.academy_payments p
                 where p.enrollment_id = p_id and p.status in ('pending', 'confirmed')) then
    raise exception 'enrollment_not_cancellable';
  end if;
  update public.academy_enrollments
     set status = 'cancelled', cancelled_at = now(), hold_expires_at = null,
         cancel_reason = left(coalesce(nullif(trim(p_reason), ''),
                                       case when e.student_id = auth.uid() then 'student' else 'admin' end), 500)
   where id = p_id;
  perform public.write_audit('academy.enrollment.cancel', 'academy_enrollments', p_id::text,
    jsonb_build_object('session_id', e.session_id, 'reason', p_reason));
end;
$$;

-- Règle commune à tout paiement confirmé : active l'inscription en attente
-- et fige la session.
create or replace function public.academy_after_confirmed_payment(p_enrollment uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session uuid;
begin
  update public.academy_enrollments
     set status = 'active', activated_at = now(), hold_expires_at = null
   where id = p_enrollment and status = 'pending'
  returning session_id into v_session;
  if v_session is null then
    select session_id into v_session from public.academy_enrollments where id = p_enrollment;
  end if;
  update public.academy_sessions set frozen_at = now() where id = v_session and frozen_at is null;
end;
$$;

-- Enregistrement d'un paiement par l'admin (espèces, Mobile Money reçu
-- hors plateforme…). Paiements partiels autorisés, jamais au-delà du reste dû.
create or replace function public.academy_record_payment(
  p_enrollment uuid, p_amount bigint, p_method text, p_reference text default '', p_paid_on date default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  e            public.academy_enrollments;
  v_remaining  bigint;
  v_paid_on    date := coalesce(p_paid_on, public.academy_today());
  v_id         uuid;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'amount_invalid';
  end if;
  if char_length(trim(coalesce(p_method, ''))) < 2 then
    raise exception 'method_required';
  end if;
  if v_paid_on > public.academy_today() then
    raise exception 'date_invalid';
  end if;

  select * into e from public.academy_enrollments where id = p_enrollment;
  if not found then
    raise exception 'not_found';
  end if;
  -- Même ordre de verrouillage que l'inscription (session puis inscription).
  perform 1 from public.academy_sessions where id = e.session_id for update;
  select * into e from public.academy_enrollments where id = p_enrollment for update;
  if e.status = 'cancelled' then
    raise exception 'enrollment_cancelled';
  end if;

  select remaining into v_remaining from public.academy_enrollment_balances where enrollment_id = p_enrollment;
  if p_amount > coalesce(v_remaining, 0) then
    raise exception 'payment_exceeds_due';
  end if;

  insert into public.academy_payments
    (enrollment_id, amount, provider, status, method, reference, paid_on, recorded_by, confirmed_at)
  values
    (p_enrollment, p_amount, 'manual', 'confirmed', trim(p_method), trim(coalesce(p_reference, '')),
     v_paid_on, auth.uid(), now())
  returning id into v_id;

  perform public.academy_after_confirmed_payment(p_enrollment);
  perform public.write_audit('academy.payment.record', 'academy_payments', v_id::text,
    jsonb_build_object('enrollment_id', p_enrollment, 'amount', p_amount, 'method', trim(p_method),
                       'reference', p_reference, 'paid_on', v_paid_on));
  return v_id;
end;
$$;

-- Délai accordé par l'admin pour une tranche (nouvelle date limite).
create or replace function public.academy_grant_extension(
  p_enrollment uuid, p_rank int, p_due_on date, p_reason text default ''
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  e          public.academy_enrollments;
  v_original date;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into e from public.academy_enrollments where id = p_enrollment for update;
  if not found then
    raise exception 'not_found';
  end if;
  if e.status = 'cancelled' then
    raise exception 'enrollment_cancelled';
  end if;
  select due_on into v_original from public.academy_installments
   where session_id = e.session_id and rank = p_rank;
  if not found then
    raise exception 'not_found';
  end if;
  if p_due_on is null or p_due_on <= v_original then
    raise exception 'date_invalid';
  end if;
  insert into public.academy_due_extensions (enrollment_id, rank, due_on, reason, granted_by)
  values (p_enrollment, p_rank, p_due_on, left(trim(coalesce(p_reason, '')), 500), auth.uid())
  on conflict (enrollment_id, rank)
  do update set due_on = excluded.due_on, reason = excluded.reason,
                granted_by = excluded.granted_by, granted_at = now();
  perform public.write_audit('academy.extension.grant', 'academy_enrollments', p_enrollment::text,
    jsonb_build_object('rank', p_rank, 'due_on', p_due_on, 'reason', p_reason));
end;
$$;

-- -----------------------------------------------------------------------------
-- Fondations du paiement en ligne — RÉSERVÉES AU SERVEUR (clé secrète).
-- Le serveur vérifie lui-même l'identité de l'étudiant et le statut auprès
-- du fournisseur avant d'appeler ces fonctions. Pas encore utilisées.
-- -----------------------------------------------------------------------------
create or replace function public.academy_open_online_payment(
  p_enrollment uuid, p_amount bigint, p_provider text, p_provider_reference text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  e           public.academy_enrollments;
  v_remaining bigint;
  v_id        uuid;
begin
  if p_provider not in ('notchpay') or coalesce(trim(p_provider_reference), '') = '' then
    raise exception 'invalid_provider';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'amount_invalid';
  end if;
  select * into e from public.academy_enrollments where id = p_enrollment for update;
  if not found then
    raise exception 'not_found';
  end if;
  if e.status = 'cancelled' then
    raise exception 'enrollment_cancelled';
  end if;
  select remaining into v_remaining from public.academy_enrollment_balances where enrollment_id = p_enrollment;
  if p_amount > coalesce(v_remaining, 0) then
    raise exception 'payment_exceeds_due';
  end if;
  insert into public.academy_payments
    (enrollment_id, amount, provider, status, method, provider_reference, recorded_by)
  values
    (p_enrollment, p_amount, p_provider, 'pending', 'Mobile Money', trim(p_provider_reference), null)
  returning id into v_id;
  return v_id;
end;
$$;

-- Règlement d'un paiement en ligne après vérification auprès du fournisseur.
-- Idempotent : un paiement déjà réglé n'est jamais compté deux fois.
create or replace function public.academy_settle_online_payment(p_provider_reference text, p_success boolean)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  pay         public.academy_payments;
  v_remaining bigint;
begin
  select * into pay from public.academy_payments where provider_reference = p_provider_reference for update;
  if not found then
    raise exception 'not_found';
  end if;
  if pay.status <> 'pending' then
    return pay.status::text;
  end if;
  if not coalesce(p_success, false) then
    update public.academy_payments set status = 'failed' where id = pay.id;
    return 'failed';
  end if;
  select remaining into v_remaining from public.academy_enrollment_balances where enrollment_id = pay.enrollment_id;
  if pay.amount > coalesce(v_remaining, 0) then
    -- Trop-perçu : laissé en attente pour traitement manuel par l'admin.
    raise exception 'payment_exceeds_due';
  end if;
  update public.academy_payments set status = 'confirmed', confirmed_at = now() where id = pay.id;
  perform public.academy_after_confirmed_payment(pay.enrollment_id);
  perform public.write_audit('academy.payment.online_confirmed', 'academy_payments', pay.id::text,
    jsonb_build_object('enrollment_id', pay.enrollment_id, 'amount', pay.amount,
                       'provider', pay.provider, 'provider_reference', p_provider_reference));
  return 'confirmed';
end;
$$;

-- =============================================================================
-- Privilèges & RLS
-- =============================================================================
alter table public.academy_courses        enable row level security;
alter table public.academy_sessions       enable row level security;
alter table public.academy_installments   enable row level security;
alter table public.academy_enrollments    enable row level security;
alter table public.academy_payments       enable row level security;
alter table public.academy_due_extensions enable row level security;
alter table public.academy_meetings       enable row level security;
alter table public.academy_resources      enable row level security;

revoke all on public.academy_courses, public.academy_sessions, public.academy_installments,
              public.academy_enrollments, public.academy_payments, public.academy_due_extensions,
              public.academy_meetings, public.academy_resources,
              public.academy_installment_states, public.academy_enrollment_balances,
              public.academy_session_overview
  from anon, authenticated;

-- Formations : catalogue public (publiées) ; un inscrit garde la vue de sa
-- formation même archivée ; l'admin voit et gère tout.
grant select on public.academy_courses to anon, authenticated;
grant insert (title_fr, title_en, summary_fr, summary_en, program_fr, program_en, source_locale, level, status),
      update (title_fr, title_en, summary_fr, summary_en, program_fr, program_en, source_locale, level, status),
      delete
  on public.academy_courses to authenticated;

-- Fonctions d'aide SECURITY DEFINER : évitent une récursion entre les
-- politiques des formations et des sessions.
create or replace function public.academy_course_published(p_course uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.academy_courses c where c.id = p_course and c.status = 'published') $$;

create or replace function public.academy_enrolled_in_course(p_course uuid, uid uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.academy_sessions s
                   join public.academy_enrollments e on e.session_id = s.id
                  where s.course_id = p_course and e.student_id = uid and e.status <> 'cancelled')
$$;

create or replace function public.academy_enrolled_in_session(p_session uuid, uid uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.academy_enrollments e
                  where e.session_id = p_session and e.student_id = uid and e.status <> 'cancelled')
$$;

create policy academy_courses_select on public.academy_courses
  for select to anon, authenticated
  using (status = 'published' or public.is_admin() or public.academy_enrolled_in_course(id));
create policy academy_courses_insert on public.academy_courses
  for insert to authenticated with check (public.is_admin());
create policy academy_courses_update on public.academy_courses
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy academy_courses_delete on public.academy_courses
  for delete to authenticated using (public.is_admin() and status = 'draft');

-- Sessions : ouverture et gel uniquement via les fonctions (colonnes non accordées).
grant select on public.academy_sessions to anon, authenticated;
grant insert (course_id, label_fr, label_en, payment_instructions_fr, payment_instructions_en, source_locale,
              trainer_name, starts_on, ends_on, seats, commission_rate),
      update (label_fr, label_en, payment_instructions_fr, payment_instructions_en, source_locale,
              trainer_name, starts_on, ends_on, seats, commission_rate),
      delete
  on public.academy_sessions to authenticated;

create policy academy_sessions_select on public.academy_sessions
  for select to anon, authenticated
  using (
    public.is_admin()
    or public.academy_course_published(course_id)
    or public.academy_enrolled_in_session(id)
  );
create policy academy_sessions_insert on public.academy_sessions
  for insert to authenticated with check (public.is_admin());
create policy academy_sessions_update on public.academy_sessions
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
-- Suppression refusée par la base s'il existe des inscriptions (clé étrangère).
create policy academy_sessions_delete on public.academy_sessions
  for delete to authenticated using (public.is_admin());

-- Échéancier : visible avec la session ; écriture via academy_set_installments().
grant select on public.academy_installments to anon, authenticated;
create policy academy_installments_select on public.academy_installments
  for select to anon, authenticated
  using (exists (select 1 from public.academy_sessions s where s.id = session_id));

-- Inscriptions, paiements, délais : chacun les siens, l'admin tout.
grant select on public.academy_enrollments, public.academy_payments, public.academy_due_extensions to authenticated;
create policy academy_enrollments_select on public.academy_enrollments
  for select to authenticated using (student_id = auth.uid() or public.is_admin());
create policy academy_payments_select on public.academy_payments
  for select to authenticated
  using (public.is_admin()
         or exists (select 1 from public.academy_enrollments e where e.id = enrollment_id and e.student_id = auth.uid()));
create policy academy_due_extensions_select on public.academy_due_extensions
  for select to authenticated
  using (public.is_admin()
         or exists (select 1 from public.academy_enrollments e where e.id = enrollment_id and e.student_id = auth.uid()));

-- Séances et ressources : inscrits actifs et admin ; gestion par l'admin.
grant select on public.academy_meetings, public.academy_resources to authenticated;
grant insert (session_id, title_fr, title_en, source_locale, starts_at, duration_minutes, external_url),
      update (title_fr, title_en, source_locale, starts_at, duration_minutes, external_url),
      delete
  on public.academy_meetings to authenticated;
grant insert (session_id, kind, title_fr, title_en, source_locale, url, file_path),
      update (title_fr, title_en, source_locale, url, file_path),
      delete
  on public.academy_resources to authenticated;

create policy academy_meetings_select on public.academy_meetings
  for select to authenticated using (public.academy_can_access_session(session_id));
create policy academy_meetings_insert on public.academy_meetings
  for insert to authenticated with check (public.is_admin());
create policy academy_meetings_update on public.academy_meetings
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy academy_meetings_delete on public.academy_meetings
  for delete to authenticated using (public.is_admin());

create policy academy_resources_select on public.academy_resources
  for select to authenticated using (public.academy_can_access_session(session_id));
create policy academy_resources_insert on public.academy_resources
  for insert to authenticated with check (public.is_admin());
create policy academy_resources_update on public.academy_resources
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy academy_resources_delete on public.academy_resources
  for delete to authenticated using (public.is_admin());

-- Vues
grant select on public.academy_installment_states, public.academy_enrollment_balances to authenticated;
grant select on public.academy_session_overview to anon, authenticated;
grant execute on function public.is_admin(uuid) to anon;

-- Fonctions
revoke execute on function
  public.academy_today(),
  public.academy_can_access_session(uuid, uuid),
  public.academy_set_installments(uuid, bigint[], date[]),
  public.academy_set_enrollment_open(uuid, boolean),
  public.academy_release_expired_holds(uuid),
  public.academy_enroll(uuid, text),
  public.academy_cancel_enrollment(uuid, text),
  public.academy_after_confirmed_payment(uuid),
  public.academy_record_payment(uuid, bigint, text, text, date),
  public.academy_grant_extension(uuid, int, date, text),
  public.academy_open_online_payment(uuid, bigint, text, text),
  public.academy_settle_online_payment(text, boolean),
  public.academy_sessions_guard(),
  public.academy_content_audit()
from public, anon, authenticated;

grant execute on function
  public.academy_today(),
  public.academy_course_published(uuid),
  public.academy_enrolled_in_course(uuid, uuid),
  public.academy_enrolled_in_session(uuid, uuid)
to anon, authenticated;
grant execute on function
  public.academy_can_access_session(uuid, uuid),
  public.academy_set_installments(uuid, bigint[], date[]),
  public.academy_set_enrollment_open(uuid, boolean),
  public.academy_enroll(uuid, text),
  public.academy_cancel_enrollment(uuid, text),
  public.academy_record_payment(uuid, bigint, text, text, date),
  public.academy_grant_extension(uuid, int, date, text)
to authenticated;

-- Serveur uniquement (clé secrète) : tâche planifiée et paiement en ligne.
grant execute on function
  public.academy_release_expired_holds(uuid),
  public.academy_open_online_payment(uuid, bigint, text, text),
  public.academy_settle_online_payment(text, boolean)
to service_role;

-- =============================================================================
-- Stockage : documents PDF des sessions, bucket privé (10 Mo par fichier)
-- Chemin : <session_id>/<nom-de-fichier>
-- =============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('academy-files', 'academy-files', false, 10485760, array['application/pdf'])
on conflict (id) do nothing;

create policy academy_files_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'academy-files'
    and exists (select 1 from public.academy_sessions s
                 where s.id::text = (storage.foldername(objects.name))[1]
                   and public.academy_can_access_session(s.id))
  );
create policy academy_files_admin_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'academy-files' and public.is_admin());
create policy academy_files_admin_update on storage.objects
  for update to authenticated
  using (bucket_id = 'academy-files' and public.is_admin());
create policy academy_files_admin_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'academy-files' and public.is_admin());
