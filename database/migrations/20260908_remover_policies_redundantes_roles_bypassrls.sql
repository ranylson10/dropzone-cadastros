begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $$
begin
  if exists (
    select 1
    from pg_roles
    where rolname in ('service_role', 'supabase_admin', 'postgres')
      and not rolbypassrls
  ) or (
    select count(*)
    from pg_roles
    where rolname in ('service_role', 'supabase_admin', 'postgres')
      and rolbypassrls
  ) <> 3 then
    raise exception 'Expected internal roles to exist with BYPASSRLS before removing redundant policies';
  end if;
end
$$;

drop policy broadcast_campeonato_links_service_all on public.broadcast_campeonato_links;
drop policy broadcast_live_sessions_service_all on public.broadcast_live_sessions;
drop policy broadcasts_service_all on public.broadcasts;
drop policy campeonato_cobranca_service_all on public.campeonato_cobranca;
drop policy campeonato_stream_keys_service_all on public.campeonato_stream_keys;
drop policy campeonato_stream_pack_service_all on public.campeonato_stream_pack;
drop policy campeonato_stream_scenes_service_all on public.campeonato_stream_scenes;
drop policy lili_reservas_slot_service_all on public.lili_reservas_slot;
drop policy sistema_carteira_lancamentos_service_all on public.sistema_carteira_lancamentos;
drop policy sistema_carteiras_service_all on public.sistema_carteiras;
drop policy sistema_comissoes_service_all on public.sistema_comissoes;
drop policy sistema_compras_vaga_service_all on public.sistema_compras_vaga;
drop policy sistema_pagamentos_service_all on public.sistema_pagamentos;
drop policy sistema_perfis_cobranca_service_all on public.sistema_perfis_cobranca;
drop policy sistema_precos_service_all on public.sistema_precos;
drop policy sistema_saques_service_all on public.sistema_saques;
drop policy sistema_vendas_assistidas_service_all on public.sistema_vendas_assistidas;

commit;
