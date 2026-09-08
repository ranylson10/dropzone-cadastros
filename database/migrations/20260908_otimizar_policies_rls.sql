begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

-- Preserve each predicate while forcing PostgreSQL to evaluate auth.uid()
-- once per statement instead of once per row.
do $$
declare
  item record;
  current_policy record;
  statement text;
begin
  for item in
    select *
    from (values
      ('campeonato_links_inscricao'::text, 'dz links inscricao leitura dono'::text),
      ('commerce_carrinho_itens', 'commerce_carrinho_itens_delete_own'),
      ('commerce_carrinho_itens', 'commerce_carrinho_itens_insert_own'),
      ('commerce_carrinho_itens', 'commerce_carrinho_itens_select_own'),
      ('commerce_carrinho_itens', 'commerce_carrinho_itens_update_own'),
      ('commerce_carrinhos', 'commerce_carrinhos_delete_own'),
      ('commerce_carrinhos', 'commerce_carrinhos_insert_own'),
      ('commerce_carrinhos', 'commerce_carrinhos_select_own'),
      ('commerce_carrinhos', 'commerce_carrinhos_update_own'),
      ('commerce_favoritos', 'commerce_favoritos_delete_own'),
      ('commerce_favoritos', 'commerce_favoritos_insert_own'),
      ('commerce_favoritos', 'commerce_favoritos_select_own'),
      ('equipe_formacao_historico', 'equipe_formacao_historico_select'),
      ('equipe_line_jogadores', 'equipe_line_jogadores_select'),
      ('equipes_perfis', 'dz profile owner read equipes'),
      ('inscricoes_jogadores', 'dz authenticated read inscricoes_jogadores')
    ) target(table_name, policy_name)
  loop
    select
      pg_get_expr(policy.polqual, policy.polrelid) as using_expression,
      pg_get_expr(policy.polwithcheck, policy.polrelid) as check_expression
    into current_policy
    from pg_policy policy
    join pg_class relation on relation.oid = policy.polrelid
    join pg_namespace namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relname = item.table_name
      and policy.polname = item.policy_name;

    if not found then
      raise exception 'Policy %.% was not found', item.table_name, item.policy_name;
    end if;

    if position('auth.uid()' in coalesce(current_policy.using_expression, '') || coalesce(current_policy.check_expression, '')) = 0 then
      raise exception 'Policy %.% no longer contains auth.uid()', item.table_name, item.policy_name;
    end if;

    statement := format('alter policy %I on public.%I', item.policy_name, item.table_name);
    if current_policy.using_expression is not null then
      statement := statement || format(
        ' using (%s)',
        replace(current_policy.using_expression, 'auth.uid()', '(select auth.uid())')
      );
    end if;
    if current_policy.check_expression is not null then
      statement := statement || format(
        ' with check (%s)',
        replace(current_policy.check_expression, 'auth.uid()', '(select auth.uid())')
      );
    end if;

    execute statement;
  end loop;
end
$$;

-- These policies intentionally admit internal database roles. Wrap the role
-- lookup in an init plan so it is not recalculated for every candidate row.
do $$
declare
  item record;
  predicate constant text := '(select coalesce(current_setting(''request.jwt.claim.role''::text, true), current_setting(''role''::text, true))) = any (array[''service_role''::text, ''supabase_admin''::text, ''postgres''::text])';
begin
  for item in
    select *
    from (values
      ('broadcast_campeonato_links'::text, 'broadcast_campeonato_links_service_all'::text),
      ('broadcast_live_sessions', 'broadcast_live_sessions_service_all'),
      ('broadcasts', 'broadcasts_service_all'),
      ('campeonato_cobranca', 'campeonato_cobranca_service_all'),
      ('campeonato_stream_keys', 'campeonato_stream_keys_service_all'),
      ('campeonato_stream_pack', 'campeonato_stream_pack_service_all'),
      ('campeonato_stream_scenes', 'campeonato_stream_scenes_service_all'),
      ('lili_reservas_slot', 'lili_reservas_slot_service_all'),
      ('sistema_carteira_lancamentos', 'sistema_carteira_lancamentos_service_all'),
      ('sistema_carteiras', 'sistema_carteiras_service_all'),
      ('sistema_comissoes', 'sistema_comissoes_service_all'),
      ('sistema_compras_vaga', 'sistema_compras_vaga_service_all'),
      ('sistema_pagamentos', 'sistema_pagamentos_service_all'),
      ('sistema_perfis_cobranca', 'sistema_perfis_cobranca_service_all'),
      ('sistema_precos', 'sistema_precos_service_all'),
      ('sistema_saques', 'sistema_saques_service_all'),
      ('sistema_vendas_assistidas', 'sistema_vendas_assistidas_service_all')
    ) target(table_name, policy_name)
  loop
    if not exists (
      select 1
      from pg_policies
      where schemaname = 'public'
        and tablename = item.table_name
        and policyname = item.policy_name
    ) then
      raise exception 'Policy %.% was not found', item.table_name, item.policy_name;
    end if;

    execute format(
      'alter policy %I on public.%I using (%s) with check (%s)',
      item.policy_name,
      item.table_name,
      predicate,
      predicate
    );
  end loop;
end
$$;

-- Authenticated users already have the broader non-deleted-row policies.
-- Keeping the public active-row policy only for anon removes duplicate work
-- without changing the rows visible to either role.
alter policy equipes_select_public on public.equipes to anon;
alter policy jogadores_select_public on public.jogadores to anon;
alter policy managers_select_public on public.managers to anon;
alter policy produtoras_select_public on public.produtoras to anon;

commit;
