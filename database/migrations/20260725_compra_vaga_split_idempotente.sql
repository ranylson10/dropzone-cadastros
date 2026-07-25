-- Rodada 19 — proteção contra webhooks duplicados e processamento concorrente.
-- Garante que o split financeiro de uma compra de vaga seja executado uma única vez,
-- mesmo quando ASAAS/PayPal reenviam o mesmo evento ou o polling confirma ao mesmo tempo.

alter table public.sistema_compras_vaga
  add column if not exists split_processando_em timestamptz,
  add column if not exists split_processado_em timestamptz;

create or replace function public.fn_claim_compra_vaga_split(p_compra_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_claimed boolean := false;
begin
  update public.sistema_compras_vaga
     set split_processando_em = now(),
         updated_at = now()
   where id = p_compra_id
     and status in ('pago', 'liberado', 'consumido')
     and split_processado_em is null
     and (
       split_processando_em is null
       or split_processando_em < now() - interval '5 minutes'
     );

  v_claimed := found;
  return v_claimed;
end;
$function$;

create or replace function public.fn_finish_compra_vaga_split(p_compra_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $function$
begin
  update public.sistema_compras_vaga
     set split_processado_em = coalesce(split_processado_em, now()),
         split_processando_em = null,
         updated_at = now()
   where id = p_compra_id;
end;
$function$;

create or replace function public.fn_release_compra_vaga_split_claim(p_compra_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $function$
begin
  update public.sistema_compras_vaga
     set split_processando_em = null,
         updated_at = now()
   where id = p_compra_id
     and split_processado_em is null;
end;
$function$;

revoke all on function public.fn_claim_compra_vaga_split(uuid) from public, anon, authenticated;
revoke all on function public.fn_finish_compra_vaga_split(uuid) from public, anon, authenticated;
revoke all on function public.fn_release_compra_vaga_split_claim(uuid) from public, anon, authenticated;

grant execute on function public.fn_claim_compra_vaga_split(uuid) to service_role;
grant execute on function public.fn_finish_compra_vaga_split(uuid) to service_role;
grant execute on function public.fn_release_compra_vaga_split_claim(uuid) to service_role;

comment on column public.sistema_compras_vaga.split_processado_em is
  'Data em que o split financeiro da compra foi concluído. Usado para idempotência de webhook/polling.';
