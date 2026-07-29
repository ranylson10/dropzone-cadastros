-- DROPZONE — RODADA 3: INTEGRIDADE E CONTRATOS DE UPSERT
-- Somente leitura. Não altera tabelas nem dados.
-- Execute no SQL Editor do Supabase correto.
-- Copie apenas o JSON da coluna "integridade" para:
-- relatorios-testes/integridade-publicada.json

create or replace function pg_temp.dz_contract_check(p_table text, p_columns text[])
returns jsonb
language plpgsql
as $$
declare
  v_table_oid oid;
  v_missing text[] := array[]::text[];
  v_unique boolean := false;
  v_duplicates bigint := 0;
  v_col text;
  v_group_cols text;
  v_where_not_null text;
begin
  select to_regclass(format('public.%I', p_table)) into v_table_oid;
  if v_table_oid is null then
    return jsonb_build_object('table_name', p_table, 'columns', p_columns, 'table_exists', false, 'columns_exist', false, 'unique_exists', false, 'duplicate_groups', null);
  end if;

  foreach v_col in array p_columns loop
    if not exists (
      select 1 from pg_attribute
      where attrelid = v_table_oid and attname = v_col and attnum > 0 and not attisdropped
    ) then
      v_missing := array_append(v_missing, v_col);
    end if;
  end loop;

  if cardinality(v_missing) > 0 then
    return jsonb_build_object('table_name', p_table, 'columns', p_columns, 'table_exists', true, 'columns_exist', false, 'missing_columns', v_missing, 'unique_exists', false, 'duplicate_groups', null);
  end if;

  select exists (
    select 1
    from pg_index i
    where i.indrelid = v_table_oid
      and i.indisunique
      and i.indisvalid
      and i.indpred is null
      and i.indexprs is null
      and (
        select array_agg(a.attname::text order by a.attname::text)
        from unnest(i.indkey::smallint[]) k(attnum)
        join pg_attribute a on a.attrelid = i.indrelid and a.attnum = k.attnum
        where k.attnum > 0
      ) = (
        select array_agg(x order by x) from unnest(p_columns) x
      )
  ) into v_unique;

  select string_agg(format('%I', x), ', '), string_agg(format('%I is not null', x), ' and ')
    into v_group_cols, v_where_not_null
  from unnest(p_columns) x;

  execute format(
    'select count(*) from (select %s from public.%I where %s group by %s having count(*) > 1) d',
    v_group_cols, p_table, v_where_not_null, v_group_cols
  ) into v_duplicates;

  return jsonb_build_object(
    'table_name', p_table,
    'columns', p_columns,
    'table_exists', true,
    'columns_exist', true,
    'missing_columns', '[]'::jsonb,
    'unique_exists', v_unique,
    'duplicate_groups', v_duplicates
  );
end;
$$;

with expected(table_name, columns) as (
  values
    ('campeonato_cobranca', array['campeonato_id']::text[]),
    ('sistema_pagamentos', array['external_reference']::text[]),
    ('campeonato_resultados_equipes', array['partida_id','campeonato_equipe_id']::text[]),
    ('campeonato_resultados_jogadores', array['partida_id','campeonato_jogador_id']::text[]),
    ('campeonato_configuracoes', array['campeonato_id']::text[]),
    ('sistema_restricoes_conta', array['auth_user_id']::text[]),
    ('campeonato_export_overrides', array['campeonato_id']::text[]),
    ('campeonato_stream_pack', array['campeonato_id']::text[]),
    ('produtora_vendedores', array['produtora_id','manager_id']::text[]),
    ('campeonato_vendedores', array['token']::text[]),
    ('broadcast_campeonato_links', array['broadcast_id','campeonato_id']::text[]),
    ('stream_overlay_entitlements', array['catalog_id','user_id']::text[])
), checks as (
  select pg_temp.dz_contract_check(table_name, columns) as item from expected
), invalid_constraints as (
  select jsonb_agg(jsonb_build_object(
    'table_name', cls.relname,
    'constraint_name', con.conname,
    'constraint_type', con.contype,
    'definition', pg_get_constraintdef(con.oid)
  ) order by cls.relname, con.conname) as items
  from pg_constraint con
  join pg_class cls on cls.oid = con.conrelid
  join pg_namespace ns on ns.oid = cls.relnamespace
  where ns.nspname = 'public'
    and con.contype in ('p','u','f','c')
    and con.convalidated = false
)
select jsonb_build_object(
  'generated_at', now(),
  'contracts', coalesce((select jsonb_agg(item order by item->>'table_name', item->>'columns') from checks), '[]'::jsonb),
  'invalid_constraints', coalesce((select items from invalid_constraints), '[]'::jsonb)
) as integridade;
