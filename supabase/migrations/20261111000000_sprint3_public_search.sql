-- Biska+ · Sprint 3: pesquisa e perfil público.
-- A vista pública passa a incluir as zonas de trabalho (para filtrar por
-- zona) e a data da verificação. Continua a mostrar só aprovados e só
-- campos seguros: nunca telefone, documentos nem o nome completo.

create or replace view public.public_professionals as
select
  p.user_id as id,
  case
    when position(' ' in trim(pr.full_name)) > 0 then
      split_part(trim(pr.full_name), ' ', 1) || ' ' || left(regexp_replace(trim(pr.full_name), '^.*\s+', ''), 1) || '.'
    else trim(pr.full_name)
  end as display_name,
  pr.avatar_url,
  p.category_slug,
  p.bio,
  p.years_experience,
  p.daily_rate_kz,
  p.rating_avg,
  p.rating_count,
  coalesce(array_agg(z.id order by z.name) filter (where z.id is not null), '{}') as zone_ids,
  coalesce(array_agg(z.name order by z.name) filter (where z.id is not null), '{}') as zone_names,
  p.kyc_reviewed_at as verified_at
from public.professional_profiles p
join public.profiles pr on pr.id = p.user_id
left join public.professional_zones pz on pz.user_id = p.user_id
left join public.zones z on z.id = pz.zone_id
where p.kyc_status = 'approved' and p.is_public
group by p.user_id, pr.id;

grant select on public.public_professionals to anon, authenticated;

create index if not exists professional_zones_zone_idx on public.professional_zones (zone_id);
create index if not exists professional_profiles_public_idx
  on public.professional_profiles (category_slug) where kyc_status = 'approved' and is_public;
