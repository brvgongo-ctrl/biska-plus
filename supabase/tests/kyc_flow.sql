-- Testes das regras de segurança e do fluxo de cadastro (Sprint 1 + 2).
-- Correr com: pnpm test:db  (ver scripts/test-db.sh)
-- Cada bloco faz de conta que é um utilizador diferente, como o Supabase
-- faz com o JWT: papel "authenticated" + request.jwt.claim.sub.

\set ON_ERROR_STOP on
\set QUIET on
\pset tuples_only on
\o /dev/null

-- Auxiliares ----------------------------------------------------------------
create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(uid::text, ''), false);
  execute case when uid is null then 'set role anon' else 'set role authenticated' end;
end;
$$;

create function pg_temp.logout() returns void language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claim.sub', '', false);
end;
$$;

create function pg_temp.expect_error(stmt text, pattern text) returns void language plpgsql as $$
begin
  begin
    execute stmt;
  exception when others then
    if sqlerrm ilike '%' || pattern || '%' then
      return;
    end if;
    raise exception 'Erro inesperado em [%]: %', stmt, sqlerrm;
  end;
  raise exception 'Esperava o erro "%" em [%]', pattern, stmt;
end;
$$;

create function pg_temp.expect_rows(stmt text, expected int) returns void language plpgsql as $$
declare
  n int;
begin
  execute stmt;
  get diagnostics n = row_count;
  if n <> expected then
    raise exception 'Esperava % linha(s), afectou % em [%]', expected, n, stmt;
  end if;
end;
$$;

create function pg_temp.expect(ok boolean, what text) returns void language plpgsql as $$
begin
  if not coalesce(ok, false) then
    raise exception 'Falhou: %', what;
  end if;
end;
$$;


-- Utilizadores ---------------------------------------------------------------
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'admin@biska.ao', '{"full_name":"Ana Admin"}'),
  ('00000000-0000-0000-0000-0000000000b1', 'maria@biska.ao', '{"full_name":"Maria Luísa Costa"}'),
  ('00000000-0000-0000-0000-0000000000b2', 'joao@biska.ao', '{"full_name":"João"}'),
  ('00000000-0000-0000-0000-0000000000c1', 'cliente@biska.ao', '{"full_name":"Carlos Cliente"}');

update public.profiles set roles = array_append(roles, 'admin')
where id = '00000000-0000-0000-0000-00000000000a';

\echo '· perfis e papéis'
select pg_temp.login('00000000-0000-0000-0000-0000000000c1');
select pg_temp.expect_error($$update public.profiles set roles = '{admin}' where id = auth.uid()$$, 'permission denied');
select pg_temp.expect((select count(*) = 1 from public.profiles), 'cliente só vê o próprio perfil');
select pg_temp.logout();

\echo '· cadastro da Maria (babá: exige registo criminal)'
select pg_temp.login('00000000-0000-0000-0000-0000000000b1');
select pg_temp.expect_error(
  $$insert into public.professional_profiles (user_id, category_slug, kyc_status) values (auth.uid(), 'baba', 'approved')$$,
  'row-level security');
select pg_temp.expect_error($$select public.save_professional_profile('Maria', 'baba', 8, 15000, null, '{}')$$, 'zona');
select public.save_professional_profile(
  '  Maria   Luísa Costa ', 'baba', 8, 15000, 'Cuido de crianças há 8 anos.',
  (select array_agg(id) from public.zones where name in ('Kilamba', 'Talatona', 'Viana')));
select pg_temp.expect((select full_name = 'Maria Luísa Costa' from public.profiles where id = auth.uid()), 'nome limpo');
select pg_temp.expect((select count(*) = 3 from public.professional_zones where user_id = auth.uid()), 'três zonas');
select pg_temp.expect((select 'professional' = any (roles) from public.profiles where id = auth.uid()), 'ganha o papel professional');
select pg_temp.expect_error($$update public.professional_profiles set kyc_status = 'approved' where user_id = auth.uid()$$, 'permission denied');
select pg_temp.expect_error($$update public.professional_profiles set is_public = true where user_id = auth.uid()$$, 'permission denied');

select pg_temp.expect_error('select public.submit_kyc()', 'consentimento');
update public.professional_profiles set data_consent_at = now() where user_id = auth.uid();
select public.save_professional_profile(
  'Maria Luísa Costa', 'baba', 8, 15000, 'Cuido de crianças há 8 anos.',
  (select array_agg(id) from public.zones where name in ('Kilamba', 'Talatona')));
select pg_temp.expect((select count(*) = 2 from public.professional_zones where user_id = auth.uid()), 'zona retirada');

select pg_temp.expect_error(
  $$insert into public.kyc_documents (user_id, type, storage_path) values (auth.uid(), 'id_front', 'outra-pasta/bi.jpg')$$,
  'row-level security');
insert into public.kyc_documents (user_id, type, storage_path) values
  (auth.uid(), 'id_front', auth.uid() || '/id_front-1.jpg'),
  (auth.uid(), 'id_back', auth.uid() || '/id_back-1.jpg'),
  (auth.uid(), 'selfie', auth.uid() || '/selfie-1.jpg');
select pg_temp.expect_error('select public.submit_kyc()', 'criminal_record');
insert into public.kyc_documents (user_id, type, storage_path)
values (auth.uid(), 'criminal_record', auth.uid() || '/criminal_record-1.pdf');
insert into storage.objects (bucket_id, name) values ('kyc-documents', auth.uid() || '/selfie-1.jpg');

select pg_temp.expect(public.submit_kyc() = 'submitted', 'submete o cadastro');
select pg_temp.expect_error('select public.submit_kyc()', 'já foi submetido');

\echo '· durante a revisão nada muda'
select pg_temp.expect_rows($$update public.professional_profiles set bio = 'outra' where user_id = auth.uid()$$, 0);
select pg_temp.expect_rows($$delete from public.kyc_documents where user_id = auth.uid()$$, 0);
select pg_temp.expect_error(
  $$insert into public.kyc_documents (user_id, type, storage_path) values (auth.uid(), 'certificate', auth.uid() || '/x.pdf')$$,
  'row-level security');
select pg_temp.expect_error(
  $$insert into storage.objects (bucket_id, name) values ('kyc-documents', auth.uid() || '/y.jpg')$$,
  'row-level security');
select pg_temp.expect_rows($$delete from public.professional_zones where user_id = auth.uid()$$, 0);
select pg_temp.expect_error($$select public.save_professional_profile('Maria', 'baba', 1, 1, null, '{1}')$$, 'em análise');
select pg_temp.expect_error($$select public.review_kyc(auth.uid(), 'approved')$$, 'Apenas administradores');
select pg_temp.logout();

\echo '· outros não vêem os documentos'
select pg_temp.login('00000000-0000-0000-0000-0000000000c1');
select pg_temp.expect((select count(*) = 0 from public.kyc_documents), 'cliente não vê KYC');
select pg_temp.expect((select count(*) = 0 from storage.objects where bucket_id = 'kyc-documents'), 'cliente não vê ficheiros KYC');
select pg_temp.expect((select count(*) = 0 from public.public_professionals), 'ainda não é público');
select pg_temp.expect_error($$select public.log_kyc_view('00000000-0000-0000-0000-0000000000b1')$$, 'Apenas administradores');
select pg_temp.logout();

select pg_temp.login(null);
select pg_temp.expect_error('select public.submit_kyc()', 'permission denied');
select pg_temp.logout();

\echo '· admin revê: rejeita o registo criminal e pede correcção'
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select pg_temp.expect((select count(*) = 4 from public.kyc_documents), 'admin vê os documentos');
select public.log_kyc_view('00000000-0000-0000-0000-0000000000b1');
select public.review_kyc('00000000-0000-0000-0000-0000000000b1', 'in_review');
select pg_temp.expect_error(
  $$select public.review_kyc_document((select id from public.kyc_documents where type = 'criminal_record'), 'rejected')$$,
  'motivo');
select public.review_kyc_document((select id from public.kyc_documents where type = 'criminal_record'), 'rejected', 'Documento com mais de 90 dias');
select public.review_kyc_document((select id from public.kyc_documents where type = 'id_front'), 'accepted');
select pg_temp.expect_error($$select public.review_kyc('00000000-0000-0000-0000-0000000000b1', 'approved')$$, 'rejeitados');
select pg_temp.expect_error($$select public.review_kyc('00000000-0000-0000-0000-0000000000b1', 'needs_fix')$$, 'motivo');
select public.review_kyc('00000000-0000-0000-0000-0000000000b1', 'needs_fix', 'Envia um registo criminal recente.');
select pg_temp.expect_error(
  $$select public.review_kyc_document((select id from public.kyc_documents where type = 'selfie'), 'accepted')$$,
  'não está em revisão');
select pg_temp.logout();

\echo '· a Maria substitui o documento rejeitado e volta a submeter'
select pg_temp.login('00000000-0000-0000-0000-0000000000b1');
select pg_temp.expect(
  (select kyc_review_note = 'Envia um registo criminal recente.' from public.professional_profiles where user_id = auth.uid()),
  'vê o motivo do admin');
select pg_temp.expect_rows($$delete from public.kyc_documents where status = 'accepted'$$, 0);
select pg_temp.expect_error('select public.submit_kyc()', 'criminal_record');
select pg_temp.expect_rows($$delete from public.kyc_documents where status = 'rejected'$$, 1);
insert into public.kyc_documents (user_id, type, storage_path)
values (auth.uid(), 'criminal_record', auth.uid() || '/criminal_record-2.pdf');
select public.submit_kyc();
select pg_temp.expect(
  (select kyc_review_note is null from public.professional_profiles where user_id = auth.uid()),
  'motivo limpo ao submeter');
select pg_temp.logout();

\echo '· admin aprova'
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select public.review_kyc('00000000-0000-0000-0000-0000000000b1', 'approved');
select pg_temp.expect((select bool_and(status = 'accepted') from public.kyc_documents), 'pendentes passam a aceites');
select pg_temp.expect(
  (select array_agg(action order by id) = '{kyc.submit,kyc.view,kyc.review,kyc.document_review,kyc.document_review,kyc.review,kyc.submit,kyc.review}'
   from public.audit_log),
  'tudo registado em audit_log');
select pg_temp.logout();

\echo '· público vê "Maria C." e nada mais'
select pg_temp.login(null);
select pg_temp.expect((select display_name = 'Maria C.' from public.public_professionals), 'nome abreviado');
select pg_temp.expect((select count(*) = 0 from public.professional_profiles), 'anon não lê a tabela');
select pg_temp.logout();

\echo '· aprovada: edita a bio, não a categoria'
select pg_temp.login('00000000-0000-0000-0000-0000000000b1');
select pg_temp.expect_rows($$update public.professional_profiles set bio = 'Babá com 9 anos de experiência.' where user_id = auth.uid()$$, 1);
select public.save_professional_profile('Outro Nome', 'pintor', 9, 18000, 'Babá com 9 anos.', '{1}');
select pg_temp.expect(
  (select p.category_slug = 'baba' and pr.full_name = 'Maria Luísa Costa' and p.daily_rate_kz = 18000
   from public.professional_profiles p join public.profiles pr on pr.id = p.user_id where p.user_id = auth.uid()),
  'aprovada: nome e categoria fixos, preço actualizado');
select pg_temp.expect_error($$update public.professional_profiles set category_slug = 'pintor' where user_id = auth.uid()$$, 'categoria');
select pg_temp.logout();

\echo '· admin suspende'
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select pg_temp.expect_error($$select public.review_kyc('00000000-0000-0000-0000-0000000000b1', 'needs_fix', 'x')$$, 'estado actual');
select public.review_kyc('00000000-0000-0000-0000-0000000000b1', 'rejected', 'Queixas graves de clientes.');
select pg_temp.logout();
select pg_temp.login(null);
select pg_temp.expect((select count(*) = 0 from public.public_professionals), 'suspensa deixa de ser pública');
select pg_temp.logout();

\echo 'Todos os testes passaram.'
