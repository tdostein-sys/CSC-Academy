-- =============================================================================
-- CSC Ambassador : ambassadeurs, campagnes, soumissions, soldes, paiements
-- =============================================================================
-- Règles métier garanties PAR LA BASE (jamais uniquement par l'interface) :
--   * numéro d'ambassadeur séquentiel CSC-AMB-0001, jamais réutilisé ;
--   * cycle de campagne brouillon → lancée → clôturée ; montant et volume
--     minimum figés dès le lancement ;
--   * une vue comptée une seule fois par ambassadeur et par campagne ;
--   * ID Binance unique sur toute la plateforme (toutes campagnes confondues) ;
--   * solde TOUJOURS calculé à partir des soumissions validées et des
--     paiements enregistrés (aucun solde stocké) ;
--   * paiement impossible au-delà du montant dû ;
--   * clôture refusée tant qu'il reste des soumissions en attente ou un
--     montant dû non soldé.
-- Toutes les écritures sensibles passent par des fonctions SECURITY DEFINER
-- qui vérifient elles-mêmes le rôle de l'appelant et journalisent l'action.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Ambassadeurs
-- -----------------------------------------------------------------------------
create type public.ambassador_status as enum ('active', 'suspended');

-- Séquence dédiée : un numéro attribué n'est jamais réutilisé.
create sequence public.ambassador_number_seq as integer start 1;

create table public.ambassadors (
  user_id              uuid primary key references public.profiles (id) on delete restrict,
  number               integer not null unique,
  code                 text generated always as (
                         'CSC-AMB-' || case when number < 10000 then lpad(number::text, 4, '0') else number::text end
                       ) stored,
  status               public.ambassador_status not null default 'active',
  status_reason        text,
  status_changed_at    timestamptz,
  charter_accepted_at  timestamptz not null default now(),
  created_at           timestamptz not null default now()
);

comment on table public.ambassadors is 'Utilisateurs ayant accepté la charte ambassadeur (badge + numéro CSC-AMB-xxxx).';

create or replace function public.is_ambassador(uid uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.ambassadors a where a.user_id = uid) $$;

create or replace function public.is_active_ambassador(uid uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.ambassadors a where a.user_id = uid and a.status = 'active') $$;

-- Acceptation de la charte (« D'accord ») : idempotent, renvoie le code.
create or replace function public.become_ambassador()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid  uuid := auth.uid();
  v_code text;
  p      public.profiles;
begin
  if v_uid is null then
    raise exception 'unauthorized' using errcode = '42501';
  end if;

  select code into v_code from public.ambassadors where user_id = v_uid;
  if found then
    return v_code;
  end if;

  select * into p from public.profiles where id = v_uid;
  if not found
     or coalesce(trim(p.first_name), '') = ''
     or coalesce(trim(p.last_name), '') = ''
     or coalesce(trim(p.phone_whatsapp), '') = '' then
    raise exception 'profile_incomplete';
  end if;

  insert into public.ambassadors (user_id, number)
  values (v_uid, nextval('public.ambassador_number_seq'))
  on conflict (user_id) do nothing
  returning code into v_code;

  if v_code is null then
    -- Double clic simultané : l'autre transaction a déjà créé la ligne.
    select code into v_code from public.ambassadors where user_id = v_uid;
  else
    perform public.write_audit('ambassador.join', 'ambassador', v_uid::text, jsonb_build_object('code', v_code));
  end if;
  return v_code;
end;
$$;

-- Suspension / réactivation par l'admin (le numéro est conservé).
create or replace function public.set_ambassador_status(
  p_user uuid, p_status public.ambassador_status, p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_status = 'suspended' and coalesce(trim(p_reason), '') = '' then
    raise exception 'reason_required';
  end if;
  update public.ambassadors
     set status = p_status,
         status_reason = case when p_status = 'suspended' then trim(p_reason) else null end,
         status_changed_at = now()
   where user_id = p_user;
  if not found then
    raise exception 'not_found';
  end if;
  perform public.write_audit(
    case when p_status = 'suspended' then 'ambassador.suspend' else 'ambassador.reactivate' end,
    'ambassador', p_user::text, jsonb_build_object('reason', p_reason));
end;
$$;

-- -----------------------------------------------------------------------------
-- Campagnes
-- -----------------------------------------------------------------------------
create type public.campaign_status as enum ('draft', 'launched', 'closed');

create table public.campaigns (
  id                  uuid primary key default gen_random_uuid(),
  title_fr            text not null check (char_length(title_fr) between 3 and 120),
  title_en            text not null default '' check (char_length(title_en) <= 120),
  summary_fr          text not null default '' check (char_length(summary_fr) <= 500),
  summary_en          text not null default '' check (char_length(summary_en) <= 500),
  modop_fr            text not null default '' check (char_length(modop_fr) <= 20000),
  modop_en            text not null default '' check (char_length(modop_en) <= 20000),
  modop_file_path     text,
  video_url           text check (video_url is null or video_url ~ '^https://'),
  amount_per_account  bigint not null check (amount_per_account > 0 and amount_per_account <= 100000000),
  min_volume          numeric(20, 2) check (min_volume is null or min_volume >= 0),
  ends_on             date,
  status              public.campaign_status not null default 'draft',
  launched_at         timestamptz,
  closed_at           timestamptz,
  created_by          uuid references public.profiles (id) default auth.uid(),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index campaigns_status_idx on public.campaigns (status, created_at desc);

comment on column public.campaigns.amount_per_account is 'FCFA versés par compte validé — figé au lancement.';
comment on column public.campaigns.min_volume is 'Volume de trading minimum facultatif — figé au lancement.';

-- Garde-fous : transitions de statut, montant figé, campagne clôturée intouchable.
create or replace function public.campaigns_guard()
returns trigger
language plpgsql
as $$
begin
  if old.status = 'closed' then
    raise exception 'campaign_closed';
  end if;
  if new.status is distinct from old.status
     and not (old.status = 'draft' and new.status = 'launched')
     and not (old.status = 'launched' and new.status = 'closed') then
    raise exception 'invalid_status_transition';
  end if;
  if old.status <> 'draft'
     and (new.amount_per_account is distinct from old.amount_per_account
          or new.min_volume is distinct from old.min_volume) then
    raise exception 'campaign_amount_frozen';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger campaigns_guard before update on public.campaigns
  for each row execute function public.campaigns_guard();

-- Toute création / modification / suppression de campagne est journalisée.
create or replace function public.campaigns_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_action text;
begin
  if tg_op = 'INSERT' then
    v_action := 'campaign.create';
  elsif tg_op = 'DELETE' then
    perform public.write_audit('campaign.delete', 'campaign', old.id::text, jsonb_build_object('title', old.title_fr));
    return old;
  elsif new.status is distinct from old.status then
    v_action := case new.status when 'launched' then 'campaign.launch' else 'campaign.close' end;
  else
    v_action := 'campaign.update';
  end if;
  perform public.write_audit(v_action, 'campaign', new.id::text,
    jsonb_build_object('title', new.title_fr, 'amount', new.amount_per_account, 'min_volume', new.min_volume));
  return new;
end;
$$;

create trigger campaigns_audit after insert or update or delete on public.campaigns
  for each row execute function public.campaigns_audit();

-- -----------------------------------------------------------------------------
-- Vues (comptées une fois par ambassadeur) et participation
-- -----------------------------------------------------------------------------
create table public.campaign_views (
  campaign_id    uuid not null references public.campaigns (id) on delete cascade,
  ambassador_id  uuid not null references public.ambassadors (user_id) on delete cascade,
  viewed_at      timestamptz not null default now(),
  primary key (campaign_id, ambassador_id)
);

create table public.campaign_participations (
  campaign_id    uuid not null references public.campaigns (id) on delete cascade,
  ambassador_id  uuid not null references public.ambassadors (user_id) on delete cascade,
  participates   boolean not null,
  decided_at     timestamptz not null default now(),
  primary key (campaign_id, ambassador_id)
);

-- -----------------------------------------------------------------------------
-- Soumissions (compte Binance + volume de trading)
-- -----------------------------------------------------------------------------
create type public.submission_status as enum ('pending', 'validated', 'rejected');

create table public.submissions (
  id              uuid primary key default gen_random_uuid(),
  campaign_id     uuid not null references public.campaigns (id) on delete restrict,
  ambassador_id   uuid not null references public.ambassadors (user_id) on delete restrict,
  binance_uid     text not null check (binance_uid ~ '^[0-9]{6,12}$'),
  trading_volume  numeric(20, 2) not null check (trading_volume >= 0),
  status          public.submission_status not null default 'pending',
  -- Montant crédité, copié de la campagne au moment de la validation.
  amount          bigint not null default 0 check (amount >= 0),
  reject_reason   text,
  reviewed_by     uuid references public.profiles (id),
  reviewed_at     timestamptz,
  created_at      timestamptz not null default now(),
  constraint submissions_validated_amount check ((status = 'validated') = (amount > 0)),
  constraint submissions_reject_reason check (status <> 'rejected' or coalesce(trim(reject_reason), '') <> '')
);

-- Unicité GLOBALE de l'ID Binance : un compte ne peut être déclaré qu'une fois,
-- quel que soit l'ambassadeur ou la campagne.
create unique index submissions_binance_uid_key on public.submissions (binance_uid);
create index submissions_campaign_idx on public.submissions (campaign_id, status);
create index submissions_ambassador_idx on public.submissions (ambassador_id, created_at desc);

-- -----------------------------------------------------------------------------
-- Paiements (dû → soldé par l'admin → confirmé par l'ambassadeur)
-- -----------------------------------------------------------------------------
create table public.payouts (
  id             uuid primary key default gen_random_uuid(),
  campaign_id    uuid not null references public.campaigns (id) on delete restrict,
  ambassador_id  uuid not null references public.ambassadors (user_id) on delete restrict,
  amount         bigint not null check (amount > 0),
  method         text not null check (char_length(method) between 2 and 60),
  reference      text not null default '' check (char_length(reference) <= 120),
  paid_by        uuid references public.profiles (id) default auth.uid(),
  paid_at        timestamptz not null default now(),
  confirmed_at   timestamptz,
  created_at     timestamptz not null default now()
);
create index payouts_ambassador_idx on public.payouts (ambassador_id, campaign_id);

-- -----------------------------------------------------------------------------
-- Soldes : TOUJOURS calculés (jamais stockés).
-- security_invoker : la RLS des tables sous-jacentes s'applique à l'appelant.
-- -----------------------------------------------------------------------------
create view public.ambassador_campaign_balances
with (security_invoker = true)
as
with earned as (
  select campaign_id, ambassador_id, sum(amount) as earned, count(*) as validated_count
    from public.submissions
   where status = 'validated'
   group by campaign_id, ambassador_id
),
paid as (
  select campaign_id, ambassador_id,
         sum(amount) as paid,
         coalesce(sum(amount) filter (where confirmed_at is not null), 0) as confirmed,
         count(*) filter (where confirmed_at is null) as unconfirmed_count
    from public.payouts
   group by campaign_id, ambassador_id
)
select campaign_id,
       ambassador_id,
       coalesce(e.earned, 0)::bigint                          as earned,
       coalesce(p.paid, 0)::bigint                            as paid,
       coalesce(p.confirmed, 0)::bigint                       as confirmed,
       (coalesce(e.earned, 0) - coalesce(p.paid, 0))::bigint  as due,
       coalesce(e.validated_count, 0)::int                    as validated_count,
       coalesce(p.unconfirmed_count, 0)::int                  as unconfirmed_count
  from earned e
  full join paid p using (campaign_id, ambassador_id);

create view public.ambassador_balances
with (security_invoker = true)
as
select ambassador_id,
       sum(earned)::bigint            as earned,
       sum(paid)::bigint              as paid,
       sum(confirmed)::bigint         as confirmed,
       sum(due)::bigint               as due,
       sum(validated_count)::int      as validated_count,
       sum(unconfirmed_count)::int    as unconfirmed_count
  from public.ambassador_campaign_balances
 group by ambassador_id;

-- Totaux du programme (tableau de bord admin ; un ambassadeur n'y voit que les siens).
create view public.ambassador_program_totals
with (security_invoker = true)
as
select coalesce(sum(earned), 0)::bigint as earned,
       coalesce(sum(paid), 0)::bigint   as paid,
       coalesce(sum(due), 0)::bigint    as due
  from public.ambassador_campaign_balances;

-- Statistiques par campagne (vues uniques, participation, soumissions, montants).
create view public.campaign_stats
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
       (select coalesce(sum(b.due), 0) from public.ambassador_campaign_balances b where b.campaign_id = c.id)::bigint    as due
  from public.campaigns c;

-- =============================================================================
-- Fonctions métier
-- =============================================================================

-- Lancement (admin) : brouillon → lancée. Exige modop (texte ou fichier) et vidéo.
create or replace function public.launch_campaign(p_id uuid)
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
  select * into c from public.campaigns where id = p_id for update;
  if not found then
    raise exception 'not_found';
  end if;
  if c.status <> 'draft' then
    raise exception 'invalid_status_transition';
  end if;
  if (coalesce(trim(c.modop_fr), '') = '' and c.modop_file_path is null) or c.video_url is null then
    raise exception 'campaign_incomplete';
  end if;
  update public.campaigns set status = 'launched', launched_at = now() where id = p_id;
end;
$$;

-- Clôture (admin) : refusée s'il reste des soumissions en attente ou un dû.
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
  -- Verrou exclusif : bloque les soumissions / validations concurrentes
  -- (elles prennent un verrou partagé sur la campagne).
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
  update public.campaigns set status = 'closed', closed_at = now() where id = p_id;
end;
$$;

-- Vue d'une campagne : comptée une seule fois par ambassadeur (sans erreur sinon).
create or replace function public.record_campaign_view(p_campaign uuid)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.campaign_views (campaign_id, ambassador_id)
  select c.id, a.user_id
    from public.campaigns c, public.ambassadors a
   where c.id = p_campaign and c.status <> 'draft' and a.user_id = auth.uid()
  on conflict do nothing;
$$;

-- Vérifie que l'appelant est un ambassadeur actif ; renvoie son id.
create or replace function public.require_active_ambassador()
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_status public.ambassador_status;
begin
  select status into v_status from public.ambassadors where user_id = auth.uid();
  if not found then
    raise exception 'not_ambassador' using errcode = '42501';
  end if;
  if v_status = 'suspended' then
    raise exception 'ambassador_suspended' using errcode = '42501';
  end if;
  return auth.uid();
end;
$$;

-- Choix participe / ne participe pas (modifiable tant que la campagne est lancée).
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
  insert into public.campaign_participations (campaign_id, ambassador_id, participates)
  values (p_campaign, v_uid, coalesce(p_participates, false))
  on conflict (campaign_id, ambassador_id)
  do update set participates = excluded.participates, decided_at = now();
end;
$$;

-- Déclaration d'un compte Binance par un ambassadeur.
create or replace function public.submit_account(p_campaign uuid, p_binance_uid text, p_volume numeric)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid := public.require_active_ambassador();
  c       public.campaigns;
  v_bid   text := regexp_replace(coalesce(p_binance_uid, ''), '\s', '', 'g');
  v_id    uuid;
begin
  -- Verrou partagé : empêche une clôture simultanée.
  select * into c from public.campaigns where id = p_campaign for share;
  if not found or c.status <> 'launched' then
    raise exception 'campaign_not_open';
  end if;
  if not exists (
    select 1 from public.campaign_participations
     where campaign_id = p_campaign and ambassador_id = v_uid and participates
  ) then
    raise exception 'not_participating';
  end if;
  if v_bid !~ '^[0-9]{6,12}$' then
    raise exception 'binance_uid_invalid';
  end if;
  if p_volume is null or p_volume < 0 or p_volume >= 1e18 then
    raise exception 'volume_invalid';
  end if;
  if c.min_volume is not null and p_volume < c.min_volume then
    raise exception 'volume_below_minimum';
  end if;

  begin
    insert into public.submissions (campaign_id, ambassador_id, binance_uid, trading_volume)
    values (p_campaign, v_uid, v_bid, round(p_volume, 2))
    returning id into v_id;
  exception when unique_violation then
    raise exception 'binance_uid_taken';
  end;

  perform public.write_audit('submission.create', 'submission', v_id::text,
    jsonb_build_object('campaign_id', p_campaign, 'binance_uid', v_bid, 'volume', p_volume));
  return v_id;
end;
$$;

-- L'ambassadeur peut retirer une soumission encore en attente (erreur de saisie).
create or replace function public.cancel_submission(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  s     public.submissions;
begin
  select * into s from public.submissions where id = p_id and ambassador_id = v_uid for update;
  if not found then
    raise exception 'not_found';
  end if;
  if s.status <> 'pending' then
    raise exception 'already_reviewed';
  end if;
  delete from public.submissions where id = p_id;
  perform public.write_audit('submission.cancel', 'submission', p_id::text,
    jsonb_build_object('campaign_id', s.campaign_id, 'binance_uid', s.binance_uid));
end;
$$;

-- Validation / rejet (admin). Le montant crédité est celui, figé, de la campagne.
create or replace function public.review_submission(p_id uuid, p_decision text, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  s        public.submissions;
  c        public.campaigns;
  v_reason text := nullif(trim(coalesce(p_reason, '')), '');
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into s from public.submissions where id = p_id for update;
  if not found then
    raise exception 'not_found';
  end if;
  select * into c from public.campaigns where id = s.campaign_id for share;
  if c.status <> 'launched' then
    raise exception 'campaign_not_open';
  end if;
  if s.status <> 'pending' then
    raise exception 'already_reviewed';
  end if;

  if p_decision = 'validated' then
    update public.submissions
       set status = 'validated', amount = c.amount_per_account, reject_reason = null,
           reviewed_by = auth.uid(), reviewed_at = now()
     where id = p_id;
  elsif p_decision = 'rejected' then
    if v_reason is null then
      raise exception 'reason_required';
    end if;
    update public.submissions
       set status = 'rejected', amount = 0, reject_reason = left(v_reason, 500),
           reviewed_by = auth.uid(), reviewed_at = now()
     where id = p_id;
  else
    raise exception 'invalid_decision';
  end if;

  perform public.write_audit('submission.' || p_decision, 'submission', p_id::text,
    jsonb_build_object('campaign_id', s.campaign_id, 'binance_uid', s.binance_uid, 'reason', v_reason));
end;
$$;

-- Suppression d'une soumission REJETÉE (admin, auditée) : libère l'ID Binance.
create or replace function public.delete_rejected_submission(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.submissions;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into s from public.submissions where id = p_id for update;
  if not found then
    raise exception 'not_found';
  end if;
  if s.status <> 'rejected' then
    raise exception 'only_rejected_deletable';
  end if;
  delete from public.submissions where id = p_id;
  perform public.write_audit('submission.delete', 'submission', p_id::text,
    jsonb_build_object('campaign_id', s.campaign_id, 'binance_uid', s.binance_uid,
                       'ambassador_id', s.ambassador_id, 'reason', s.reject_reason));
end;
$$;

-- Enregistrement d'un paiement (admin). Paiements partiels autorisés,
-- jamais au-delà du montant dû.
create or replace function public.record_payout(
  p_campaign uuid, p_ambassador uuid, p_amount bigint, p_method text, p_reference text default ''
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status public.campaign_status;
  v_due    bigint;
  v_id     uuid;
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
  select status into v_status from public.campaigns where id = p_campaign for share;
  if not found or v_status = 'draft' then
    raise exception 'campaign_not_open';
  end if;
  -- Sérialise les paiements d'un même ambassadeur (pas de double paiement).
  perform 1 from public.ambassadors where user_id = p_ambassador for update;
  if not found then
    raise exception 'not_found';
  end if;

  select due into v_due from public.ambassador_campaign_balances
   where campaign_id = p_campaign and ambassador_id = p_ambassador;
  if p_amount > coalesce(v_due, 0) then
    raise exception 'payout_exceeds_due';
  end if;

  insert into public.payouts (campaign_id, ambassador_id, amount, method, reference, paid_by)
  values (p_campaign, p_ambassador, p_amount, trim(p_method), trim(coalesce(p_reference, '')), auth.uid())
  returning id into v_id;

  perform public.write_audit('payout.record', 'payout', v_id::text,
    jsonb_build_object('campaign_id', p_campaign, 'ambassador_id', p_ambassador,
                       'amount', p_amount, 'method', trim(p_method), 'reference', p_reference));
  return v_id;
end;
$$;

-- Confirmation de réception par l'ambassadeur (ses propres paiements uniquement).
create or replace function public.confirm_payout(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.payouts
     set confirmed_at = now()
   where id = p_id and ambassador_id = auth.uid() and confirmed_at is null;
  if not found then
    raise exception 'not_found';
  end if;
  perform public.write_audit('payout.confirm', 'payout', p_id::text, '{}'::jsonb);
end;
$$;

-- =============================================================================
-- Privilèges & RLS
-- =============================================================================
alter table public.ambassadors              enable row level security;
alter table public.campaigns                enable row level security;
alter table public.campaign_views           enable row level security;
alter table public.campaign_participations  enable row level security;
alter table public.submissions              enable row level security;
alter table public.payouts                  enable row level security;

revoke all on public.ambassadors, public.campaigns, public.campaign_views,
              public.campaign_participations, public.submissions, public.payouts,
              public.ambassador_campaign_balances, public.ambassador_balances,
              public.ambassador_program_totals, public.campaign_stats
  from anon, authenticated;
revoke all on sequence public.ambassador_number_seq from anon, authenticated;

-- Lecture : chacun ses lignes, l'admin tout.
grant select on public.ambassadors, public.campaign_views, public.campaign_participations,
                public.submissions, public.payouts to authenticated;
grant select on public.ambassador_campaign_balances, public.ambassador_balances,
                public.ambassador_program_totals, public.campaign_stats to authenticated;

create policy ambassadors_select on public.ambassadors
  for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy campaign_views_select on public.campaign_views
  for select to authenticated using (ambassador_id = auth.uid() or public.is_admin());
create policy participations_select on public.campaign_participations
  for select to authenticated using (ambassador_id = auth.uid() or public.is_admin());
create policy submissions_select on public.submissions
  for select to authenticated using (ambassador_id = auth.uid() or public.is_admin());
create policy payouts_select on public.payouts
  for select to authenticated using (ambassador_id = auth.uid() or public.is_admin());

-- Campagnes : les ambassadeurs voient les campagnes lancées / clôturées ;
-- l'admin gère les brouillons. Le statut n'est modifiable QUE via
-- launch_campaign / close_campaign (colonne non accordée en écriture).
grant select on public.campaigns to authenticated;
grant insert (title_fr, title_en, summary_fr, summary_en, modop_fr, modop_en, modop_file_path,
              video_url, amount_per_account, min_volume, ends_on)
  on public.campaigns to authenticated;
grant update (title_fr, title_en, summary_fr, summary_en, modop_fr, modop_en, modop_file_path,
              video_url, amount_per_account, min_volume, ends_on)
  on public.campaigns to authenticated;
grant delete on public.campaigns to authenticated;

create policy campaigns_select on public.campaigns
  for select to authenticated
  using (public.is_admin() or (status <> 'draft' and public.is_ambassador()));
create policy campaigns_insert_admin on public.campaigns
  for insert to authenticated with check (public.is_admin());
create policy campaigns_update_admin on public.campaigns
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy campaigns_delete_draft on public.campaigns
  for delete to authenticated using (public.is_admin() and status = 'draft');

-- Fonctions
revoke execute on function
  public.become_ambassador(),
  public.set_ambassador_status(uuid, public.ambassador_status, text),
  public.launch_campaign(uuid),
  public.close_campaign(uuid),
  public.record_campaign_view(uuid),
  public.require_active_ambassador(),
  public.set_participation(uuid, boolean),
  public.submit_account(uuid, text, numeric),
  public.cancel_submission(uuid),
  public.review_submission(uuid, text, text),
  public.delete_rejected_submission(uuid),
  public.record_payout(uuid, uuid, bigint, text, text),
  public.confirm_payout(uuid),
  public.is_ambassador(uuid),
  public.is_active_ambassador(uuid),
  public.campaigns_audit(),
  public.campaigns_guard()
from public, anon, authenticated;

grant execute on function
  public.become_ambassador(),
  public.set_ambassador_status(uuid, public.ambassador_status, text),
  public.launch_campaign(uuid),
  public.close_campaign(uuid),
  public.record_campaign_view(uuid),
  public.set_participation(uuid, boolean),
  public.submit_account(uuid, text, numeric),
  public.cancel_submission(uuid),
  public.review_submission(uuid, text, text),
  public.delete_rejected_submission(uuid),
  public.record_payout(uuid, uuid, bigint, text, text),
  public.confirm_payout(uuid),
  public.is_ambassador(uuid),
  public.is_active_ambassador(uuid)
to authenticated;

-- =============================================================================
-- Stockage : fichiers de mode opératoire (PDF / images), bucket privé
-- Chemin : <campaign_id>/<nom-de-fichier>
-- =============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('campaign-files', 'campaign-files', false, 5242880,
        array['application/pdf', 'image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

create policy campaign_files_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'campaign-files'
    and (
      public.is_admin()
      or (public.is_ambassador() and exists (
            select 1 from public.campaigns c
             where c.id::text = (storage.foldername(objects.name))[1] and c.status <> 'draft'))
    )
  );
create policy campaign_files_admin_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'campaign-files' and public.is_admin());
create policy campaign_files_admin_update on storage.objects
  for update to authenticated
  using (bucket_id = 'campaign-files' and public.is_admin());
create policy campaign_files_admin_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'campaign-files' and public.is_admin());
