-- Funções internas da projeção de agenda são acionadas por triggers. Elas não
-- fazem parte da API RPC pública e não devem aceitar chamadas de clientes.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

revoke execute on function public.sync_agenda_compromissos_jogo(uuid) from public, anon, authenticated;
revoke execute on function public.trg_rebuild_agenda_campeonato() from public, anon, authenticated;
revoke execute on function public.trg_sync_agenda_jogo() from public, anon, authenticated;

grant execute on function public.sync_agenda_compromissos_jogo(uuid) to service_role;
grant execute on function public.trg_rebuild_agenda_campeonato() to service_role;
grant execute on function public.trg_sync_agenda_jogo() to service_role;

commit;
