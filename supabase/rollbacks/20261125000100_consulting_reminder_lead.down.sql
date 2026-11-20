-- =============================================================================
-- Retour arrière : rappel « 1 h avant » pour tous les modes (règle du lot C1)
-- =============================================================================
-- Les rappels « soon » déjà envoyés sont conservés dans l'historique sous le
-- nom « hour_before » (aucun nouvel envoi pour ces rendez-vous).
-- =============================================================================
begin;

update public.consulting_reminders r
   set kind = 'hour_before'
 where kind = 'soon'
   and not exists (select 1 from public.consulting_reminders x where x.booking_id = r.booking_id and x.kind = 'hour_before');
delete from public.consulting_reminders where kind = 'soon';

alter table public.consulting_reminders drop constraint if exists consulting_reminders_kind_check;
alter table public.consulting_reminders
  add constraint consulting_reminders_kind_check check (kind in ('day_before', 'hour_before'));

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

drop function if exists public.consulting_reminder_lead(public.consulting_mode);

commit;
