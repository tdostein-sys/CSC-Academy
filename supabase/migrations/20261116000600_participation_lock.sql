-- =============================================================================
-- Participation verrouillée après une soumission
-- =============================================================================
-- Règle (demande du 2026-11-16) : un ambassadeur qui a déjà soumis au moins un
-- ID pour une campagne ne peut plus déclarer qu'il n'y participe pas.
-- Les soumissions rejetées ne comptent pas : seules les soumissions en attente
-- ou validées verrouillent la participation. Si l'ambassadeur retire toutes ses
-- soumissions en attente (et n'en a aucune validée), il peut de nouveau refuser.
-- =============================================================================

create or replace function public.set_participation(p_campaign uuid, p_participates boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid    uuid := public.require_active_ambassador();
  v_status public.campaign_status;
begin
  select status into v_status from public.campaigns where id = p_campaign for share;
  if not found or v_status <> 'launched' then
    raise exception 'campaign_not_open';
  end if;
  if not coalesce(p_participates, false) and exists (
    select 1 from public.submissions
     where campaign_id = p_campaign
       and ambassador_id = v_uid
       and status in ('pending', 'validated')
  ) then
    raise exception 'participation_locked';
  end if;
  insert into public.campaign_participations (campaign_id, ambassador_id, participates)
  values (p_campaign, v_uid, coalesce(p_participates, false))
  on conflict (campaign_id, ambassador_id)
  do update set participates = excluded.participates, decided_at = now();
end;
$$;
