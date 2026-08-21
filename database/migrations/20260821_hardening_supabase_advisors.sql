-- Hardening do banco publicado após auditoria SQL (Somente permissões/metadados).
-- Mantém acesso do backend via service_role e elimina execução direta por anon/authenticated.

begin;

-- As APIs do projeto executam RPCs pelo backend; clientes não usam RPC diretamente.
-- Evita que funções de trigger e funções administrativas fiquem expostas em /rest/v1/rpc.
revoke all on all functions in schema public from public, anon, authenticated;
grant execute on all functions in schema public to service_role;

-- Views de operação são consultadas pelo backend. Como invoker, passam a obedecer
-- os privilégios e o RLS de quem as consulta, sem herdar o dono da view.
alter view public.campeonato_classificacao_mvp set (security_invoker = true);
alter view public.campeonato_classificacao_lines set (security_invoker = true);
alter view public.campeonato_partidas_com_mapa set (security_invoker = true);
alter view public.campeonato_estatisticas_equipes_detalhe set (security_invoker = true);
alter view public.campeonato_estatisticas_mvp_detalhe set (security_invoker = true);
alter view public.campeonato_pontuador_slots_jogo set (security_invoker = true);
alter view public.campeonato_pontuador_jogadores_jogo set (security_invoker = true);
alter view public.campeonato_classificacao_equipes_pontuador set (security_invoker = true);
alter view public.campeonato_pontuador_equipes_matriz set (security_invoker = true);
alter view public.vw_campeonato_capacidade set (security_invoker = true);
alter view public.campeonato_escalacoes_resumo set (security_invoker = true);
alter view public.vw_campeonato_slots_lines set (security_invoker = true);
alter view public.vw_campeonato_permissoes_vendedores set (security_invoker = true);

-- Fixa search_path de qualquer função pública ainda dependente do path de sessão.
do $$
declare
  item record;
begin
  for item in
    select p.oid, p.proname, pg_get_function_identity_arguments(p.oid) as arguments
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and coalesce(array_to_string(p.proconfig, ','), '') not ilike '%search_path=%'
  loop
    execute format(
      'alter function public.%I(%s) set search_path = public, extensions, pg_temp',
      item.proname,
      item.arguments
    );
  end loop;
end;
$$;

-- A auditoria confirmou que não há linha antiga em desacordo com a regra.
alter table public.equipe_jogadores validate constraint equipe_jogadores_identidade_check;

commit;
