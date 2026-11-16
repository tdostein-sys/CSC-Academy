-- =============================================================================
-- Paiement confirmé = paiement terminé
-- =============================================================================
-- Règle (demande du 2026-11-16) : après le paiement par l'admin, tant que
-- l'ambassadeur n'a pas confirmé la réception, les ID concernés ne sont PAS
-- considérés comme payés et la campagne ne peut PAS être clôturée.
-- =============================================================================

-- Clôture : soumissions toutes traitées, tout payé ET toute réception confirmée.
create or replace function public.close_campaign(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.campaigns;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  -- Verrou exclusif : bloque les soumissions / validations / paiements concurrents.
  select * into c from public.campaigns where id = p_id for update;
  if not found then
    raise exception 'not_found';
  end if;
  if c.status <> 'launched' then
    raise exception 'invalid_status_transition';
  end if;
  if exists (select 1 from public.submissions where campaign_id = p_id and status = 'pending') then
    raise exception 'pending_submissions';
  end if;
  if exists (select 1 from public.ambassador_campaign_balances where campaign_id = p_id and due > 0) then
    raise exception 'unpaid_payouts';
  end if;
  if exists (select 1 from public.payouts where campaign_id = p_id and confirmed_at is null) then
    raise exception 'unconfirmed_payouts';
  end if;
  update public.campaigns set status = 'closed', closed_at = now() where id = p_id;
end;
$$;

-- Statistiques : ajout du nombre de paiements non confirmés (nouvelle colonne en fin de vue).
create or replace view public.campaign_stats
with (security_invoker = true)
as
select c.id as campaign_id,
       (select count(*) from public.campaign_views v where v.campaign_id = c.id)::int                                   as views,
       (select count(*) from public.campaign_participations p where p.campaign_id = c.id and p.participates)::int      as participants,
       (select count(*) from public.campaign_participations p where p.campaign_id = c.id and not p.participates)::int  as declined,
       (select count(*) from public.submissions s where s.campaign_id = c.id and s.status = 'pending')::int             as pending,
       (select count(*) from public.submissions s where s.campaign_id = c.id and s.status = 'validated')::int           as validated,
       (select count(*) from public.submissions s where s.campaign_id = c.id and s.status = 'rejected')::int            as rejected,
       (select coalesce(sum(b.earned), 0) from public.ambassador_campaign_balances b where b.campaign_id = c.id)::bigint as earned,
       (select coalesce(sum(b.paid), 0) from public.ambassador_campaign_balances b where b.campaign_id = c.id)::bigint   as paid,
       (select coalesce(sum(b.due), 0) from public.ambassador_campaign_balances b where b.campaign_id = c.id)::bigint    as due,
       (select count(*) from public.payouts po where po.campaign_id = c.id and po.confirmed_at is null)::int             as unconfirmed_payouts
  from public.campaigns c;

-- État de paiement de chaque ID validé. Les paiements étant enregistrés par
-- ambassadeur et par campagne (paiements partiels possibles), on les affecte
-- aux ID dans l'ordre de validation :
--   paid                  : couvert par des paiements CONFIRMÉS par l'ambassadeur
--   awaiting_confirmation : couvert par un paiement de l'admin, non encore confirmé
--   due                   : pas encore payé
create view public.submission_payment_states
with (security_invoker = true)
as
with v as (
  select s.id as submission_id,
         s.campaign_id,
         s.ambassador_id,
         s.amount,
         sum(s.amount) over (partition by s.campaign_id, s.ambassador_id
                             order by s.reviewed_at, s.id
                             rows between unbounded preceding and current row) as cumulative
    from public.submissions s
   where s.status = 'validated'
)
select v.submission_id,
       v.campaign_id,
       v.ambassador_id,
       case
         when v.cumulative <= coalesce(b.confirmed, 0) then 'paid'
         when v.cumulative <= coalesce(b.paid, 0) then 'awaiting_confirmation'
         else 'due'
       end as payment_state
  from v
  left join public.ambassador_campaign_balances b
    on b.campaign_id = v.campaign_id and b.ambassador_id = v.ambassador_id;

revoke all on public.submission_payment_states from anon, authenticated;
grant select on public.submission_payment_states to authenticated;
