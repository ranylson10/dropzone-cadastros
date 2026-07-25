-- Novas reservas comerciais de compra de vaga expiram em 2 minutos.
-- Não altera compras existentes e não apaga dados.
alter table public.sistema_compras_vaga
  alter column expira_em set default (now() + interval '2 minutes');
