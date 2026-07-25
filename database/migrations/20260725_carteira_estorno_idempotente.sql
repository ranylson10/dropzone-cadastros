-- Rodada 20: estorno/chargeback idempotente dos créditos gerados por uma compra de vaga.
-- O saldo pode ficar negativo quando o recebedor já tiver sacado o valor; isso
-- registra a dívida corretamente e evita esconder o prejuízo financeiro.

begin;

create or replace function public.fn_carteira_estornar_credito(
  p_dono_tipo text,
  p_dono_id uuid,
  p_auth_user_id uuid,
  p_valor_centavos bigint,
  p_tipo text,
  p_descricao text,
  p_referencia_tipo text,
  p_referencia_id text,
  p_meta jsonb default '{}'::jsonb,
  p_criado_por uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_carteira public.sistema_carteiras%rowtype;
  v_saldo bigint;
begin
  if p_valor_centavos <= 0 then
    raise exception 'Valor de estorno inválido.';
  end if;
  if p_dono_tipo not in ('sistema', 'produtora', 'manager', 'vendedor', 'auth_user') then
    raise exception 'Tipo de carteira inválido.';
  end if;
  if p_dono_tipo <> 'sistema' and p_dono_id is null then
    raise exception 'Dono da carteira obrigatório.';
  end if;
  if nullif(trim(p_referencia_tipo), '') is null or nullif(trim(p_referencia_id), '') is null then
    raise exception 'Referência do estorno obrigatória.';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(concat_ws(':', p_referencia_tipo, p_referencia_id, p_tipo, 'debito'), 0)
  );

  if exists (
    select 1
    from public.sistema_carteira_lancamentos
    where referencia_tipo = p_referencia_tipo
      and referencia_id = p_referencia_id
      and tipo = p_tipo
      and direcao = 'debito'
  ) then
    return jsonb_build_object('skipped', true);
  end if;

  if p_dono_tipo = 'sistema' then
    select * into v_carteira
    from public.sistema_carteiras
    where dono_tipo = 'sistema'
    for update;
  else
    select * into v_carteira
    from public.sistema_carteiras
    where dono_tipo = p_dono_tipo and dono_id = p_dono_id
    for update;
  end if;

  if v_carteira.id is null or not v_carteira.ativo then
    raise exception 'Carteira não encontrada ou inativa.';
  end if;

  v_saldo := v_carteira.saldo_disponivel_centavos - p_valor_centavos;

  update public.sistema_carteiras
  set saldo_disponivel_centavos = v_saldo, updated_at = now()
  where id = v_carteira.id;

  insert into public.sistema_carteira_lancamentos (
    carteira_id, tipo, direcao, valor_centavos, saldo_apos_centavos,
    descricao, referencia_tipo, referencia_id, meta, criado_por
  ) values (
    v_carteira.id, p_tipo, 'debito', p_valor_centavos, v_saldo,
    p_descricao, p_referencia_tipo, p_referencia_id,
    coalesce(p_meta, '{}'::jsonb), p_criado_por
  );

  return jsonb_build_object(
    'skipped', false,
    'carteira_id', v_carteira.id,
    'saldo_disponivel_centavos', v_saldo
  );
end;
$$;

revoke all on function public.fn_carteira_estornar_credito(text, uuid, uuid, bigint, text, text, text, text, jsonb, uuid) from public, anon, authenticated;
grant execute on function public.fn_carteira_estornar_credito(text, uuid, uuid, bigint, text, text, text, text, jsonb, uuid) to service_role;

commit;
