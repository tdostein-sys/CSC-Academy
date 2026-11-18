-- =============================================================================
-- CSC Academy — lot 2 : rappels et blocage, commissions des ambassadeurs,
-- évaluation finale (questionnaire), attestations
-- =============================================================================
-- ⚠ Migration livrée NON EXÉCUTÉE : à relire puis appliquer manuellement dans
--   Supabase (SQL Editor), APRÈS celle du lot 1 (20261118000100_academy.sql).
--   Elle ne supprime rien et ne modifie aucune donnée existante : elle ajoute
--   des tables et remplace trois fonctions / vues du lot 1 par une version
--   étendue (mêmes colonnes, mêmes droits).
--
-- Règles métier garanties PAR LA BASE :
--   * une tranche impayée 3 jours après sa date limite BLOQUE l'accès aux
--     séances, documents, liens et vidéos ; le paiement débloque aussitôt
--     (rien n'est stocké : le blocage est recalculé à chaque accès) ;
--   * rappels J-3 et J, avis de blocage : envoyés une seule fois par tranche
--     (un délai accordé relance le calendrier) ;
--   * commission due UNE fois la formation entièrement payée, au taux figé
--     sur l'inscription ; paiement par l'admin jamais au-delà du dû,
--     confirmation de réception par l'ambassadeur ;
--   * questionnaire : bonnes réponses jamais envoyées aux étudiants,
--     correction faite par la base, nombre de tentatives limité, questions
--     figées dès la première copie rendue ;
--   * attestation délivrée automatiquement quand l'évaluation est réussie ET
--     tout est payé ; numéro unique vérifiable publiquement.
-- =============================================================================

-- =============================================================================
-- 1. Blocage pour retard de paiement (J+3)
-- =============================================================================

-- Date à partir de laquelle une inscription active est bloquée (null = non
-- bloquée) : 3 jours après la date limite de la plus ancienne tranche impayée.
create or replace function public.academy_blocked_since(p_enrollment uuid)
returns date
language sql
stable
security definer
set search_path = public
as $$
  select min(st.due_on) + 3
    from public.academy_installment_states st
    join public.academy_enrollments e on e.id = st.enrollment_id
   where st.enrollment_id = p_enrollment
     and e.status = 'active'
     and st.state <> 'paid'
     and st.due_on + 3 <= public.academy_today();
$$;

-- Accès aux contenus d'une session : administrateur, ou étudiant dont
-- l'inscription est active ET non bloquée.
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
            where e.session_id = p_session and e.student_id = uid and e.status = 'active'
              and public.academy_blocked_since(e.id) is null);
$$;

-- Résumé financier : colonne « blocked_since » ajoutée en fin de vue.
create or replace view public.academy_enrollment_balances
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
         where st.enrollment_id = b.enrollment_id and st.state <> 'paid') as next_due_on,
       case when b.status = 'active' then
         (select min(st.due_on) + 3 from public.academy_installment_states st
           where st.enrollment_id = b.enrollment_id and st.state <> 'paid'
             and st.due_on + 3 <= public.academy_today())
       end as blocked_since
  from base b;

-- =============================================================================
-- 2. Rappels de paiement (tâche planifiée quotidienne)
-- =============================================================================
-- Journal des rappels envoyés : garantit un seul envoi par tranche et par
-- type. La date limite fait partie de la clé : un délai accordé relance le
-- calendrier des rappels.
create table public.academy_reminders (
  enrollment_id  uuid not null references public.academy_enrollments (id) on delete cascade,
  rank           smallint not null,
  kind           text not null check (kind in ('due_soon', 'due_today', 'blocked')),
  due_on         date not null,
  sent_at        timestamptz not null default now(),
  primary key (enrollment_id, rank, kind, due_on)
);

-- Réserve les rappels à envoyer aujourd'hui et les renvoie (serveur
-- uniquement). Appelée une fois par jour ; un rappel réservé ne repart pas.
--   due_soon  : date limite dans 1 à 3 jours (J-3) ;
--   due_today : date limite atteinte, blocage dans 3 jours (J) ;
--   blocked   : accès bloqué (J+3), inscriptions actives uniquement.
create or replace function public.academy_claim_reminders(p_limit int default 500)
returns table (
  enrollment_id     uuid,
  student_id        uuid,
  session_id        uuid,
  rank              int,
  kind              text,
  amount_due        bigint,
  due_on            date,
  blocks_on         date,
  course_title_fr   text,
  course_title_en   text,
  session_label_fr  text,
  session_label_en  text
)
language sql
volatile
security definer
set search_path = public
as $$
  with today as (
    select public.academy_today() as d
  ),
  candidates as (
    select st.enrollment_id as c_enrollment,
           e.student_id     as c_student,
           e.session_id     as c_session,
           st.rank::int     as c_rank,
           st.due_on        as c_due_on,
           (st.amount - st.paid_amount)::bigint as c_amount_due,
           case
             when e.status = 'active' and st.due_on + 3 <= t.d then 'blocked'
             when st.due_on <= t.d and st.due_on + 3 > t.d then 'due_today'
             when st.due_on > t.d and st.due_on <= t.d + 3 then 'due_soon'
           end as c_kind
      from public.academy_installment_states st
      join public.academy_enrollments e on e.id = st.enrollment_id
      cross join today t
     where st.state <> 'paid'
       and e.status in ('pending', 'active')
  ),
  todo as (
    select c.*
      from candidates c
     where c.c_kind is not null
       and not exists (select 1 from public.academy_reminders r
                        where r.enrollment_id = c.c_enrollment and r.rank = c.c_rank
                          and r.kind = c.c_kind and r.due_on = c.c_due_on)
     order by c.c_due_on, c.c_enrollment, c.c_rank
     limit greatest(coalesce(p_limit, 500), 1)
  ),
  ins as (
    insert into public.academy_reminders (enrollment_id, rank, kind, due_on)
    select todo.c_enrollment, todo.c_rank, todo.c_kind, todo.c_due_on from todo
    on conflict do nothing
    returning academy_reminders.enrollment_id as i_enrollment, academy_reminders.rank as i_rank,
              academy_reminders.kind as i_kind, academy_reminders.due_on as i_due_on
  )
  select t.c_enrollment, t.c_student, t.c_session, t.c_rank, t.c_kind, t.c_amount_due,
         t.c_due_on, t.c_due_on + 3,
         co.title_fr, co.title_en, s.label_fr, s.label_en
    from ins i
    join todo t on t.c_enrollment = i.i_enrollment and t.c_rank = i.i_rank
               and t.c_kind = i.i_kind and t.c_due_on = i.i_due_on
    join public.academy_sessions s on s.id = t.c_session
    join public.academy_courses co on co.id = s.course_id;
$$;

-- =============================================================================
-- 3. Commissions des ambassadeurs
-- =============================================================================
create table public.academy_commission_payouts (
  id             uuid primary key default gen_random_uuid(),
  enrollment_id  uuid not null references public.academy_enrollments (id) on delete restrict,
  ambassador_id  uuid not null references public.ambassadors (user_id) on delete restrict,
  amount         bigint not null check (amount > 0),
  method         text not null check (char_length(method) between 2 and 60),
  reference      text not null default '' check (char_length(reference) <= 120),
  paid_by        uuid references public.profiles (id) default auth.uid(),
  paid_at        timestamptz not null default now(),
  confirmed_at   timestamptz,
  created_at     timestamptz not null default now()
);
create index academy_commission_payouts_ambassador_idx
  on public.academy_commission_payouts (ambassador_id, enrollment_id);

-- Une ligne par inscription parrainée. Vue exécutée avec les droits de son
-- propriétaire : un ambassadeur ne voit QUE ses parrainages, avec le prénom
-- et l'initiale du nom de l'étudiant et l'avancement du paiement.
-- Commission due uniquement quand la formation est entièrement payée.
create view public.academy_commissions
with (security_invoker = false)
as
with figures as (
  select e.id as enrollment_id,
         e.session_id,
         s.course_id,
         e.referral_ambassador_id as ambassador_id,
         e.student_id,
         e.commission_rate,
         e.status,
         e.created_at,
         coalesce((select sum(i.amount) from public.academy_installments i where i.session_id = e.session_id), 0)::bigint as price,
         coalesce((select sum(p.amount) from public.academy_payments p
                    where p.enrollment_id = e.id and p.status = 'confirmed'), 0)::bigint as student_paid
    from public.academy_enrollments e
    join public.academy_sessions s on s.id = e.session_id
   where e.referral_ambassador_id is not null
     and e.status <> 'cancelled'
     and (public.is_admin() or e.referral_ambassador_id = auth.uid())
),
paid as (
  select enrollment_id,
         sum(amount) as paid,
         coalesce(sum(amount) filter (where confirmed_at is not null), 0) as confirmed,
         count(*) filter (where confirmed_at is null) as unconfirmed_count
    from public.academy_commission_payouts
   group by enrollment_id
)
select f.enrollment_id,
       f.session_id,
       f.course_id,
       f.ambassador_id,
       a.code as ambassador_code,
       trim(pr.first_name || ' ' || left(pr.last_name, 1) || '.') as student_label,
       f.status,
       f.commission_rate,
       f.price,
       f.student_paid,
       (f.price > 0 and f.student_paid >= f.price) as fully_paid,
       round(f.price * f.commission_rate / 100)::bigint as amount,
       case when f.price > 0 and f.student_paid >= f.price
            then round(f.price * f.commission_rate / 100) else 0 end::bigint as earned,
       coalesce(p.paid, 0)::bigint as paid,
       coalesce(p.confirmed, 0)::bigint as confirmed,
       (case when f.price > 0 and f.student_paid >= f.price
             then round(f.price * f.commission_rate / 100) else 0 end - coalesce(p.paid, 0))::bigint as due,
       coalesce(p.unconfirmed_count, 0)::int as unconfirmed_count,
       f.created_at as enrolled_at,
       co.title_fr as course_title_fr,
       co.title_en as course_title_en,
       s.label_fr as session_label_fr,
       s.label_en as session_label_en
  from figures f
  join public.ambassadors a on a.user_id = f.ambassador_id
  join public.profiles pr on pr.id = f.student_id
  join public.academy_sessions s on s.id = f.session_id
  join public.academy_courses co on co.id = f.course_id
  left join paid p on p.enrollment_id = f.enrollment_id;

-- Paiement d'une commission par l'admin (partiel possible, jamais au-delà du dû).
create or replace function public.academy_record_commission_payout(
  p_enrollment uuid, p_amount bigint, p_method text, p_reference text default ''
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ambassador uuid;
  v_due        bigint;
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
  select referral_ambassador_id into v_ambassador from public.academy_enrollments where id = p_enrollment;
  if v_ambassador is null then
    raise exception 'not_found';
  end if;
  -- Sérialise les paiements d'un même ambassadeur (pas de double paiement).
  perform 1 from public.ambassadors where user_id = v_ambassador for update;

  select due into v_due from public.academy_commissions where enrollment_id = p_enrollment;
  if p_amount > coalesce(v_due, 0) then
    raise exception 'payout_exceeds_due';
  end if;

  insert into public.academy_commission_payouts (enrollment_id, ambassador_id, amount, method, reference, paid_by)
  values (p_enrollment, v_ambassador, p_amount, trim(p_method), trim(coalesce(p_reference, '')), auth.uid())
  returning id into v_id;

  perform public.write_audit('academy.commission.pay', 'academy_commission_payouts', v_id::text,
    jsonb_build_object('enrollment_id', p_enrollment, 'ambassador_id', v_ambassador,
                       'amount', p_amount, 'method', trim(p_method), 'reference', p_reference));
  return v_id;
end;
$$;

-- Confirmation de réception par l'ambassadeur (ses propres paiements uniquement).
create or replace function public.academy_confirm_commission_payout(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.academy_commission_payouts
     set confirmed_at = now()
   where id = p_id and ambassador_id = auth.uid() and confirmed_at is null;
  if not found then
    raise exception 'not_found';
  end if;
  perform public.write_audit('academy.commission.confirm', 'academy_commission_payouts', p_id::text, '{}'::jsonb);
end;
$$;

-- =============================================================================
-- 4. Évaluation finale : questionnaire en ligne
-- =============================================================================
create type public.academy_evaluation_status as enum ('draft', 'open', 'closed');

-- Une évaluation finale par session.
create table public.academy_evaluations (
  session_id       uuid primary key references public.academy_sessions (id) on delete cascade,
  title_fr         text not null default '' check (char_length(title_fr) <= 120),
  title_en         text not null default '' check (char_length(title_en) <= 120),
  instructions_fr  text not null default '' check (char_length(instructions_fr) <= 2000),
  instructions_en  text not null default '' check (char_length(instructions_en) <= 2000),
  source_locale    text not null default 'fr' check (source_locale in ('fr', 'en')),
  pass_mark        smallint not null default 50 check (pass_mark between 1 and 100),
  max_attempts     smallint not null default 2 check (max_attempts between 1 and 10),
  status           public.academy_evaluation_status not null default 'draft',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint academy_evaluations_title_required
    check (greatest(char_length(trim(title_fr)), char_length(trim(title_en))) >= 3)
);

-- Questions à choix. Les propositions sont stockées dans l'ordre :
--   [{"label_fr": "…", "label_en": "…", "correct": true}, …]
-- Les étudiants ne lisent JAMAIS cette table (bonnes réponses) : ils
-- reçoivent le questionnaire via academy_evaluation_paper().
create table public.academy_questions (
  id             uuid primary key default gen_random_uuid(),
  session_id     uuid not null references public.academy_evaluations (session_id) on delete cascade,
  position       smallint not null check (position between 1 and 200),
  prompt_fr      text not null default '' check (char_length(prompt_fr) <= 1000),
  prompt_en      text not null default '' check (char_length(prompt_en) <= 1000),
  source_locale  text not null default 'fr' check (source_locale in ('fr', 'en')),
  multiple       boolean not null default false,
  points         smallint not null default 1 check (points between 1 and 20),
  choices        jsonb not null check (jsonb_typeof(choices) = 'array'),
  created_at     timestamptz not null default now(),
  constraint academy_questions_prompt_required
    check (greatest(char_length(trim(prompt_fr)), char_length(trim(prompt_en))) >= 3)
);
create index academy_questions_session_idx on public.academy_questions (session_id, position);

-- Copies rendues (note calculée par la base).
create table public.academy_evaluation_attempts (
  id             uuid primary key default gen_random_uuid(),
  session_id     uuid not null references public.academy_evaluations (session_id) on delete restrict,
  enrollment_id  uuid not null references public.academy_enrollments (id) on delete restrict,
  student_id     uuid not null references public.profiles (id) on delete restrict,
  attempt_no     smallint not null,
  answers        jsonb not null,
  score          int not null,
  max_score      int not null,
  percent        numeric(5, 2) not null,
  passed         boolean not null,
  submitted_at   timestamptz not null default now(),
  unique (enrollment_id, attempt_no)
);
create index academy_attempts_session_idx on public.academy_evaluation_attempts (session_id, submitted_at desc);

create trigger academy_evaluations_touch before update on public.academy_evaluations
  for each row execute function public.touch_updated_at();

-- Création / modification de l'évaluation d'une session (admin). Le seuil de
-- réussite ne change plus une fois une copie rendue.
create or replace function public.academy_save_evaluation(
  p_session uuid, p_title_fr text, p_title_en text, p_instructions_fr text, p_instructions_en text,
  p_source_locale text, p_pass_mark int, p_max_attempts int
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  ev public.academy_evaluations;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if not exists (select 1 from public.academy_sessions where id = p_session) then
    raise exception 'not_found';
  end if;
  select * into ev from public.academy_evaluations where session_id = p_session for update;
  if found and ev.pass_mark <> p_pass_mark
     and exists (select 1 from public.academy_evaluation_attempts a where a.session_id = p_session) then
    raise exception 'evaluation_locked';
  end if;
  insert into public.academy_evaluations as t
    (session_id, title_fr, title_en, instructions_fr, instructions_en, source_locale, pass_mark, max_attempts)
  values
    (p_session, coalesce(p_title_fr, ''), coalesce(p_title_en, ''), coalesce(p_instructions_fr, ''),
     coalesce(p_instructions_en, ''), coalesce(p_source_locale, 'fr'), p_pass_mark, p_max_attempts)
  on conflict (session_id) do update
    set title_fr = excluded.title_fr, title_en = excluded.title_en,
        instructions_fr = excluded.instructions_fr, instructions_en = excluded.instructions_en,
        source_locale = excluded.source_locale, pass_mark = excluded.pass_mark,
        max_attempts = excluded.max_attempts;
  perform public.write_audit('academy.evaluation.save', 'academy_evaluations', p_session::text,
    jsonb_build_object('pass_mark', p_pass_mark, 'max_attempts', p_max_attempts));
end;
$$;

-- Ajout (p_id null) ou modification d'une question (admin). Refusé dès
-- qu'une copie a été rendue. 2 à 8 propositions ; une seule bonne réponse
-- pour une question à choix unique, au moins une sinon.
create or replace function public.academy_save_question(
  p_session uuid, p_id uuid, p_prompt_fr text, p_prompt_en text, p_source_locale text,
  p_multiple boolean, p_points int, p_choices jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_choices jsonb;
  v_count   int;
  v_correct int;
  v_blank   int;
  v_id      uuid;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  perform 1 from public.academy_evaluations where session_id = p_session for update;
  if not found then
    raise exception 'not_found';
  end if;
  if exists (select 1 from public.academy_evaluation_attempts a where a.session_id = p_session) then
    raise exception 'evaluation_locked';
  end if;
  if p_choices is null or jsonb_typeof(p_choices) <> 'array' then
    raise exception 'question_invalid';
  end if;

  -- Propositions normalisées : libellés nettoyés, « correct » booléen.
  select coalesce(jsonb_agg(jsonb_build_object(
           'label_fr', left(trim(coalesce(c.val ->> 'label_fr', '')), 300),
           'label_en', left(trim(coalesce(c.val ->> 'label_en', '')), 300),
           'correct', coalesce(c.val ->> 'correct', 'false') = 'true') order by c.ord), '[]'::jsonb)
    into v_choices
    from jsonb_array_elements(p_choices) with ordinality c(val, ord);
  v_count := jsonb_array_length(v_choices);
  select count(*) filter (where (c ->> 'correct')::boolean),
         count(*) filter (where (c ->> 'label_fr') = '' and (c ->> 'label_en') = '')
    into v_correct, v_blank
    from jsonb_array_elements(v_choices) c;
  if v_count < 2 or v_count > 8 or v_blank > 0 or v_correct < 1
     or (not coalesce(p_multiple, false) and v_correct <> 1) then
    raise exception 'question_invalid';
  end if;

  if p_id is null then
    insert into public.academy_questions
      (session_id, position, prompt_fr, prompt_en, source_locale, multiple, points, choices)
    values
      (p_session,
       coalesce((select max(position) from public.academy_questions where session_id = p_session), 0) + 1,
       coalesce(p_prompt_fr, ''), coalesce(p_prompt_en, ''), coalesce(p_source_locale, 'fr'),
       coalesce(p_multiple, false), coalesce(p_points, 1), v_choices)
    returning id into v_id;
  else
    update public.academy_questions
       set prompt_fr = coalesce(p_prompt_fr, ''), prompt_en = coalesce(p_prompt_en, ''),
           source_locale = coalesce(p_source_locale, 'fr'), multiple = coalesce(p_multiple, false),
           points = coalesce(p_points, 1), choices = v_choices
     where id = p_id and session_id = p_session
    returning id into v_id;
    if v_id is null then
      raise exception 'not_found';
    end if;
  end if;
  perform public.write_audit('academy.question.save', 'academy_questions', v_id::text,
    jsonb_build_object('session_id', p_session));
  return v_id;
end;
$$;

-- Suppression d'une question (admin), refusée dès qu'une copie a été rendue.
create or replace function public.academy_delete_question(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session uuid;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select session_id into v_session from public.academy_questions where id = p_id;
  if not found then
    raise exception 'not_found';
  end if;
  perform 1 from public.academy_evaluations where session_id = v_session for update;
  if exists (select 1 from public.academy_evaluation_attempts a where a.session_id = v_session) then
    raise exception 'evaluation_locked';
  end if;
  delete from public.academy_questions where id = p_id;
  -- Renumérote les questions restantes (1, 2, 3…).
  update public.academy_questions q
     set position = r.n
    from (select id, row_number() over (order by position) as n
            from public.academy_questions where session_id = v_session) r
   where q.id = r.id and q.position <> r.n;
  perform public.write_audit('academy.question.delete', 'academy_questions', p_id::text,
    jsonb_build_object('session_id', v_session));
end;
$$;

-- Ouverture / fermeture de l'évaluation (admin). Ouvrir exige au moins une question.
create or replace function public.academy_set_evaluation_status(p_session uuid, p_status public.academy_evaluation_status)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  perform 1 from public.academy_evaluations where session_id = p_session for update;
  if not found then
    raise exception 'not_found';
  end if;
  if p_status = 'open'
     and not exists (select 1 from public.academy_questions where session_id = p_session) then
    raise exception 'evaluation_empty';
  end if;
  if p_status = 'draft'
     and exists (select 1 from public.academy_evaluation_attempts a where a.session_id = p_session) then
    raise exception 'evaluation_locked';
  end if;
  update public.academy_evaluations set status = p_status where session_id = p_session;
  perform public.write_audit('academy.evaluation.status', 'academy_evaluations', p_session::text,
    jsonb_build_object('status', p_status));
end;
$$;

-- Questionnaire à remplir, SANS les bonnes réponses. Réservé aux inscrits
-- actifs non bloqués (et à l'admin, pour l'aperçu), évaluation ouverte.
create or replace function public.academy_evaluation_paper(p_session uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  ev public.academy_evaluations;
begin
  if auth.uid() is null or not public.academy_can_access_session(p_session) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into ev from public.academy_evaluations where session_id = p_session;
  if not found or (ev.status <> 'open' and not public.is_admin()) then
    raise exception 'evaluation_closed';
  end if;
  return jsonb_build_object(
    'questions', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', q.id,
               'position', q.position,
               'prompt_fr', q.prompt_fr,
               'prompt_en', q.prompt_en,
               'multiple', q.multiple,
               'points', q.points,
               'choices', (select jsonb_agg(jsonb_build_object('label_fr', c.val ->> 'label_fr',
                                                               'label_en', c.val ->> 'label_en') order by c.ord)
                             from jsonb_array_elements(q.choices) with ordinality c(val, ord)))
             order by q.position)
        from public.academy_questions q where q.session_id = p_session), '[]'::jsonb));
end;
$$;

-- =============================================================================
-- 5. Attestations
-- =============================================================================
create sequence public.academy_certificate_seq as integer start 1;

create table public.academy_certificates (
  id                 uuid primary key default gen_random_uuid(),
  number             text not null unique,
  enrollment_id      uuid not null unique references public.academy_enrollments (id) on delete restrict,
  student_id         uuid not null references public.profiles (id) on delete restrict,
  session_id         uuid not null references public.academy_sessions (id) on delete restrict,
  -- Copie figée au moment de la délivrance (l'attestation ne change plus).
  student_name       text not null,
  course_title_fr    text not null,
  course_title_en    text not null,
  session_label_fr   text not null,
  session_label_en   text not null,
  session_starts_on  date not null,
  session_ends_on    date not null,
  score_percent      numeric(5, 2) not null,
  issued_at          timestamptz not null default now(),
  revoked_at         timestamptz,
  revoke_reason      text check (char_length(revoke_reason) <= 500)
);
create index academy_certificates_student_idx on public.academy_certificates (student_id, issued_at desc);

-- Délivre l'attestation si l'étudiant a réussi l'évaluation ET tout payé.
-- Idempotent ; appelée automatiquement après une copie rendue et après
-- chaque paiement confirmé. Renvoie l'id de l'attestation, ou null.
create or replace function public.academy_issue_certificate_if_eligible(p_enrollment uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  e        public.academy_enrollments;
  s        public.academy_sessions;
  c        public.academy_courses;
  p        public.profiles;
  v_best   numeric;
  v_price  bigint;
  v_paid   bigint;
  v_id     uuid;
  v_number text;
begin
  select id into v_id from public.academy_certificates where enrollment_id = p_enrollment;
  if found then
    return v_id;
  end if;
  select * into e from public.academy_enrollments where id = p_enrollment;
  if not found or e.status <> 'active' then
    return null;
  end if;
  select max(a.percent) into v_best from public.academy_evaluation_attempts a
   where a.enrollment_id = p_enrollment and a.passed;
  if v_best is null then
    return null;
  end if;
  select coalesce(sum(amount), 0) into v_price from public.academy_installments where session_id = e.session_id;
  select coalesce(sum(amount), 0) into v_paid from public.academy_payments
   where enrollment_id = p_enrollment and status = 'confirmed';
  if v_price <= 0 or v_paid < v_price then
    return null;
  end if;

  select * into s from public.academy_sessions where id = e.session_id;
  select * into c from public.academy_courses where id = s.course_id;
  select * into p from public.profiles where id = e.student_id;
  -- Numéro : CSC-<année>-<n° d'ordre>-<4 caractères aléatoires> (non devinable).
  v_number := 'CSC-' || to_char(public.academy_today(), 'YYYY') || '-'
              || lpad(nextval('public.academy_certificate_seq')::text, 5, '0') || '-'
              || upper(substr(md5(gen_random_uuid()::text), 1, 4));

  insert into public.academy_certificates
    (number, enrollment_id, student_id, session_id, student_name, course_title_fr, course_title_en,
     session_label_fr, session_label_en, session_starts_on, session_ends_on, score_percent)
  values
    (v_number, p_enrollment, e.student_id, e.session_id, trim(p.first_name || ' ' || p.last_name),
     c.title_fr, c.title_en, s.label_fr, s.label_en, s.starts_on, s.ends_on, v_best)
  on conflict (enrollment_id) do nothing
  returning id into v_id;
  if v_id is null then
    select id into v_id from public.academy_certificates where enrollment_id = p_enrollment;
  else
    perform public.write_audit('academy.certificate.issue', 'academy_certificates', v_id::text,
      jsonb_build_object('enrollment_id', p_enrollment, 'number', v_number));
  end if;
  return v_id;
end;
$$;

-- Copie rendue par l'étudiant : correction par la base, tentatives limitées.
-- Une question rapporte ses points si les propositions cochées sont
-- exactement les bonnes. Réponses : {"<id question>": [indices cochés]}.
create or replace function public.academy_submit_evaluation(p_session uuid, p_answers jsonb)
returns table (attempt_no int, score int, max_score int, percent numeric, passed boolean, certificate_id uuid)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_variable
declare
  v_uid     uuid := auth.uid();
  e         public.academy_enrollments;
  ev        public.academy_evaluations;
  q         public.academy_questions;
  v_used    int;
  v_score   int := 0;
  v_max     int := 0;
  v_percent numeric(5, 2);
  v_passed  boolean;
  v_sel     int[];
  v_ok      int[];
  v_raw     jsonb;
  v_cert    uuid;
begin
  if v_uid is null then
    raise exception 'unauthorized' using errcode = '42501';
  end if;
  if p_answers is null or jsonb_typeof(p_answers) <> 'object' or pg_column_size(p_answers) > 65536 then
    raise exception 'answers_invalid';
  end if;
  select * into e from public.academy_enrollments en
   where en.session_id = p_session and en.student_id = v_uid and en.status = 'active'
   for update;
  if not found then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if public.academy_blocked_since(e.id) is not null then
    raise exception 'access_blocked';
  end if;
  select * into ev from public.academy_evaluations x where x.session_id = p_session;
  if not found or ev.status <> 'open' then
    raise exception 'evaluation_closed';
  end if;
  if exists (select 1 from public.academy_evaluation_attempts a where a.enrollment_id = e.id and a.passed) then
    raise exception 'evaluation_already_passed';
  end if;
  select count(*) into v_used from public.academy_evaluation_attempts a where a.enrollment_id = e.id;
  if v_used >= ev.max_attempts then
    raise exception 'attempts_exhausted';
  end if;

  for q in select * from public.academy_questions qq where qq.session_id = p_session order by qq.position loop
    v_max := v_max + q.points;
    v_raw := p_answers -> q.id::text;
    select coalesce(array_agg(distinct x.v::int order by x.v::int), '{}')
      into v_sel
      from jsonb_array_elements_text(case when jsonb_typeof(v_raw) = 'array' then v_raw else '[]'::jsonb end) x(v)
     where x.v ~ '^[0-9]{1,2}$';
    select coalesce(array_agg((c.ord - 1)::int order by c.ord), '{}')
      into v_ok
      from jsonb_array_elements(q.choices) with ordinality c(val, ord)
     where (c.val ->> 'correct')::boolean;
    if v_sel = v_ok then
      v_score := v_score + q.points;
    end if;
  end loop;
  if v_max = 0 then
    raise exception 'evaluation_empty';
  end if;

  v_percent := round(v_score * 100.0 / v_max, 2);
  v_passed := v_percent >= ev.pass_mark;
  insert into public.academy_evaluation_attempts
    (session_id, enrollment_id, student_id, attempt_no, answers, score, max_score, percent, passed)
  values
    (p_session, e.id, v_uid, v_used + 1, p_answers, v_score, v_max, v_percent, v_passed);
  perform public.write_audit('academy.evaluation.submit', 'academy_enrollments', e.id::text,
    jsonb_build_object('attempt_no', v_used + 1, 'percent', v_percent, 'passed', v_passed));

  if v_passed then
    v_cert := public.academy_issue_certificate_if_eligible(e.id);
  end if;
  return query select v_used + 1, v_score, v_max, v_percent::numeric, v_passed, v_cert;
end;
$$;

-- Un paiement confirmé active l'inscription, fige la session et, si
-- l'évaluation est déjà réussie et que tout est payé, délivre l'attestation.
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
  perform public.academy_issue_certificate_if_eligible(p_enrollment);
end;
$$;

-- Retrait d'une attestation (admin, motif obligatoire). La page de
-- vérification indique alors « attestation retirée ».
create or replace function public.academy_revoke_certificate(p_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if coalesce(trim(p_reason), '') = '' then
    raise exception 'reason_required';
  end if;
  update public.academy_certificates
     set revoked_at = now(), revoke_reason = left(trim(p_reason), 500)
   where id = p_id and revoked_at is null;
  if not found then
    raise exception 'not_found';
  end if;
  perform public.write_audit('academy.certificate.revoke', 'academy_certificates', p_id::text,
    jsonb_build_object('reason', p_reason));
end;
$$;

-- Vérification publique d'une attestation par son numéro (sans compte).
-- N'expose que ce qui figure sur l'attestation elle-même.
create or replace function public.academy_verify_certificate(p_number text)
returns table (
  number             text,
  student_name       text,
  course_title_fr    text,
  course_title_en    text,
  session_label_fr   text,
  session_label_en   text,
  session_starts_on  date,
  session_ends_on    date,
  issued_at          timestamptz,
  revoked            boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select c.number, c.student_name, c.course_title_fr, c.course_title_en, c.session_label_fr,
         c.session_label_en, c.session_starts_on, c.session_ends_on, c.issued_at, c.revoked_at is not null
    from public.academy_certificates c
   where c.number = upper(trim(coalesce(p_number, '')))
     and char_length(trim(coalesce(p_number, ''))) <= 40;
$$;

-- =============================================================================
-- Privilèges & RLS
-- =============================================================================
alter table public.academy_reminders            enable row level security;
alter table public.academy_commission_payouts   enable row level security;
alter table public.academy_evaluations          enable row level security;
alter table public.academy_questions            enable row level security;
alter table public.academy_evaluation_attempts  enable row level security;
alter table public.academy_certificates         enable row level security;

revoke all on public.academy_reminders, public.academy_commission_payouts, public.academy_evaluations,
              public.academy_questions, public.academy_evaluation_attempts, public.academy_certificates,
              public.academy_commissions
  from anon, authenticated;
revoke all on sequence public.academy_certificate_seq from anon, authenticated;

-- Rappels : aucun accès hors serveur (pas de politique = aucune ligne).

-- Commissions : l'ambassadeur ses paiements, l'admin tout ; écriture via fonctions.
grant select on public.academy_commission_payouts, public.academy_commissions to authenticated;
create policy academy_commission_payouts_select on public.academy_commission_payouts
  for select to authenticated using (ambassador_id = auth.uid() or public.is_admin());

-- Évaluation : visible (hors brouillon) des inscrits de la session ; l'admin tout.
grant select on public.academy_evaluations to authenticated;
create policy academy_evaluations_select on public.academy_evaluations
  for select to authenticated
  using (public.is_admin() or (status <> 'draft' and public.academy_enrolled_in_session(session_id)));

-- Questions (avec les bonnes réponses) : administrateur uniquement.
grant select on public.academy_questions to authenticated;
create policy academy_questions_select on public.academy_questions
  for select to authenticated using (public.is_admin());

-- Copies et attestations : chacun les siennes, l'admin tout.
grant select on public.academy_evaluation_attempts, public.academy_certificates to authenticated;
create policy academy_attempts_select on public.academy_evaluation_attempts
  for select to authenticated using (student_id = auth.uid() or public.is_admin());
create policy academy_certificates_select on public.academy_certificates
  for select to authenticated using (student_id = auth.uid() or public.is_admin());

-- Fonctions
revoke execute on function
  public.academy_blocked_since(uuid),
  public.academy_claim_reminders(int),
  public.academy_record_commission_payout(uuid, bigint, text, text),
  public.academy_confirm_commission_payout(uuid),
  public.academy_save_evaluation(uuid, text, text, text, text, text, int, int),
  public.academy_save_question(uuid, uuid, text, text, text, boolean, int, jsonb),
  public.academy_delete_question(uuid),
  public.academy_set_evaluation_status(uuid, public.academy_evaluation_status),
  public.academy_evaluation_paper(uuid),
  public.academy_issue_certificate_if_eligible(uuid),
  public.academy_submit_evaluation(uuid, jsonb),
  public.academy_revoke_certificate(uuid, text),
  public.academy_verify_certificate(text)
from public, anon, authenticated;

grant execute on function
  public.academy_record_commission_payout(uuid, bigint, text, text),
  public.academy_confirm_commission_payout(uuid),
  public.academy_save_evaluation(uuid, text, text, text, text, text, int, int),
  public.academy_save_question(uuid, uuid, text, text, text, boolean, int, jsonb),
  public.academy_delete_question(uuid),
  public.academy_set_evaluation_status(uuid, public.academy_evaluation_status),
  public.academy_evaluation_paper(uuid),
  public.academy_submit_evaluation(uuid, jsonb),
  public.academy_revoke_certificate(uuid, text)
to authenticated;

-- Vérification d'attestation : publique.
grant execute on function public.academy_verify_certificate(text) to anon, authenticated;

-- Serveur uniquement (clé secrète) : tâche planifiée des rappels.
grant execute on function public.academy_claim_reminders(int) to service_role;
