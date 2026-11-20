-- =============================================================================
-- CSC Consulting — rappel « juste avant » selon le mode du rendez-vous
-- =============================================================================
-- ⚠ Migration livrée NON EXÉCUTÉE : à appliquer dans Supabase (SQL Editor).
--   Retour arrière : supabase/rollbacks/20261125000100_consulting_reminder_lead.down.sql
--
-- Avant : rappel « la veille » + rappel « 1 h avant » pour tous les modes.
-- Après : rappel « la veille » (inchangé) + rappel « juste avant », envoyé au
--   client ET au conseiller :
--     * 15 minutes avant pour une visio ou un appel téléphonique ;
--     * 1 heure avant pour une rencontre en présentiel.
--
-- La tâche planifiée tourne toutes les 5 ou 15 minutes. Le rappel part au
-- premier passage où le début est à moins de « délai + 4 min » : avec des
-- créneaux à l'heure ou à la demi-heure, il part exactement 15 min (ou 1 h)
-- avant ; dans tous les cas, jamais plus de 4 min en avance (tâche toutes les
-- 5 min). Aucune donnée existante n'est modifiée.
-- =============================================================================

-- Nouveau type de rappel « soon » (l'ancien « hour_before » reste accepté pour l'historique).
alter table public.consulting_reminders drop constraint if exists consulting_reminders_kind_check;
alter table public.consulting_reminders
  add constraint consulting_reminders_kind_check check (kind in ('day_before', 'hour_before', 'soon'));

/** Délai du rappel « juste avant » selon le mode. */
create or replace function public.consulting_reminder_lead(p_mode public.consulting_mode)
returns interval language sql immutable
as $$ select case when p_mode = 'in_person' then interval '1 hour' else interval '15 minutes' end $$;

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
     cross join (values ('day_before'), ('soon')) as k(kind)
     where b.status = 'confirmed'
       and b.starts_at > now()
       and ((k.kind = 'day_before'
             and b.starts_at <= now() + interval '24 hours'
             and b.starts_at > now() + interval '2 hours'
             and b.confirmed_at <= b.starts_at - interval '23 hours')
         or (k.kind = 'soon'
             and b.starts_at <= now() + public.consulting_reminder_lead(b.mode) + interval '4 minutes'
             -- Rendez-vous déjà rappelé « 1 h avant » par l'ancienne règle : pas de doublon.
             and not exists (select 1 from public.consulting_reminders r0 where r0.booking_id = b.id and r0.kind = 'hour_before')))
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

revoke execute on function public.consulting_reminder_lead(public.consulting_mode) from public, anon, authenticated;
revoke execute on function public.consulting_claim_reminders(integer) from public, anon, authenticated;
-- Serveur uniquement (clé secrète) : tâche planifiée.
grant execute on function public.consulting_claim_reminders(integer) to service_role;
