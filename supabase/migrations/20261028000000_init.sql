-- Biska+ · esquema inicial (Sprint 1)
-- Perfis, categorias, zonas, perfil profissional, documentos KYC e auditoria.
-- Toda a tabela tem Row Level Security (RLS) activo: por omissão ninguém lê
-- nem escreve nada; cada política abaixo abre só o mínimo necessário.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------------
create type public.user_role as enum ('client', 'professional', 'admin');
create type public.kyc_status as enum ('draft', 'submitted', 'in_review', 'needs_fix', 'approved', 'rejected');
create type public.kyc_document_type as enum (
  'id_front', 'id_back', 'selfie', 'criminal_record',
  'residence_certificate', 'driver_license', 'certificate'
);
create type public.kyc_document_status as enum ('pending', 'accepted', 'rejected');

-- ---------------------------------------------------------------------------
-- Perfis (um por utilizador do auth)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  phone text unique,
  phone_verified_at timestamptz,
  avatar_url text,
  roles public.user_role[] not null default array['client']::public.user_role[],
  locale text not null default 'pt-AO',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and 'admin' = any (roles)
  );
$$;

-- Cria o perfil automaticamente quando alguém se regista (Google, Apple,
-- Facebook ou telefone) e mantém o telefone confirmado sincronizado.
create or replace function public.handle_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, avatar_url, phone, phone_verified_at)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url',
    case when new.phone_confirmed_at is not null and new.phone <> '' then '+' || ltrim(new.phone, '+') end,
    new.phone_confirmed_at
  )
  on conflict (id) do update set
    phone = coalesce(excluded.phone, public.profiles.phone),
    phone_verified_at = coalesce(excluded.phone_verified_at, public.profiles.phone_verified_at),
    updated_at = now();
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_auth_user();

create trigger on_auth_user_phone_confirmed
  after update of phone_confirmed_at on auth.users
  for each row when (new.phone_confirmed_at is distinct from old.phone_confirmed_at)
  execute function public.handle_auth_user();

alter table public.profiles enable row level security;

create policy "profiles: ver o próprio ou admin"
  on public.profiles for select
  using (id = auth.uid() or public.is_admin());

create policy "profiles: editar o próprio"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- O utilizador só pode alterar estes campos; papéis e telefone são geridos
-- pelo sistema (impede que alguém se torne admin sozinho).
revoke update on public.profiles from authenticated, anon;
grant update (full_name, avatar_url, locale) on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- Catálogo: categorias e zonas (leitura pública)
-- ---------------------------------------------------------------------------
create table public.categories (
  slug text primary key,
  name text not null,
  requires_criminal_record boolean not null default false,
  requires_driver_license boolean not null default false,
  sort_order int not null default 0,
  active boolean not null default true
);

create table public.zones (
  id serial primary key,
  name text not null,
  province text not null default 'Luanda',
  unique (province, name)
);

alter table public.categories enable row level security;
alter table public.zones enable row level security;

create policy "categories: leitura pública" on public.categories for select using (true);
create policy "zones: leitura pública" on public.zones for select using (true);
create policy "categories: admin gere" on public.categories for all using (public.is_admin()) with check (public.is_admin());
create policy "zones: admin gere" on public.zones for all using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Perfil profissional
-- ---------------------------------------------------------------------------
create table public.professional_profiles (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  category_slug text not null references public.categories (slug),
  bio text check (char_length(bio) <= 1200),
  years_experience int check (years_experience between 0 and 60),
  daily_rate_kz int check (daily_rate_kz > 0),
  kyc_status public.kyc_status not null default 'draft',
  kyc_submitted_at timestamptz,
  kyc_reviewed_at timestamptz,
  is_public boolean not null default false,
  rating_avg numeric(2, 1),
  rating_count int not null default 0,
  data_consent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.professional_zones (
  user_id uuid references public.professional_profiles (user_id) on delete cascade,
  zone_id int references public.zones (id) on delete cascade,
  primary key (user_id, zone_id)
);

-- Ao criar o perfil profissional, o utilizador ganha o papel "professional".
create or replace function public.grant_professional_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles
  set roles = array_append(roles, 'professional'), updated_at = now()
  where id = new.user_id and not ('professional' = any (roles));
  return new;
end;
$$;

create trigger on_professional_profile_created
  after insert on public.professional_profiles
  for each row execute function public.grant_professional_role();

alter table public.professional_profiles enable row level security;
alter table public.professional_zones enable row level security;

create policy "pro: ver o próprio ou admin"
  on public.professional_profiles for select
  using (user_id = auth.uid() or public.is_admin());

create policy "pro: criar o próprio em rascunho"
  on public.professional_profiles for insert
  with check (user_id = auth.uid() and kyc_status = 'draft' and is_public = false);

create policy "pro: editar o próprio"
  on public.professional_profiles for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Estado do KYC, visibilidade e avaliações só mudam por funções do sistema.
revoke update on public.professional_profiles from authenticated, anon;
grant update (category_slug, bio, years_experience, daily_rate_kz, data_consent_at)
  on public.professional_profiles to authenticated;

create policy "zonas do pro: ver"
  on public.professional_zones for select using (true);
create policy "zonas do pro: gerir as próprias"
  on public.professional_zones for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Vista pública: só profissionais aprovados, só campos seguros.
-- Nome apresentado como "Joaquim M."; nunca telefone, morada ou documentos.
create view public.public_professionals as
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
  p.rating_count
from public.professional_profiles p
join public.profiles pr on pr.id = p.user_id
where p.kyc_status = 'approved' and p.is_public;

grant select on public.public_professionals to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Documentos KYC (ficheiros no bucket privado "kyc-documents")
-- ---------------------------------------------------------------------------
create table public.kyc_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.professional_profiles (user_id) on delete cascade,
  type public.kyc_document_type not null,
  storage_path text not null,
  issued_at date,
  status public.kyc_document_status not null default 'pending',
  reviewer_note text,
  reviewed_by uuid references public.profiles (id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index kyc_documents_user_idx on public.kyc_documents (user_id);

alter table public.kyc_documents enable row level security;

create policy "kyc: ver os próprios ou admin"
  on public.kyc_documents for select
  using (user_id = auth.uid() or public.is_admin());

create policy "kyc: enviar os próprios"
  on public.kyc_documents for insert
  with check (
    user_id = auth.uid()
    and status = 'pending'
    and storage_path like auth.uid()::text || '/%'
  );

create policy "kyc: apagar os próprios pendentes"
  on public.kyc_documents for delete
  using (user_id = auth.uid() and status = 'pending');

-- ---------------------------------------------------------------------------
-- Auditoria (quem viu/decidiu o quê)
-- ---------------------------------------------------------------------------
create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles (id),
  action text not null,
  target_table text,
  target_id text,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.audit_log enable row level security;

create policy "audit: só admin lê" on public.audit_log for select using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Fluxo do KYC
-- ---------------------------------------------------------------------------

-- O profissional submete o cadastro; valida os documentos obrigatórios.
create or replace function public.submit_kyc()
returns public.kyc_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  pro public.professional_profiles;
  cat public.categories;
  missing text[] := '{}';
begin
  select * into pro from public.professional_profiles where user_id = auth.uid();
  if not found then
    raise exception 'Perfil profissional não encontrado';
  end if;
  if pro.kyc_status not in ('draft', 'needs_fix') then
    raise exception 'O cadastro já foi submetido';
  end if;
  if pro.data_consent_at is null then
    raise exception 'Falta o consentimento de tratamento de dados (Lei n.º 22/11)';
  end if;

  select * into cat from public.categories where slug = pro.category_slug;

  if not exists (select 1 from public.kyc_documents where user_id = pro.user_id and type = 'id_front') then
    missing := array_append(missing, 'id_front');
  end if;
  if not exists (select 1 from public.kyc_documents where user_id = pro.user_id and type = 'id_back') then
    missing := array_append(missing, 'id_back');
  end if;
  if not exists (select 1 from public.kyc_documents where user_id = pro.user_id and type = 'selfie') then
    missing := array_append(missing, 'selfie');
  end if;
  if cat.requires_criminal_record and not exists (
    select 1 from public.kyc_documents where user_id = pro.user_id and type = 'criminal_record'
  ) then
    missing := array_append(missing, 'criminal_record');
  end if;
  if cat.requires_driver_license and not exists (
    select 1 from public.kyc_documents where user_id = pro.user_id and type = 'driver_license'
  ) then
    missing := array_append(missing, 'driver_license');
  end if;

  if array_length(missing, 1) > 0 then
    raise exception 'Documentos em falta: %', array_to_string(missing, ', ');
  end if;

  update public.professional_profiles
  set kyc_status = 'submitted', kyc_submitted_at = now(), updated_at = now()
  where user_id = pro.user_id;

  insert into public.audit_log (actor_id, action, target_table, target_id)
  values (auth.uid(), 'kyc.submit', 'professional_profiles', pro.user_id::text);

  return 'submitted';
end;
$$;

-- O admin decide: aprovar, pedir correcção ou rejeitar.
create or replace function public.review_kyc(
  professional_id uuid,
  decision public.kyc_status,
  note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Apenas administradores';
  end if;
  if decision not in ('in_review', 'needs_fix', 'approved', 'rejected') then
    raise exception 'Decisão inválida';
  end if;

  update public.professional_profiles
  set kyc_status = decision,
      kyc_reviewed_at = now(),
      is_public = (decision = 'approved'),
      updated_at = now()
  where user_id = professional_id;

  if not found then
    raise exception 'Profissional não encontrado';
  end if;

  insert into public.audit_log (actor_id, action, target_table, target_id, meta)
  values (auth.uid(), 'kyc.review', 'professional_profiles', professional_id::text,
          jsonb_build_object('decision', decision, 'note', note));
end;
$$;

revoke execute on function public.submit_kyc() from anon;
revoke execute on function public.review_kyc(uuid, public.kyc_status, text) from anon;

-- ---------------------------------------------------------------------------
-- Storage
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('kyc-documents', 'kyc-documents', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']),
  ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- Documentos KYC: cada um só mexe na sua pasta "<user_id>/…"; admin lê tudo.
create policy "kyc storage: enviar para a própria pasta"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'kyc-documents' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "kyc storage: ler os próprios ou admin"
  on storage.objects for select to authenticated
  using (bucket_id = 'kyc-documents' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));

create policy "kyc storage: apagar os próprios"
  on storage.objects for delete to authenticated
  using (bucket_id = 'kyc-documents' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "avatars: enviar o próprio"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "avatars: substituir o próprio"
  on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
