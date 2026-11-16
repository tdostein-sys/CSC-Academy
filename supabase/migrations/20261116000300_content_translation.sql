-- =============================================================================
-- Contenus saisis dans UNE langue, traduits automatiquement dans l'autre
-- =============================================================================
-- L'admin saisit un contenu en français OU en anglais (source_locale) ;
-- l'application le traduit à l'enregistrement et stocke les deux versions.
-- Si la traduction est indisponible, la version manquante reste vide et
-- l'affichage se replie sur la langue d'origine.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Campagnes
-- -----------------------------------------------------------------------------
alter table public.campaigns
  add column source_locale text not null default 'fr' check (source_locale in ('fr', 'en'));

-- Le titre peut désormais n'exister qu'en anglais (si saisi en anglais et non traduit).
alter table public.campaigns drop constraint campaigns_title_fr_check;
alter table public.campaigns
  add constraint campaigns_title_fr_check check (char_length(title_fr) <= 120),
  add constraint campaigns_title_required check (greatest(char_length(trim(title_fr)), char_length(trim(title_en))) >= 3);

grant insert (source_locale), update (source_locale) on public.campaigns to authenticated;

-- Lancement : le mode opératoire peut être rédigé dans l'une ou l'autre langue.
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
  if (coalesce(trim(c.modop_fr), '') = '' and coalesce(trim(c.modop_en), '') = '' and c.modop_file_path is null)
     or c.video_url is null then
    raise exception 'campaign_incomplete';
  end if;
  update public.campaigns set status = 'launched', launched_at = now() where id = p_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Contenus éditables (charte ambassadeur…)
-- -----------------------------------------------------------------------------
alter table public.site_content
  add column source_locale text not null default 'fr' check (source_locale in ('fr', 'en'));

drop function public.update_site_content(text, text, text);

create function public.update_site_content(
  p_key text, p_body_fr text, p_body_en text, p_source_locale text default 'fr'
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
  if p_source_locale not in ('fr', 'en') then
    raise exception 'invalid_locale';
  end if;
  update public.site_content
     set body_fr = coalesce(p_body_fr, ''), body_en = coalesce(p_body_en, ''),
         source_locale = p_source_locale, updated_at = now(), updated_by = auth.uid()
   where key = p_key;
  if not found then
    raise exception 'unknown_content_key';
  end if;
  perform public.write_audit('site_content.update', 'site_content', p_key,
    jsonb_build_object('source_locale', p_source_locale));
end;
$$;

revoke execute on function public.update_site_content(text, text, text, text) from public, anon;
grant execute on function public.update_site_content(text, text, text, text) to authenticated;
