-- ============================================================================
-- VALIDAÇÃO COMPLETA — tudo em TABELA de resultado (Supabase-friendly)
-- ============================================================================
-- 1) Abra Downloads\validacao-completa-slot-modelo.sql
-- 2) Cole no SQL Editor e Run
-- 3) Navegue nas abas de resultado (A*, depois B*, depois C*)
--
-- Parte B cria dados de teste e APAGA no final (não deixa lixo).
-- ============================================================================

-- ###########################################################################
-- A) INTEGRIDADE
-- ###########################################################################

select 'A01 legado campeonato_vagas' as teste,
  case when to_regclass('public.campeonato_vagas') is null then 'OK' else 'FALHOU' end as status;

select 'A02 tokens.vaga_id removido' as teste,
  case when not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='tokens' and column_name='vaga_id'
  ) then 'OK' else 'FALHOU' end as status;

select 'A03 equipes.vaga_id removido' as teste,
  case when not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='campeonato_equipes' and column_name='vaga_id'
  ) then 'OK' else 'FALHOU' end as status;

select 'A04 colunas canônicas' as teste,
  case when
    exists (select 1 from information_schema.columns where table_schema='public' and table_name='campeonato_equipes' and column_name='slot_id')
    and exists (select 1 from information_schema.columns where table_schema='public' and table_name='tokens' and column_name='slot_id')
    and exists (select 1 from information_schema.columns where table_schema='public' and table_name='campeonato_configuracoes' and column_name='numero_vagas')
  then 'OK' else 'FALHOU' end as status;

select 'A05 views' as teste,
  case when to_regclass('public.vw_campeonato_slots_lines') is not null
    and to_regclass('public.vw_campeonato_capacidade') is not null
  then 'OK' else 'FALHOU' end as status;

select 'A06 funções' as teste,
  case when to_regprocedure('public.fn_campeonato_limite_vagas(uuid)') is not null
    and to_regprocedure('public.fn_campeonato_slots_criados(uuid)') is not null
    and to_regprocedure('public.fn_campeonato_slots_ocupados(uuid)') is not null
  then 'OK' else 'FALHOU' end as status;

select 'A07 triggers' as teste,
  case when exists (select 1 from pg_trigger where tgname='trg_enforce_limite_ao_criar_slot' and not tgisinternal)
    and exists (select 1 from pg_trigger where tgname='trg_sync_slot_reserva_from_token' and not tgisinternal)
  then 'OK' else 'FALHOU' end as status;

select 'A08 parts ativas sem slot' as teste,
  case when count(*) = 0 then 'OK (0)' else 'ATENCAO (' || count(*)::text || ')' end as status
from public.campeonato_equipes
where status = 'ativo' and slot_id is null;

select 'A09 slots status inválido' as teste,
  case when count(*) = 0 then 'OK' else 'FALHOU (' || count(*)::text || ')' end as status
from public.campeonato_slots
where coalesce(status,'') not in ('livre','reservado','ocupado');

select 'A10 slot_id órfão' as teste,
  case when count(*) = 0 then 'OK' else 'FALHOU (' || count(*)::text || ')' end as status
from public.campeonato_equipes p
left join public.campeonato_slots s on s.id = p.slot_id
where p.status = 'ativo' and p.slot_id is not null and s.id is null;

select 'A11 espelho line divergente' as teste,
  case when count(*) = 0 then 'OK' else 'ATENCAO (' || count(*)::text || ')' end as status
from public.campeonato_equipes p
join public.campeonato_slots s on s.id = p.slot_id
where p.status = 'ativo'
  and p.line_id is not null
  and s.line_id is not null
  and s.line_id is distinct from p.line_id;

select 'A12 criados > limite' as teste,
  case when count(*) = 0 then 'OK' else 'FALHOU (' || count(*)::text || ')' end as status
from public.vw_campeonato_capacidade
where limite_vagas is not null and slots_criados > limite_vagas;

select 'A13 ocupados > limite' as teste,
  case when count(*) = 0 then 'OK' else 'FALHOU (' || count(*)::text || ')' end as status
from public.vw_campeonato_capacidade
where limite_vagas is not null and slots_ocupados > limite_vagas;

select
  'A14 painel capacidade' as secao,
  campeonato_nome,
  limite_vagas,
  slots_criados,
  slots_ocupados,
  slots_reservados,
  slots_livres
from public.vw_campeonato_capacidade
order by campeonato_nome
limit 20;

select
  'A15 contagens' as secao,
  (select count(*) from public.campeonatos where deleted_at is null) as campeonatos,
  (select count(*) from public.campeonato_slots) as slots,
  (select count(*) from public.campeonato_equipes where status = 'ativo') as parts_ativas,
  (select count(*) from public.campeonato_equipes where status = 'ativo' and slot_id is null) as parts_sem_slot;

-- ###########################################################################
-- B) INSERT / UPDATE / DELETE — limpa no final, log em tabela
-- ###########################################################################

drop table if exists _val_log;
create temporary table _val_log (
  ordem serial primary key,
  teste text,
  status text
);

do $$
declare
  v_camp uuid;
  v_camp_nome text;
  v_auth uuid;
  v_fase uuid;
  v_grupo uuid;
  v_slot uuid;
  v_slot2 uuid;
  v_equipe uuid;
  v_line uuid;
  v_line2 uuid;
  v_part uuid;
  v_token text;
  v_token_id uuid;
  v_limite integer;
  v_criados integer;
  v_status text;
  v_created_equipe boolean := false;
begin
  select c.id, c.nome, c.criado_por
    into v_camp, v_camp_nome, v_auth
  from public.campeonatos c
  where c.deleted_at is null
    and exists (select 1 from public.campeonato_slots s where s.campeonato_id = c.id)
  order by c.created_at desc nulls last
  limit 1;

  if v_camp is null then
    insert into _val_log(teste, status) values ('B00', 'PULADO: nenhum campeonato com slots');
    return;
  end if;

  insert into _val_log(teste, status)
  values ('B00 campeonato', coalesce(v_camp_nome,'?') || ' | ' || v_camp::text);

  -- B01 fase
  insert into public.campeonato_fases (campeonato_id, nome, ordem, status)
  values (v_camp, '__TESTE_VALIDACAO_FASE__', 999, 'ativo')
  returning id into v_fase;
  insert into _val_log(teste, status) values ('B01 INSERT fase', 'OK');

  v_limite := public.fn_campeonato_limite_vagas(v_camp);
  v_criados := public.fn_campeonato_slots_criados(v_camp);

  if v_limite is not null and v_criados + 2 > v_limite then
    insert into _val_log(teste, status)
    values ('B02', 'PULADO limite (criados=' || v_criados || ', limite=' || v_limite || ')');
    delete from public.campeonato_fases where id = v_fase;
    insert into _val_log(teste, status) values ('B99 limpeza', 'OK');
    return;
  end if;

  -- B02 grupo
  insert into public.campeonato_grupos (campeonato_id, fase_id, nome, slots)
  values (v_camp, v_fase, '__TESTE_VALIDACAO_GRUPO__', 2)
  returning id into v_grupo;
  insert into _val_log(teste, status) values ('B02 INSERT grupo', 'OK');

  -- B03 slots
  insert into public.campeonato_slots (campeonato_id, fase_id, grupo_id, slot_numero, slot_letra, status)
  values (v_camp, v_fase, v_grupo, 1, 'ZZ', 'livre')
  returning id into v_slot;

  insert into public.campeonato_slots (campeonato_id, fase_id, grupo_id, slot_numero, slot_letra, status)
  values (v_camp, v_fase, v_grupo, 2, 'ZY', 'livre')
  returning id into v_slot2;
  insert into _val_log(teste, status) values ('B03 INSERT slots', 'OK');

  -- B04 update
  update public.campeonato_slots set slot_letra = 'ZX', updated_at = now() where id = v_slot2;
  select slot_letra into strict v_status from public.campeonato_slots where id = v_slot2;
  if v_status = 'ZX' then
    insert into _val_log(teste, status) values ('B04 UPDATE slot_letra', 'OK');
  else
    insert into _val_log(teste, status) values ('B04 UPDATE slot_letra', 'FALHOU');
  end if;

  -- B05 equipe
  select id into v_equipe from public.equipes where status = 'ativo' order by created_at desc nulls last limit 1;
  if v_equipe is null then
    insert into public.equipes (nome, tag, status) values ('__TESTE_EQUIPE__', 'TST', 'ativo')
    returning id into v_equipe;
    v_created_equipe := true;
    insert into _val_log(teste, status) values ('B05 INSERT equipe', 'OK');
  else
    insert into _val_log(teste, status) values ('B05 reutiliza equipe', 'OK');
  end if;

  -- B06 lines
  insert into public.equipe_lines (equipe_id, nome, tag, status)
  values (v_equipe, '__TESTE_LINE_A__', 'TLA', 'ativo') returning id into v_line;
  insert into public.equipe_lines (equipe_id, nome, tag, status)
  values (v_equipe, '__TESTE_LINE_B__', 'TLB', 'ativo') returning id into v_line2;
  insert into _val_log(teste, status) values ('B06 INSERT lines', 'OK');

  -- B07 participação
  insert into public.campeonato_equipes (
    campeonato_id, equipe_id, line_id, slot_id, grupo_id, slot_numero,
    nome_exibicao, origem_entrada, status
  ) values (
    v_camp, v_equipe, v_line, v_slot, v_grupo, 1,
    '__TESTE_LINE_A__', 'organizador', 'ativo'
  ) returning id into v_part;

  update public.campeonato_slots
     set equipe_id = v_equipe, line_id = v_line, status = 'ocupado', updated_at = now()
   where id = v_slot;
  insert into _val_log(teste, status) values ('B07 INSERT part + ocupar slot', 'OK');

  -- B08 unique line
  begin
    insert into public.campeonato_equipes (
      campeonato_id, equipe_id, line_id, slot_id, grupo_id, slot_numero,
      nome_exibicao, origem_entrada, status
    ) values (v_camp, v_equipe, v_line, v_slot2, v_grupo, 2, 'DUP', 'organizador', 'ativo');
    insert into _val_log(teste, status) values ('B08 UNIQUE line', 'FALHOU: duplicou');
  exception when unique_violation then
    insert into _val_log(teste, status) values ('B08 UNIQUE line bloqueia', 'OK');
  end;

  -- B09 unique slot
  begin
    insert into public.campeonato_equipes (
      campeonato_id, equipe_id, line_id, slot_id, grupo_id, slot_numero,
      nome_exibicao, origem_entrada, status
    ) values (v_camp, v_equipe, v_line2, v_slot, v_grupo, 1, 'DUP SLOT', 'organizador', 'ativo');
    insert into _val_log(teste, status) values ('B09 UNIQUE slot', 'FALHOU: duplicou');
  exception when unique_violation then
    insert into _val_log(teste, status) values ('B09 UNIQUE slot bloqueia', 'OK');
  end;

  -- B10 token
  if v_auth is null then
    insert into _val_log(teste, status) values ('B10 INSERT token', 'PULADO sem criado_por');
  else
    v_token := 'TESTTOK' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 16);
    insert into public.tokens (
      token, tipo, campeonato_id, fase_id, grupo_id, slot_id,
      nome_equipe_reservada, nome_line_reservada,
      criado_por, usado, status, expira_em
    ) values (
      v_token, 'convite_equipe_campeonato', v_camp, v_fase, v_grupo, v_slot2,
      'REF EQ', 'REF LINE', v_auth, false, 'ativo', now() + interval '1 day'
    ) returning id into v_token_id;
    insert into _val_log(teste, status) values ('B10 INSERT token', 'OK');
  end if;

  -- B11 view
  select status_ui into v_status from public.vw_campeonato_slots_lines where slot_id = v_slot limit 1;
  if v_status = 'ocupada' then
    insert into _val_log(teste, status) values ('B11 view ocupada', 'OK');
  else
    insert into _val_log(teste, status) values ('B11 view ocupada', 'ATENCAO: ' || coalesce(v_status,'null'));
  end if;

  -- B12 soft-remove
  update public.campeonato_equipes
     set status = 'removido', slot_id = null, grupo_id = null, slot_numero = null, updated_at = now()
   where id = v_part;
  update public.campeonato_slots
     set equipe_id = null, line_id = null, status = 'livre', updated_at = now()
   where id = v_slot;
  insert into _val_log(teste, status) values ('B12 soft-remove + liberar', 'OK');

  -- B13 cancel token
  if v_token_id is not null then
    update public.tokens set status = 'cancelado' where id = v_token_id;
    insert into _val_log(teste, status) values ('B13 cancelar token', 'OK');
  end if;

  -- B14 update grupo
  update public.campeonato_grupos set nome = '__TESTE_GRUPO_EDIT__' where id = v_grupo;
  insert into _val_log(teste, status) values ('B14 UPDATE grupo', 'OK');

  -- B15 DELETE tudo do teste (ordem correta de FK)
  delete from public.campeonato_equipes where id = v_part;
  if v_token_id is not null then
    delete from public.tokens where id = v_token_id;
  end if;
  delete from public.campeonato_slots where id in (v_slot, v_slot2);
  delete from public.campeonato_grupos where id = v_grupo;
  delete from public.campeonato_fases where id = v_fase;
  delete from public.equipe_lines where id in (v_line, v_line2);
  if v_created_equipe then
    delete from public.equipes where id = v_equipe;
  end if;
  insert into _val_log(teste, status) values ('B15 DELETE limpeza completa', 'OK');

  insert into _val_log(teste, status) values ('B99', 'OK — insert/update/delete funcionaram e lixo foi removido');

exception when others then
  -- tenta limpar restos se quebrou no meio
  begin
    if v_part is not null then delete from public.campeonato_equipes where id = v_part; end if;
    if v_token_id is not null then delete from public.tokens where id = v_token_id; end if;
    if v_grupo is not null then
      delete from public.campeonato_slots where grupo_id = v_grupo;
      delete from public.campeonato_grupos where id = v_grupo;
    end if;
    if v_fase is not null then delete from public.campeonato_fases where id = v_fase; end if;
    if v_line is not null then delete from public.equipe_lines where id = v_line; end if;
    if v_line2 is not null then delete from public.equipe_lines where id = v_line2; end if;
    if v_created_equipe and v_equipe is not null then delete from public.equipes where id = v_equipe; end if;
  exception when others then
    null;
  end;
  insert into _val_log(teste, status) values ('B99 FALHOU', sqlstate || ' | ' || sqlerrm);
end $$;

-- >>> ESTA é a tabela principal da parte B — abra esta aba de resultado
select ordem, teste, status from _val_log order by ordem;

-- ###########################################################################
-- C) RESUMO
-- ###########################################################################
select
  'C01 RESUMO FINAL' as teste,
  jsonb_build_object(
    'campeonato_vagas_existe', to_regclass('public.campeonato_vagas') is not null,
    'view_slots', to_regclass('public.vw_campeonato_slots_lines') is not null,
    'view_capacidade', to_regclass('public.vw_campeonato_capacidade') is not null,
    'parts_ativas_sem_slot', (select count(*) from public.campeonato_equipes where status='ativo' and slot_id is null),
    'slots_total', (select count(*) from public.campeonato_slots),
    'parts_ativas', (select count(*) from public.campeonato_equipes where status='ativo')
  )::text as status;
