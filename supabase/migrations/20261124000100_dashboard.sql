-- =============================================================================
-- Tableau de bord — lot D1 : indicateurs par module, vue globale, objectifs
-- =============================================================================
-- ⚠ Migration livrée NON EXÉCUTÉE : à relire puis appliquer manuellement dans
--   Supabase (SQL Editor). Elle ne modifie AUCUNE table existante : elle ajoute
--   des fonctions de calcul, quelques index et la table des objectifs.
--   Retour arrière : supabase/rollbacks/20261124000100_dashboard.down.sql
--
-- Principes :
--   * tous les calculs sont faits PAR LA BASE (sommes, comptages) : la page ne
--     reçoit que des totaux, jamais les lignes détaillées ;
--   * fonctions réservées aux administrateurs (vérification dans la fonction) ;
--   * montants en FCFA entiers (bigint), jamais de calcul à virgule ; les taux
--     sont renvoyés sous forme « numérateur / dénominateur » et calculés à
--     l'affichage ;
--   * périodes en dates du Cameroun (Africa/Douala), bornes incluses ;
--   * « encaissé » = paiements confirmés, à leur date de paiement ; un
--     remboursement est déduit à sa propre date.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Index utiles aux calculs par période (aucun effet sur les règles métier)
-- -----------------------------------------------------------------------------
create index if not exists profiles_created_idx on public.profiles (created_at);
create index if not exists academy_payments_paid_on_idx on public.academy_payments (paid_on) where status = 'confirmed';
create index if not exists academy_enrollments_created_idx on public.academy_enrollments (created_at);
create index if not exists consulting_payments_paid_on_idx on public.consulting_payments (paid_on);
create index if not exists consulting_bookings_created_idx on public.consulting_bookings (created_at);
create index if not exists submissions_created_idx on public.submissions (created_at);
create index if not exists contact_requests_created_idx on public.contact_requests (created_at);

-- -----------------------------------------------------------------------------
-- Objectifs mensuels fixés par l'administrateur
-- -----------------------------------------------------------------------------
create table public.dashboard_goals (
  month       date not null check (extract(day from month) = 1),
  metric      text not null check (metric in (
                'revenue_total', 'revenue_academy', 'revenue_consulting',
                'new_users', 'academy_enrollments', 'consulting_done')),
  target      bigint not null check (target > 0 and target <= 100000000000),
  updated_by  uuid references public.profiles (id) on delete set null default auth.uid(),
  updated_at  timestamptz not null default now(),
  primary key (month, metric)
);

comment on table public.dashboard_goals is
  'Objectifs du mois (FCFA pour les encaissements, nombre pour le reste). Écriture par dashboard_set_goal uniquement.';

-- -----------------------------------------------------------------------------
-- Contrôle commun : administrateur + période valide (au plus 800 jours)
-- -----------------------------------------------------------------------------
create or replace function public.dashboard_check(p_from date, p_to date)
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden';
  end if;
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 800 then
    raise exception 'dashboard_invalid_period';
  end if;
end;
$$;

-- Début (inclus) et fin (exclue) d'une période de dates locales.
create or replace function public.dashboard_start(p_day date)
returns timestamptz language sql immutable
as $$ select (p_day::timestamp at time zone 'Africa/Douala') $$;

-- =============================================================================
-- Vue globale (tous modules)
-- =============================================================================
create or replace function public.dashboard_global(p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  s timestamptz := public.dashboard_start(p_from);
  e timestamptz := public.dashboard_start(p_to + 1);
begin
  perform public.dashboard_check(p_from, p_to);
  return jsonb_build_object(
    -- Argent (période)
    'academy_cash', (select coalesce(sum(amount), 0) from public.academy_payments
                      where status = 'confirmed' and paid_on between p_from and p_to),
    'consulting_cash', (select coalesce(sum(amount), 0) from public.consulting_payments
                         where status in ('confirmed', 'refunded') and paid_on between p_from and p_to),
    'consulting_refunds', (select coalesce(sum(amount), 0) from public.consulting_payments
                            where status = 'refunded' and refunded_at >= s and refunded_at < e),
    'commissions_paid', (select coalesce(sum(amount), 0) from public.academy_commission_payouts
                          where paid_at >= s and paid_at < e)
                        + (select coalesce(sum(amount), 0) from public.payouts where paid_at >= s and paid_at < e),
    -- Argent (aujourd'hui)
    'receivable_academy', (select coalesce(sum(remaining), 0) from public.academy_enrollment_balances
                            where status <> 'cancelled'),
    'receivable_consulting', (select coalesce(sum(price), 0) from public.consulting_bookings
                               where status = 'pending_payment' and hold_expires_at > now()),
    'commissions_due', (select coalesce(sum(due), 0) from public.academy_commissions)
                       + (select coalesce(sum(due), 0) from public.ambassador_program_totals),
    -- Clients
    'new_users', (select count(*) from public.profiles where created_at >= s and created_at < e),
    'paying_clients', (select count(*) from (
                         select e2.student_id as uid
                           from public.academy_payments p
                           join public.academy_enrollments e2 on e2.id = p.enrollment_id
                          where p.status = 'confirmed' and p.paid_on between p_from and p_to
                         union
                         select b.client_id
                           from public.consulting_payments p
                           join public.consulting_bookings b on b.id = p.booking_id
                          where p.status in ('confirmed', 'refunded') and p.paid_on between p_from and p_to
                       ) x),
    -- Comptes créés sur la période, puis ceux qui ont payé au moins une fois depuis.
    'cohort_users', (select count(*) from public.profiles where created_at >= s and created_at < e),
    'cohort_paying', (select count(*) from public.profiles pr
                       where pr.created_at >= s and pr.created_at < e
                         and (exists (select 1 from public.academy_payments p
                                        join public.academy_enrollments e2 on e2.id = p.enrollment_id
                                       where e2.student_id = pr.id and p.status = 'confirmed')
                              or exists (select 1 from public.consulting_payments p
                                           join public.consulting_bookings b on b.id = p.booking_id
                                          where b.client_id = pr.id and p.status in ('confirmed', 'refunded')))),
    -- Clients (depuis le début) : présents dans au moins un module, et dans les deux.
    'clients_total', (select count(*) from (
                        select student_id as uid from public.academy_enrollments where status = 'active'
                        union
                        select client_id from public.consulting_bookings where status = 'confirmed'
                      ) x),
    'clients_multi', (select count(*) from (
                        select student_id as uid from public.academy_enrollments where status = 'active'
                        intersect
                        select client_id from public.consulting_bookings where status = 'confirmed'
                      ) x),
    'referred_enrollments', (select count(*) from public.academy_enrollments
                              where created_at >= s and created_at < e and referral_ambassador_id is not null),
    'enrollments', (select count(*) from public.academy_enrollments where created_at >= s and created_at < e),
    -- Santé de la plateforme (aujourd'hui)
    'deliveries_failed', (select count(*) from public.notification_deliveries where status = 'failed'),
    'deliveries_stuck', (select count(*) from public.notification_deliveries
                          where status = 'pending' and created_at < now() - interval '1 hour'),
    'job_errors_24h', (select count(*) from public.job_runs
                        where status = 'error' and started_at > now() - interval '24 hours'),
    'job_last_ok', (select coalesce(jsonb_object_agg(job, last_ok), '{}'::jsonb) from (
                      select job, max(finished_at) as last_ok from public.job_runs
                       where status = 'ok' group by job) j),
    'contact_new', (select count(*) from public.contact_requests where status = 'new'),
    -- À traiter (aujourd'hui)
    'academy_pending', (select count(*) from public.academy_enrollments
                         where status = 'pending' and hold_expires_at > now()),
    'academy_overdue', (select count(*) from public.academy_enrollment_balances
                         where status = 'active' and overdue_count > 0),
    'consulting_unpaid', (select count(*) from public.consulting_bookings
                           where status = 'pending_payment' and hold_expires_at > now()),
    'submissions_pending', (select count(*) from public.submissions where status = 'pending')
  );
end;
$$;

-- =============================================================================
-- CSC Academy
-- =============================================================================
create or replace function public.dashboard_academy(p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  s timestamptz := public.dashboard_start(p_from);
  e timestamptz := public.dashboard_start(p_to + 1);
begin
  perform public.dashboard_check(p_from, p_to);
  return jsonb_build_object(
    -- Inscriptions (période)
    'enrollments_new', (select count(*) from public.academy_enrollments where created_at >= s and created_at < e),
    'enrollments_activated', (select count(*) from public.academy_enrollments where activated_at >= s and activated_at < e),
    'enrollments_cancelled', (select count(*) from public.academy_enrollments where cancelled_at >= s and cancelled_at < e),
    'cohort_created', (select count(*) from public.academy_enrollments where created_at >= s and created_at < e),
    'cohort_activated', (select count(*) from public.academy_enrollments
                          where created_at >= s and created_at < e and activated_at is not null),
    -- Inscriptions (aujourd'hui)
    'active_now', (select count(*) from public.academy_enrollments where status = 'active'),
    'pending_now', (select count(*) from public.academy_enrollments where status = 'pending' and hold_expires_at > now()),
    -- Remplissage des sessions qui se déroulent (au moins en partie) sur la période
    'seats', (select coalesce(sum(o.seats), 0) from public.academy_session_overview o
                join public.academy_sessions ss on ss.id = o.session_id
               where ss.starts_on <= p_to and ss.ends_on >= p_from),
    'seats_taken', (select coalesce(sum(o.taken), 0) from public.academy_session_overview o
                      join public.academy_sessions ss on ss.id = o.session_id
                     where ss.starts_on <= p_to and ss.ends_on >= p_from),
    -- Paiements
    'cash', (select coalesce(sum(amount), 0) from public.academy_payments
              where status = 'confirmed' and paid_on between p_from and p_to),
    'payments_count', (select count(*) from public.academy_payments
                        where status = 'confirmed' and paid_on between p_from and p_to),
    'remaining_now', (select coalesce(sum(remaining), 0) from public.academy_enrollment_balances where status <> 'cancelled'),
    'due_to_date', (select coalesce(sum(amount), 0) from public.academy_installment_states st
                     join public.academy_enrollments e2 on e2.id = st.enrollment_id
                    where e2.status = 'active' and st.due_on <= public.academy_today()),
    'paid_to_date', (select coalesce(sum(paid_amount), 0) from public.academy_installment_states st
                      join public.academy_enrollments e2 on e2.id = st.enrollment_id
                     where e2.status = 'active' and st.due_on <= public.academy_today()),
    'overdue_enrollments', (select count(*) from public.academy_enrollment_balances
                             where status = 'active' and overdue_count > 0),
    'overdue_amount', (select coalesce(sum(st.amount - st.paid_amount), 0) from public.academy_installment_states st
                        join public.academy_enrollments e2 on e2.id = st.enrollment_id
                       where e2.status = 'active' and st.overdue),
    'blocked_now', (select count(*) from public.academy_enrollment_balances where blocked_since is not null),
    'commissions_paid', (select coalesce(sum(amount), 0) from public.academy_commission_payouts
                          where paid_at >= s and paid_at < e),
    'commissions_due', (select coalesce(sum(due), 0) from public.academy_commissions),
    -- Pédagogie (période)
    'meetings_held', (select count(*) from public.academy_meetings
                       where starts_at >= s and starts_at < e and starts_at < now()),
    'attendance_present', (select count(*) from public.academy_meetings m
                             join public.academy_meeting_attendance a on a.meeting_id = m.id
                             join public.academy_enrollments e2 on e2.session_id = m.session_id
                                  and e2.student_id = a.user_id and e2.status = 'active'
                            where m.starts_at >= s and m.starts_at < e and m.starts_at < now()),
    'attendance_expected', (select count(*) from public.academy_meetings m
                              join public.academy_enrollments e2 on e2.session_id = m.session_id and e2.status = 'active'
                             where m.starts_at >= s and m.starts_at < e and m.starts_at < now()),
    'attempts', (select count(*) from public.academy_evaluation_attempts where submitted_at >= s and submitted_at < e),
    'attempts_passed', (select count(*) from public.academy_evaluation_attempts
                         where submitted_at >= s and submitted_at < e and passed),
    'avg_percent', (select round(avg(percent), 1) from public.academy_evaluation_attempts
                     where submitted_at >= s and submitted_at < e),
    'certificates', (select count(*) from public.academy_certificates
                      where issued_at >= s and issued_at < e and revoked_at is null),
    'replay_views', (select count(*) from public.academy_replay_views where started_at >= s and started_at < e),
    -- Classement des formations (période)
    'top_courses', (select coalesce(jsonb_agg(t order by t.cash desc, t.enrollments desc), '[]'::jsonb) from (
                    select * from (
                      select c.id, c.title_fr, c.title_en,
                             (select count(*) from public.academy_enrollments e2
                                join public.academy_sessions ss on ss.id = e2.session_id
                               where ss.course_id = c.id and e2.created_at >= s and e2.created_at < e) as enrollments,
                             (select coalesce(sum(p.amount), 0) from public.academy_payments p
                                join public.academy_enrollments e2 on e2.id = p.enrollment_id
                                join public.academy_sessions ss on ss.id = e2.session_id
                               where ss.course_id = c.id and p.status = 'confirmed'
                                 and p.paid_on between p_from and p_to) as cash
                        from public.academy_courses c
                    ) t0 where t0.enrollments > 0 or t0.cash > 0 order by t0.cash desc, t0.enrollments desc limit 5) t)
  );
end;
$$;

-- =============================================================================
-- CSC Consulting
-- =============================================================================
create or replace function public.dashboard_consulting(p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  s timestamptz := public.dashboard_start(p_from);
  e timestamptz := public.dashboard_start(p_to + 1);
  v_open numeric;
  v_off  numeric;
begin
  perform public.dashboard_check(p_from, p_to);

  -- Heures ouvertes des conseillers actifs sur la période (créneaux habituels,
  -- moins les indisponibilités qui les recouvrent), en minutes.
  with days as (
    select d::date as day from generate_series(p_from::timestamp, p_to::timestamp, interval '1 day') d
  ),
  win as (
    select a.advisor_id,
           tstzrange((dd.day + a.start_time) at time zone 'Africa/Douala',
                     (dd.day + a.end_time) at time zone 'Africa/Douala', '[)') as r
      from days dd
      join public.consulting_availability a on a.weekday = extract(isodow from dd.day)
      join public.consulting_advisors ad on ad.user_id = a.advisor_id and ad.active
  )
  select coalesce(sum(extract(epoch from upper(w.r) - lower(w.r))), 0) / 60,
         coalesce((select sum(extract(epoch from upper(w2.r * u.period) - lower(w2.r * u.period)))
                     from win w2
                     join public.consulting_unavailabilities u on u.advisor_id = w2.advisor_id and u.period && w2.r), 0) / 60
    into v_open, v_off
    from win w;

  return jsonb_build_object(
    -- Rendez-vous (période)
    'bookings_new', (select count(*) from public.consulting_bookings where created_at >= s and created_at < e),
    'bookings_new_paid', (select count(*) from public.consulting_bookings where created_at >= s and created_at < e and price > 0),
    'confirmed', (select count(*) from public.consulting_bookings where confirmed_at >= s and confirmed_at < e),
    'done', (select count(*) from public.consulting_bookings
              where status = 'confirmed' and ends_at >= s and ends_at < least(e, now())),
    'cancelled', (select count(*) from public.consulting_bookings where cancelled_at >= s and cancelled_at < e),
    'expired', (select count(*) from public.consulting_bookings
                 where status = 'expired' and hold_expires_at >= s and hold_expires_at < e),
    -- Devenir des rendez-vous pris sur la période (rendez-vous payants)
    'cohort_paid', (select count(*) from public.consulting_bookings
                     where created_at >= s and created_at < e and price > 0),
    'cohort_paid_confirmed', (select count(*) from public.consulting_bookings
                               where created_at >= s and created_at < e and price > 0 and confirmed_at is not null),
    'cohort_all', (select count(*) from public.consulting_bookings where created_at >= s and created_at < e),
    'cohort_cancelled', (select count(*) from public.consulting_bookings
                          where created_at >= s and created_at < e and cancelled_at is not null),
    'lead_hours', (select round(avg(extract(epoch from starts_at - created_at) / 3600), 1)
                     from public.consulting_bookings
                    where created_at >= s and created_at < e and confirmed_at is not null),
    -- Argent
    'cash', (select coalesce(sum(amount), 0) from public.consulting_payments
              where status in ('confirmed', 'refunded') and paid_on between p_from and p_to),
    'payments_count', (select count(*) from public.consulting_payments
                        where status in ('confirmed', 'refunded') and paid_on between p_from and p_to),
    'refunds', (select coalesce(sum(amount), 0) from public.consulting_payments
                 where status = 'refunded' and refunded_at >= s and refunded_at < e),
    'refunds_count', (select count(*) from public.consulting_payments
                       where status = 'refunded' and refunded_at >= s and refunded_at < e),
    'unpaid_now', (select count(*) from public.consulting_bookings where status = 'pending_payment' and hold_expires_at > now()),
    'unpaid_amount_now', (select coalesce(sum(price), 0) from public.consulting_bookings
                           where status = 'pending_payment' and hold_expires_at > now()),
    -- Présence en visio (rendez-vous vidéo terminés sur la période)
    'video_done', (select count(*) from public.consulting_bookings
                    where status = 'confirmed' and mode = 'video' and ends_at >= s and ends_at < least(e, now())),
    'video_joined', (select count(*) from public.consulting_bookings
                      where status = 'confirmed' and mode = 'video' and ends_at >= s and ends_at < least(e, now())
                        and client_joined_at is not null),
    -- Conseillers
    'open_minutes', greatest(round(v_open - v_off), 0),
    'booked_minutes', (select coalesce(sum(duration_minutes), 0) from public.consulting_bookings
                        where status = 'confirmed' and starts_at >= s and starts_at < e),
    'reports_published', (select count(*) from public.consulting_bookings b
                            join public.consulting_reports r on r.booking_id = b.id and r.status = 'published'
                           where b.status = 'confirmed' and b.ends_at >= s and b.ends_at < least(e, now())),
    'report_hours', (select round(avg(greatest(extract(epoch from r.published_at - b.ends_at), 0) / 3600), 1)
                       from public.consulting_bookings b
                       join public.consulting_reports r on r.booking_id = b.id and r.status = 'published'
                      where b.status = 'confirmed' and b.ends_at >= s and b.ends_at < least(e, now())),
    'reports_late_now', (select count(*) from public.consulting_bookings b
                          where b.status = 'confirmed' and b.ends_at < now() - interval '48 hours'
                            and not exists (select 1 from public.consulting_reports r
                                             where r.booking_id = b.id and r.status = 'published')),
    -- Fidélité
    'clients_period', (select count(distinct client_id) from public.consulting_bookings
                        where status = 'confirmed' and starts_at >= s and starts_at < e),
    'clients_returning', (select count(distinct b.client_id) from public.consulting_bookings b
                           where b.status = 'confirmed' and b.starts_at >= s and b.starts_at < e
                             and exists (select 1 from public.consulting_bookings b2
                                          where b2.client_id = b.client_id and b2.status = 'confirmed'
                                            and b2.starts_at < b.starts_at)),
    -- Depuis le début : clients d'un premier échange gratuit, puis d'une offre payante.
    'free_clients', (select count(distinct client_id) from public.consulting_bookings
                      where status = 'confirmed' and price = 0),
    'free_to_paid', (select count(distinct f.client_id) from public.consulting_bookings f
                      where f.status = 'confirmed' and f.price = 0
                        and exists (select 1 from public.consulting_bookings p
                                     where p.client_id = f.client_id and p.status = 'confirmed'
                                       and p.price > 0 and p.created_at > f.created_at)),
    -- Classement des offres (période)
    'top_offers', (select coalesce(jsonb_agg(t order by t.bookings desc, t.cash desc), '[]'::jsonb) from (
                   select * from (
                     select o.id, o.title_fr, o.title_en,
                            (select count(*) from public.consulting_bookings b
                              where b.offer_id = o.id and b.created_at >= s and b.created_at < e
                                and b.status <> 'expired') as bookings,
                            (select coalesce(sum(p.amount), 0) from public.consulting_payments p
                               join public.consulting_bookings b on b.id = p.booking_id
                              where b.offer_id = o.id and p.status in ('confirmed', 'refunded')
                                and p.paid_on between p_from and p_to) as cash
                       from public.consulting_offers o
                   ) t0 where t0.bookings > 0 or t0.cash > 0 order by t0.bookings desc, t0.cash desc limit 5) t)
  );
end;
$$;

-- =============================================================================
-- Ambassador (programme de parrainage)
-- =============================================================================
create or replace function public.dashboard_ambassador(p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  s timestamptz := public.dashboard_start(p_from);
  e timestamptz := public.dashboard_start(p_to + 1);
begin
  perform public.dashboard_check(p_from, p_to);
  return jsonb_build_object(
    'active_now', (select count(*) from public.ambassadors where status = 'active'),
    'new', (select count(*) from public.ambassadors where created_at >= s and created_at < e),
    'campaigns_live', (select count(*) from public.campaigns where status = 'launched'),
    -- Soumissions
    'submissions_new', (select count(*) from public.submissions where created_at >= s and created_at < e),
    'pending_now', (select count(*) from public.submissions where status = 'pending'),
    'validated', (select count(*) from public.submissions
                   where status = 'validated' and reviewed_at >= s and reviewed_at < e),
    'rejected', (select count(*) from public.submissions
                  where status = 'rejected' and reviewed_at >= s and reviewed_at < e),
    'review_hours', (select round(avg(extract(epoch from reviewed_at - created_at) / 3600), 1)
                       from public.submissions where reviewed_at >= s and reviewed_at < e),
    'earned', (select coalesce(sum(amount), 0) from public.submissions
                where status = 'validated' and reviewed_at >= s and reviewed_at < e),
    'payouts_paid', (select coalesce(sum(amount), 0) from public.payouts where paid_at >= s and paid_at < e),
    'payouts_due', (select coalesce(sum(due), 0) from public.ambassador_program_totals),
    -- Parrainage Academy
    'referrals', (select count(*) from public.academy_enrollments
                   where created_at >= s and created_at < e and referral_ambassador_id is not null),
    'enrollments', (select count(*) from public.academy_enrollments where created_at >= s and created_at < e),
    'referral_cash', (select coalesce(sum(p.amount), 0) from public.academy_payments p
                        join public.academy_enrollments e2 on e2.id = p.enrollment_id
                       where e2.referral_ambassador_id is not null and p.status = 'confirmed'
                         and p.paid_on between p_from and p_to),
    'commissions_paid', (select coalesce(sum(amount), 0) from public.academy_commission_payouts
                          where paid_at >= s and paid_at < e),
    'commissions_due', (select coalesce(sum(due), 0) from public.academy_commissions),
    -- Classement des ambassadeurs (période)
    'top_ambassadors', (select coalesce(jsonb_agg(t order by t.validated + t.referrals desc, t.earned desc), '[]'::jsonb) from (
                        select * from (
                          select a.user_id, a.code, pr.first_name, pr.last_name,
                                 (select count(*) from public.submissions sb
                                   where sb.ambassador_id = a.user_id and sb.status = 'validated'
                                     and sb.reviewed_at >= s and sb.reviewed_at < e) as validated,
                                 (select coalesce(sum(sb.amount), 0) from public.submissions sb
                                   where sb.ambassador_id = a.user_id and sb.status = 'validated'
                                     and sb.reviewed_at >= s and sb.reviewed_at < e) as earned,
                                 (select count(*) from public.academy_enrollments e2
                                   where e2.referral_ambassador_id = a.user_id
                                     and e2.created_at >= s and e2.created_at < e) as referrals
                            from public.ambassadors a
                            join public.profiles pr on pr.id = a.user_id
                        ) t0 where t0.validated > 0 or t0.referrals > 0
                          order by t0.validated + t0.referrals desc, t0.earned desc limit 5) t)
  );
end;
$$;

-- =============================================================================
-- Contact
-- =============================================================================
create or replace function public.dashboard_contact(p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  s timestamptz := public.dashboard_start(p_from);
  e timestamptz := public.dashboard_start(p_to + 1);
begin
  perform public.dashboard_check(p_from, p_to);
  return jsonb_build_object(
    'received', (select count(*) from public.contact_requests where created_at >= s and created_at < e),
    'by_subject', (select coalesce(jsonb_object_agg(subject, n), '{}'::jsonb) from (
                     select subject, count(*) as n from public.contact_requests
                      where created_at >= s and created_at < e group by subject) x),
    'new_now', (select count(*) from public.contact_requests where status = 'new'),
    'in_progress_now', (select count(*) from public.contact_requests where status = 'in_progress'),
    'handled', (select count(*) from public.contact_requests
                 where status = 'done' and handled_at >= s and handled_at < e),
    'response_hours', (select round(avg(extract(epoch from handled_at - created_at) / 3600), 1)
                         from public.contact_requests
                        where status = 'done' and handled_at >= s and handled_at < e)
  );
end;
$$;

-- =============================================================================
-- Évolution mois par mois (graphiques et objectifs)
-- =============================================================================
create or replace function public.dashboard_monthly(p_months int default 12)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_first date := (date_trunc('month', public.academy_today()) - make_interval(months => greatest(least(p_months, 36), 1) - 1))::date;
begin
  if not public.is_admin() then
    raise exception 'forbidden';
  end if;
  return (
    select coalesce(jsonb_agg(row_to_json(m)::jsonb order by m.month), '[]'::jsonb) from (
      select to_char(mm, 'YYYY-MM-DD') as month,
             (select coalesce(sum(amount), 0) from public.academy_payments
               where status = 'confirmed' and paid_on >= mm and paid_on < me) as academy_cash,
             (select coalesce(sum(amount), 0) from public.consulting_payments
               where status in ('confirmed', 'refunded') and paid_on >= mm and paid_on < me) as consulting_cash,
             (select coalesce(sum(amount), 0) from public.consulting_payments
               where status = 'refunded' and refunded_at >= public.dashboard_start(mm)
                 and refunded_at < public.dashboard_start(me)) as consulting_refunds,
             (select count(*) from public.profiles
               where created_at >= public.dashboard_start(mm) and created_at < public.dashboard_start(me)) as new_users,
             (select count(*) from public.academy_enrollments
               where created_at >= public.dashboard_start(mm) and created_at < public.dashboard_start(me)) as academy_enrollments,
             (select count(*) from public.consulting_bookings
               where status = 'confirmed' and ends_at >= public.dashboard_start(mm)
                 and ends_at < least(public.dashboard_start(me), now())) as consulting_done,
             (select count(*) from public.submissions
               where status = 'validated' and reviewed_at >= public.dashboard_start(mm)
                 and reviewed_at < public.dashboard_start(me)) as submissions_validated,
             (select count(*) from public.contact_requests
               where created_at >= public.dashboard_start(mm) and created_at < public.dashboard_start(me)) as contact_requests
        from (select d::date as mm, (d + interval '1 month')::date as me
                from generate_series(v_first::timestamp, date_trunc('month', public.academy_today())::timestamp, interval '1 month') d) months
    ) m
  );
end;
$$;

-- =============================================================================
-- Objectifs : écriture (administrateur, journalisée)
-- =============================================================================
create or replace function public.dashboard_set_goal(p_month date, p_metric text, p_target bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_month date := date_trunc('month', p_month)::date;
begin
  if not public.is_admin() then
    raise exception 'forbidden';
  end if;
  if p_month is null or p_metric not in ('revenue_total', 'revenue_academy', 'revenue_consulting',
                                         'new_users', 'academy_enrollments', 'consulting_done') then
    raise exception 'dashboard_invalid_goal';
  end if;
  if p_target is null or p_target = 0 then
    delete from public.dashboard_goals where month = v_month and metric = p_metric;
  elsif p_target < 0 or p_target > 100000000000 then
    raise exception 'dashboard_invalid_goal';
  else
    insert into public.dashboard_goals (month, metric, target, updated_by, updated_at)
    values (v_month, p_metric, p_target, auth.uid(), now())
    on conflict (month, metric) do update
      set target = excluded.target, updated_by = excluded.updated_by, updated_at = excluded.updated_at;
  end if;
  perform public.write_audit('dashboard.goal.set', 'dashboard_goals', p_metric || ':' || v_month::text,
                             jsonb_build_object('month', v_month, 'metric', p_metric, 'target', nullif(p_target, 0)));
end;
$$;

-- =============================================================================
-- Droits
-- =============================================================================
alter table public.dashboard_goals enable row level security;
revoke all on public.dashboard_goals from anon, authenticated;
grant select on public.dashboard_goals to authenticated;
create policy dashboard_goals_admin_read on public.dashboard_goals
  for select to authenticated using (public.is_admin());

revoke execute on function
  public.dashboard_check(date, date),
  public.dashboard_global(date, date),
  public.dashboard_academy(date, date),
  public.dashboard_consulting(date, date),
  public.dashboard_ambassador(date, date),
  public.dashboard_contact(date, date),
  public.dashboard_monthly(int),
  public.dashboard_set_goal(date, text, bigint)
from public, anon, authenticated;

grant execute on function
  public.dashboard_global(date, date),
  public.dashboard_academy(date, date),
  public.dashboard_consulting(date, date),
  public.dashboard_ambassador(date, date),
  public.dashboard_contact(date, date),
  public.dashboard_monthly(int),
  public.dashboard_set_goal(date, text, bigint)
to authenticated;
