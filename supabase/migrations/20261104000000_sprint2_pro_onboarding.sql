-- Biska+ · Sprint 2: cadastro do profissional e painel de aprovação.
-- - O profissional só mexe nos dados e documentos enquanto o cadastro está
--   em rascunho ou com correcções pedidas.
-- - O admin revê cada documento, depois decide o cadastro; tudo fica em
--   audit_log, incluindo quando um admin abre os documentos de alguém.

-- Motivo da última decisão do admin, visível ao profissional.
alter table public.professional_profiles add column kyc_review_note text;

-- ---------------------------------------------------------------------------
-- Auxiliares
-- ---------------------------------------------------------------------------

-- Estado do cadastro do utilizador actual (null se não for profissional).
create or replace function public.my_kyc_status()
returns public.kyc_status
language sql
stable
security definer
set search_path = ''
as $$
  select kyc_status from public.professional_profiles where user_id = auth.uid();
$$;

-- Documentos obrigatórios de uma categoria (BI frente/verso e selfie sempre).
create or replace function public.required_kyc_documents(category text)
returns public.kyc_document_type[]
language sql
stable
set search_path = ''
as $$
  select array['id_front', 'id_back', 'selfie']::public.kyc_document_type[]
    || case when c.requires_criminal_record then array['criminal_record']::public.kyc_document_type[] else '{}' end
    || case when c.requires_driver_license then array['driver_license']::public.kyc_document_type[] else '{}' end
  from public.categories c
  where c.slug = category;
$$;

-- ---------------------------------------------------------------------------
-- Perfil profissional: só editável fora da revisão
-- ---------------------------------------------------------------------------
drop policy "pro: editar o próprio" on public.professional_profiles;

-- Aprovado continua a poder actualizar bio e preço; durante a revisão não.
create policy "pro: editar o próprio fora da revisão"
  on public.professional_profiles for update
  using (user_id = auth.uid() and kyc_status in ('draft', 'needs_fix', 'approved'))
  with check (user_id = auth.uid());

-- Mudar de categoria muda os documentos exigidos: só antes de submeter.
create or replace function public.guard_professional_category()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.category_slug is distinct from old.category_slug
     and old.kyc_status not in ('draft', 'needs_fix') then
    raise exception 'A categoria só pode mudar antes de submeter o cadastro';
  end if;
  return new;
end;
$$;

create trigger guard_professional_category
  before update of category_slug on public.professional_profiles
  for each row execute function public.guard_professional_category();

drop policy "zonas do pro: gerir as próprias" on public.professional_zones;

create policy "zonas do pro: gerir as próprias"
  on public.professional_zones for all
  using (user_id = auth.uid() and public.my_kyc_status() in ('draft', 'needs_fix', 'approved'))
  with check (user_id = auth.uid() and public.my_kyc_status() in ('draft', 'needs_fix', 'approved'));

-- ---------------------------------------------------------------------------
-- Documentos: enviar e substituir só em rascunho/correcção
-- ---------------------------------------------------------------------------
drop policy "kyc: enviar os próprios" on public.kyc_documents;
drop policy "kyc: apagar os próprios pendentes" on public.kyc_documents;

create policy "kyc: enviar os próprios"
  on public.kyc_documents for insert
  with check (
    user_id = auth.uid()
    and status = 'pending'
    and storage_path like auth.uid()::text || '/%'
    and public.my_kyc_status() in ('draft', 'needs_fix')
  );

-- Os rejeitados também se podem apagar, para os substituir.
create policy "kyc: apagar os próprios pendentes ou rejeitados"
  on public.kyc_documents for delete
  using (
    user_id = auth.uid()
    and status in ('pending', 'rejected')
    and public.my_kyc_status() in ('draft', 'needs_fix')
  );

drop policy "kyc storage: enviar para a própria pasta" on storage.objects;

create policy "kyc storage: enviar para a própria pasta"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'kyc-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.my_kyc_status() in ('draft', 'needs_fix')
  );

-- ---------------------------------------------------------------------------
-- Gravar o cadastro (web e app usam esta função)
-- ---------------------------------------------------------------------------

-- Nome, dados profissionais e zonas numa só transacção. Corre com os
-- privilégios de quem chama: a RLS e as colunas permitidas continuam a valer.
-- Depois de aprovado, o nome (verificado no BI) e a categoria ficam fixos.
create or replace function public.save_professional_profile(
  name text,
  category text,
  years integer,
  daily_rate integer,
  about text,
  zones integer[]
)
returns public.kyc_status
language plpgsql
security invoker
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  current_status public.kyc_status;
begin
  if uid is null then
    raise exception 'Sessão em falta';
  end if;
  if coalesce(char_length(trim(name)), 0) not between 3 and 120 then
    raise exception 'Escreve o teu nome completo';
  end if;
  if coalesce(cardinality(zones), 0) = 0 then
    raise exception 'Escolhe pelo menos uma zona';
  end if;

  select kyc_status into current_status from public.professional_profiles where user_id = uid;
  if current_status in ('submitted', 'in_review', 'rejected') then
    raise exception 'Não podes alterar os dados enquanto o cadastro está em análise';
  end if;

  if current_status is distinct from 'approved' then
    update public.profiles set full_name = regexp_replace(trim(name), '\s+', ' ', 'g') where id = uid;
  end if;

  if current_status is null then
    insert into public.professional_profiles (user_id, category_slug, bio, years_experience, daily_rate_kz)
    values (uid, category, nullif(trim(about), ''), years, daily_rate);
  else
    update public.professional_profiles p
    set category_slug = case when current_status = 'approved' then p.category_slug else category end,
        bio = nullif(trim(about), ''),
        years_experience = years,
        daily_rate_kz = daily_rate
    where p.user_id = uid;
  end if;

  delete from public.professional_zones where user_id = uid and zone_id <> all (zones);
  insert into public.professional_zones (user_id, zone_id)
  select uid, z from unnest(zones) as z
  on conflict do nothing;

  return coalesce(current_status, 'draft');
end;
$$;

-- ---------------------------------------------------------------------------
-- Fluxo do KYC (substitui as versões do Sprint 1)
-- ---------------------------------------------------------------------------

create or replace function public.submit_kyc()
returns public.kyc_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  pro public.professional_profiles;
  missing text[];
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
  if not exists (
    select 1 from public.profiles where id = pro.user_id and coalesce(trim(full_name), '') <> ''
  ) then
    raise exception 'Falta o nome completo';
  end if;
  if not exists (select 1 from public.professional_zones where user_id = pro.user_id) then
    raise exception 'Escolhe pelo menos uma zona de trabalho';
  end if;

  -- Documentos rejeitados não contam: têm de ser substituídos.
  select coalesce(array_agg(t::text), '{}') into missing
  from unnest(public.required_kyc_documents(pro.category_slug)) as t
  where not exists (
    select 1 from public.kyc_documents d
    where d.user_id = pro.user_id and d.type = t and d.status <> 'rejected'
  );

  if array_length(missing, 1) > 0 then
    raise exception 'Documentos em falta: %', array_to_string(missing, ', ');
  end if;

  update public.professional_profiles
  set kyc_status = 'submitted', kyc_submitted_at = now(), kyc_review_note = null, updated_at = now()
  where user_id = pro.user_id;

  insert into public.audit_log (actor_id, action, target_table, target_id)
  values (auth.uid(), 'kyc.submit', 'professional_profiles', pro.user_id::text);

  return 'submitted';
end;
$$;

-- O admin aceita ou rejeita um documento (rejeitar exige motivo).
create or replace function public.review_kyc_document(
  document_id uuid,
  decision public.kyc_document_status,
  note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  doc public.kyc_documents;
begin
  if not public.is_admin() then
    raise exception 'Apenas administradores';
  end if;
  if decision not in ('accepted', 'rejected') then
    raise exception 'Decisão inválida';
  end if;
  if decision = 'rejected' and coalesce(trim(note), '') = '' then
    raise exception 'Indica o motivo da rejeição';
  end if;

  select * into doc from public.kyc_documents where id = document_id;
  if not found then
    raise exception 'Documento não encontrado';
  end if;
  if (select kyc_status from public.professional_profiles where user_id = doc.user_id)
     not in ('submitted', 'in_review') then
    raise exception 'Este cadastro não está em revisão';
  end if;

  update public.kyc_documents
  set status = decision, reviewer_note = nullif(trim(note), ''), reviewed_by = auth.uid(), reviewed_at = now()
  where id = document_id;

  insert into public.audit_log (actor_id, action, target_table, target_id, meta)
  values (auth.uid(), 'kyc.document_review', 'kyc_documents', document_id::text,
          jsonb_build_object('decision', decision, 'note', note, 'professional_id', doc.user_id));
end;
$$;

-- O admin decide o cadastro.
--   submitted → in_review | needs_fix | approved | rejected
--   in_review → needs_fix | approved | rejected
--   approved  → rejected (suspensão)
-- Pedir correcção ou rejeitar exige motivo. Aprovar exige que nenhum
-- documento esteja rejeitado; os pendentes passam a aceites.
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
declare
  current_status public.kyc_status;
begin
  if not public.is_admin() then
    raise exception 'Apenas administradores';
  end if;

  select kyc_status into current_status
  from public.professional_profiles where user_id = professional_id;
  if not found then
    raise exception 'Profissional não encontrado';
  end if;

  if not (
    (current_status = 'submitted' and decision in ('in_review', 'needs_fix', 'approved', 'rejected'))
    or (current_status = 'in_review' and decision in ('needs_fix', 'approved', 'rejected'))
    or (current_status = 'approved' and decision = 'rejected')
  ) then
    raise exception 'Decisão inválida para o estado actual (%)', current_status;
  end if;
  if decision in ('needs_fix', 'rejected') and coalesce(trim(note), '') = '' then
    raise exception 'Indica o motivo';
  end if;

  if decision = 'approved' then
    if exists (
      select 1 from public.kyc_documents where user_id = professional_id and status = 'rejected'
    ) then
      raise exception 'Há documentos rejeitados: pede correcção em vez de aprovar';
    end if;
    update public.kyc_documents
    set status = 'accepted', reviewed_by = auth.uid(), reviewed_at = now()
    where user_id = professional_id and status = 'pending';
  end if;

  update public.professional_profiles
  set kyc_status = decision,
      kyc_reviewed_at = now(),
      kyc_review_note = nullif(trim(note), ''),
      is_public = (decision = 'approved'),
      updated_at = now()
  where user_id = professional_id;

  insert into public.audit_log (actor_id, action, target_table, target_id, meta)
  values (auth.uid(), 'kyc.review', 'professional_profiles', professional_id::text,
          jsonb_build_object('from', current_status, 'decision', decision, 'note', note));
end;
$$;

-- Regista que um admin abriu os documentos de um profissional.
create or replace function public.log_kyc_view(professional_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Apenas administradores';
  end if;
  insert into public.audit_log (actor_id, action, target_table, target_id)
  values (auth.uid(), 'kyc.view', 'professional_profiles', professional_id::text);
end;
$$;

-- Por omissão o PostgreSQL dá EXECUTE a PUBLIC; só utilizadores com sessão.
revoke execute on function public.submit_kyc() from public, anon;
revoke execute on function public.review_kyc(uuid, public.kyc_status, text) from public, anon;
revoke execute on function public.review_kyc_document(uuid, public.kyc_document_status, text) from public, anon;
revoke execute on function public.log_kyc_view(uuid) from public, anon;
revoke execute on function public.save_professional_profile(text, text, integer, integer, text, integer[]) from public, anon;
grant execute on function public.submit_kyc() to authenticated;
grant execute on function public.save_professional_profile(text, text, integer, integer, text, integer[]) to authenticated;
grant execute on function public.review_kyc(uuid, public.kyc_status, text) to authenticated;
grant execute on function public.review_kyc_document(uuid, public.kyc_document_status, text) to authenticated;
grant execute on function public.log_kyc_view(uuid) to authenticated;
