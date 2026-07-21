-- Carteira e saques: operações financeiras atômicas e idempotentes.
-- Aplicar antes de publicar o backend que chama estas RPCs.

begin;

create or replace function public.fn_carteira_creditar(
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
    raise exception 'Valor de crédito inválido.';
  end if;
  if p_dono_tipo not in ('sistema', 'produtora', 'manager', 'vendedor', 'auth_user') then
    raise exception 'Tipo de carteira inválido.';
  end if;
  if p_dono_tipo <> 'sistema' and p_dono_id is null then
    raise exception 'Dono da carteira obrigatório.';
  end if;
  if nullif(trim(p_referencia_tipo), '') is null or nullif(trim(p_referencia_id), '') is null then
    raise exception 'Referência do crédito obrigatória.';
  end if;

  -- Serializa créditos da mesma referência, inclusive antes de existir lançamento.
  perform pg_advisory_xact_lock(
    hashtextextended(concat_ws(':', p_referencia_tipo, p_referencia_id, p_tipo, 'credito'), 0)
  );

  if exists (
    select 1
    from public.sistema_carteira_lancamentos
    where referencia_tipo = p_referencia_tipo
      and referencia_id = p_referencia_id
      and tipo = p_tipo
      and direcao = 'credito'
  ) then
    return jsonb_build_object('skipped', true);
  end if;

  if p_dono_tipo = 'sistema' then
    insert into public.sistema_carteiras (dono_tipo, dono_id, auth_user_id)
    values ('sistema', null, null)
    on conflict (dono_tipo) where dono_tipo = 'sistema' do nothing;

    select * into v_carteira
    from public.sistema_carteiras
    where dono_tipo = 'sistema'
    for update;
  else
    insert into public.sistema_carteiras (dono_tipo, dono_id, auth_user_id)
    values (p_dono_tipo, p_dono_id, p_auth_user_id)
    on conflict (dono_tipo, dono_id) where dono_id is not null do nothing;

    select * into v_carteira
    from public.sistema_carteiras
    where dono_tipo = p_dono_tipo and dono_id = p_dono_id
    for update;
  end if;

  if v_carteira.id is null or not v_carteira.ativo then
    raise exception 'Carteira não encontrada ou inativa.';
  end if;

  v_saldo := v_carteira.saldo_disponivel_centavos + p_valor_centavos;

  update public.sistema_carteiras
  set saldo_disponivel_centavos = v_saldo, updated_at = now()
  where id = v_carteira.id;

  insert into public.sistema_carteira_lancamentos (
    carteira_id, tipo, direcao, valor_centavos, saldo_apos_centavos,
    descricao, referencia_tipo, referencia_id, meta, criado_por
  ) values (
    v_carteira.id, p_tipo, 'credito', p_valor_centavos, v_saldo,
    p_descricao, p_referencia_tipo, p_referencia_id, coalesce(p_meta, '{}'::jsonb), p_criado_por
  );

  return jsonb_build_object(
    'skipped', false,
    'carteira_id', v_carteira.id,
    'saldo_disponivel_centavos', v_saldo
  );
end;
$$;

create or replace function public.fn_solicitar_saque(
  p_carteira_id uuid,
  p_auth_user_id uuid,
  p_valor_centavos integer,
  p_pix_chave text,
  p_pix_tipo text,
  p_titular_nome text default null
)
returns public.sistema_saques
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_carteira public.sistema_carteiras%rowtype;
  v_saque public.sistema_saques%rowtype;
  v_saldo bigint;
begin
  if p_valor_centavos < 1000 then
    raise exception 'Valor mínimo para saque: R$ 10,00.';
  end if;
  if nullif(trim(p_pix_chave), '') is null or length(trim(p_pix_chave)) < 5 then
    raise exception 'Chave PIX inválida.';
  end if;
  if p_pix_tipo not in ('cpf', 'cnpj', 'email', 'telefone', 'aleatoria') then
    raise exception 'Tipo de chave PIX inválido.';
  end if;

  select * into v_carteira
  from public.sistema_carteiras
  where id = p_carteira_id
  for update;

  if v_carteira.id is null or not v_carteira.ativo then
    raise exception 'Carteira não encontrada ou inativa.';
  end if;
  if v_carteira.auth_user_id is distinct from p_auth_user_id then
    raise exception 'Sem permissão para sacar desta carteira.';
  end if;
  if v_carteira.saldo_disponivel_centavos < p_valor_centavos then
    raise exception 'Saldo insuficiente.';
  end if;

  v_saldo := v_carteira.saldo_disponivel_centavos - p_valor_centavos;

  insert into public.sistema_saques (
    carteira_id, auth_user_id, valor_centavos, status,
    pix_chave, pix_tipo, titular_nome
  ) values (
    p_carteira_id, p_auth_user_id, p_valor_centavos, 'solicitado',
    trim(p_pix_chave), p_pix_tipo, nullif(trim(p_titular_nome), '')
  ) returning * into v_saque;

  update public.sistema_carteiras
  set saldo_disponivel_centavos = v_saldo, updated_at = now()
  where id = p_carteira_id;

  insert into public.sistema_carteira_lancamentos (
    carteira_id, tipo, direcao, valor_centavos, saldo_apos_centavos,
    descricao, referencia_tipo, referencia_id, criado_por
  ) values (
    p_carteira_id, 'debito_saque', 'debito', p_valor_centavos, v_saldo,
    'Saque solicitado', 'saque', v_saque.id::text, p_auth_user_id
  );

  return v_saque;
end;
$$;

create or replace function public.fn_atualizar_status_saque(
  p_saque_id uuid,
  p_novo_status text,
  p_admin_auth_user_id uuid,
  p_motivo text default null
)
returns public.sistema_saques
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_saque public.sistema_saques%rowtype;
  v_carteira public.sistema_carteiras%rowtype;
  v_saldo bigint;
begin
  if not exists (
    select 1 from public.sistema_administradores
    where auth_user_id = p_admin_auth_user_id and status = 'ativo'
  ) then
    raise exception 'Acesso restrito a administradores.';
  end if;

  select * into v_saque
  from public.sistema_saques
  where id = p_saque_id
  for update;

  if v_saque.id is null then
    raise exception 'Saque não encontrado.';
  end if;
  if v_saque.status in ('pago', 'rejeitado', 'cancelado') then
    raise exception 'Este saque já está finalizado.';
  end if;

  if not (
    (v_saque.status = 'solicitado' and p_novo_status in ('em_analise', 'rejeitado', 'cancelado'))
    or (v_saque.status = 'em_analise' and p_novo_status in ('aprovado', 'rejeitado', 'cancelado'))
    or (v_saque.status = 'aprovado' and p_novo_status in ('pago', 'rejeitado', 'cancelado'))
  ) then
    raise exception 'Transição de saque inválida: % → %.', v_saque.status, p_novo_status;
  end if;

  if p_novo_status in ('rejeitado', 'cancelado') then
    select * into v_carteira
    from public.sistema_carteiras
    where id = v_saque.carteira_id
    for update;

    if v_carteira.id is null then
      raise exception 'Carteira do saque não encontrada.';
    end if;

    v_saldo := v_carteira.saldo_disponivel_centavos + v_saque.valor_centavos;

    update public.sistema_carteiras
    set saldo_disponivel_centavos = v_saldo, updated_at = now()
    where id = v_carteira.id;

    insert into public.sistema_carteira_lancamentos (
      carteira_id, tipo, direcao, valor_centavos, saldo_apos_centavos,
      descricao, referencia_tipo, referencia_id, criado_por
    ) values (
      v_carteira.id, 'estorno', 'credito', v_saque.valor_centavos, v_saldo,
      case when p_novo_status = 'rejeitado' then 'Saque rejeitado' else 'Saque cancelado' end,
      'saque', v_saque.id::text || ':estorno', p_admin_auth_user_id
    );
  end if;

  update public.sistema_saques
  set
    status = p_novo_status,
    rejeicao_motivo = case when p_novo_status = 'rejeitado' then nullif(trim(p_motivo), '') else rejeicao_motivo end,
    analisado_por = p_admin_auth_user_id,
    analisado_em = now(),
    pago_em = case when p_novo_status = 'pago' then now() else pago_em end,
    updated_at = now()
  where id = p_saque_id
  returning * into v_saque;

  return v_saque;
end;
$$;

revoke all on function public.fn_carteira_creditar(text, uuid, uuid, bigint, text, text, text, text, jsonb, uuid) from public, anon, authenticated;
revoke all on function public.fn_solicitar_saque(uuid, uuid, integer, text, text, text) from public, anon, authenticated;
revoke all on function public.fn_atualizar_status_saque(uuid, text, uuid, text) from public, anon, authenticated;

grant execute on function public.fn_carteira_creditar(text, uuid, uuid, bigint, text, text, text, text, jsonb, uuid) to service_role;
grant execute on function public.fn_solicitar_saque(uuid, uuid, integer, text, text, text) to service_role;
grant execute on function public.fn_atualizar_status_saque(uuid, text, uuid, text) to service_role;

commit;
