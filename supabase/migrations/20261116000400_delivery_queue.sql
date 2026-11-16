-- =============================================================================
-- File d'envoi des messages aux ambassadeurs (supervision par l'admin)
-- =============================================================================

-- L'admin peut lire toutes les notifications (supervision des envois) ;
-- chaque utilisateur continue de ne voir que les siennes.
create policy notifications_select_admin on public.notifications
  for select to authenticated
  using (public.is_admin());

-- Vue de la file : un envoi (e-mail / WhatsApp) par ligne, avec le message
-- et l'ambassadeur destinataire. security_invoker : la RLS s'applique
-- (seul l'admin voit des lignes, car notification_deliveries lui est réservée).
create view public.ambassador_delivery_queue
with (security_invoker = true)
as
select d.id,
       d.channel,
       d.status,
       d.attempts,
       d.last_error,
       d.next_attempt_at,
       d.sent_at,
       d.created_at,
       n.id         as notification_id,
       n.type,
       n.title,
       n.body,
       n.read_at,
       a.user_id    as ambassador_id,
       a.code       as ambassador_code,
       p.first_name,
       p.last_name,
       p.email,
       p.phone_whatsapp
  from public.notification_deliveries d
  join public.notifications n on n.id = d.notification_id
  join public.ambassadors a   on a.user_id = n.user_id
  join public.profiles p      on p.id = n.user_id;

revoke all on public.ambassador_delivery_queue from anon, authenticated;
grant select on public.ambassador_delivery_queue to authenticated;

-- Remet en file des envois en échec (admin, audité). p_ids null = tous les échecs
-- des ambassadeurs. Renvoie le nombre d'envois remis en file.
create or replace function public.retry_failed_deliveries(p_ids uuid[] default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.notification_deliveries d
     set status = 'pending', attempts = 0, next_attempt_at = now(), last_error = null
    from public.notifications n
   where n.id = d.notification_id
     and d.status = 'failed'
     and exists (select 1 from public.ambassadors a where a.user_id = n.user_id)
     and (p_ids is null or d.id = any (p_ids));
  get diagnostics v_count = row_count;
  perform public.write_audit('delivery.retry', 'notification_delivery',
    case when p_ids is not null and cardinality(p_ids) = 1 then p_ids[1]::text end,
    jsonb_build_object('count', v_count, 'all', p_ids is null));
  return v_count;
end;
$$;

revoke execute on function public.retry_failed_deliveries(uuid[]) from public, anon, authenticated;
grant execute on function public.retry_failed_deliveries(uuid[]) to authenticated;
