-- =============================================================================
-- Retour arrière du lot D1 (tableau de bord)
-- =============================================================================
-- Supprime les fonctions de calcul, la table des objectifs et les index
-- ajoutés. Seuls les OBJECTIFS saisis sont perdus (aucune donnée métier).
-- Le journal d'audit est conservé.
-- =============================================================================
begin;

drop function if exists public.dashboard_set_goal(date, text, bigint);
drop function if exists public.dashboard_monthly(int);
drop function if exists public.dashboard_contact(date, date);
drop function if exists public.dashboard_ambassador(date, date);
drop function if exists public.dashboard_consulting(date, date);
drop function if exists public.dashboard_academy(date, date);
drop function if exists public.dashboard_global(date, date);
drop function if exists public.dashboard_start(date);
drop function if exists public.dashboard_check(date, date);

drop table if exists public.dashboard_goals;

drop index if exists public.profiles_created_idx;
drop index if exists public.academy_payments_paid_on_idx;
drop index if exists public.academy_enrollments_created_idx;
drop index if exists public.consulting_payments_paid_on_idx;
drop index if exists public.consulting_bookings_created_idx;
drop index if exists public.submissions_created_idx;
drop index if exists public.contact_requests_created_idx;

commit;
