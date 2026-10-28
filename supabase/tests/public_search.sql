-- Testes da vista pública usada na pesquisa e no perfil (Sprint 3).

\set ON_ERROR_STOP on
\set QUIET on
\pset tuples_only on
\o /dev/null

create function pg_temp.expect(ok boolean, what text) returns void language plpgsql as $$
begin
  if not coalesce(ok, false) then
    raise exception 'Falhou: %', what;
  end if;
end;
$$;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000d1', 'pintor@biska.ao', '{"full_name":"Joaquim Manuel Silva"}'),
  ('00000000-0000-0000-0000-0000000000d2', 'canal@biska.ao', '{"full_name":"Pedro Neto"}');
update public.profiles set phone = '+244923000001' where id = '00000000-0000-0000-0000-0000000000d1';

insert into public.professional_profiles (user_id, category_slug, bio, daily_rate_kz) values
  ('00000000-0000-0000-0000-0000000000d1', 'pintor', 'Pinturas interiores e exteriores.', 12000),
  ('00000000-0000-0000-0000-0000000000d2', 'canalizador', 'Ainda em rascunho.', 9000);
insert into public.professional_zones (user_id, zone_id)
select '00000000-0000-0000-0000-0000000000d1', id from public.zones where name in ('Kilamba', 'Viana');
insert into public.professional_zones (user_id, zone_id)
select '00000000-0000-0000-0000-0000000000d2', id from public.zones where name = 'Kilamba';
update public.professional_profiles
set kyc_status = 'approved', is_public = true, kyc_reviewed_at = now()
where user_id = '00000000-0000-0000-0000-0000000000d1';

\echo '· anónimo pesquisa'
set role anon;
select pg_temp.expect((select count(*) = 1 from public.public_professionals), 'só o aprovado aparece');
select pg_temp.expect(
  (select display_name = 'Joaquim S.' and zone_names = '{Kilamba,Viana}' and verified_at is not null
   from public.public_professionals),
  'nome abreviado, zonas e data de verificação');
select pg_temp.expect(
  (select count(*) = 1 from public.public_professionals
   where zone_ids @> array[(select id from public.zones where name = 'Viana')]),
  'filtro por zona');
select pg_temp.expect(
  (select count(*) = 0 from public.public_professionals
   where category_slug = 'canalizador'),
  'rascunho não aparece');
select pg_temp.expect(
  not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'public_professionals'
      and column_name in ('phone', 'full_name', 'kyc_status', 'data_consent_at')
  ),
  'vista sem campos privados');
reset role;

\echo 'Todos os testes passaram.'
