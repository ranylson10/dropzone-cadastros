begin;

-- Rodada 98
-- Corrige a incorporação de equipe histórica quando a equipe provisória já possui elenco.
-- O elenco-base precisa acompanhar as lines antes de equipe_line_jogadores ser atualizado,
-- pois trg_validar_jogador_da_line exige line e jogador na mesma equipe.
-- Jogadores já existentes na equipe de destino são reaproveitados para evitar violar os
-- índices únicos de equipe_jogadores.

create or replace function public.fn_reivindicar_equipe_historica(
  p_token text,
  p_auth_user_id uuid,
  p_modo text,
  p_equipe_destino_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_token public.tokens%rowtype;
  v_origem public.equipes%rowtype;
  v_destino public.equipes%rowtype;
  v_tem_outra_equipe boolean := false;
  v_lines integer := 0;
  v_elenco_transferido integer := 0;
  v_elenco_mesclado integer := 0;
  v_line_jogadores integer := 0;
  v_participacoes integer := 0;
  v_formacoes integer := 0;
  v_player public.equipe_jogadores%rowtype;
  v_player_destino public.equipe_jogadores%rowtype;
  v_player_map jsonb := '{}'::jsonb;
  v_pair record;
  v_count integer := 0;
begin
  if nullif(trim(coalesce(p_token, '')), '') is null or p_auth_user_id is null then
    raise exception 'Token e usuário são obrigatórios.';
  end if;
  if p_modo not in ('assumir', 'incorporar') then
    raise exception 'Modo de reivindicação inválido.';
  end if;

  select * into v_token
  from public.tokens
  where token = trim(p_token)
    and tipo = 'reivindicacao_equipe_historica'
  for update;

  if not found then raise exception 'Link de reivindicação não encontrado.'; end if;
  if coalesce(v_token.status, 'ativo') <> 'ativo' or coalesce(v_token.usado, false) then
    raise exception 'Este link de reivindicação já foi utilizado ou cancelado.';
  end if;
  if v_token.expira_em is not null and v_token.expira_em <= now() then
    raise exception 'Este link de reivindicação expirou.';
  end if;

  select * into v_origem
  from public.equipes
  where id = v_token.equipe_id
  for update;

  if not found then raise exception 'Equipe histórica não encontrada.'; end if;
  if coalesce(v_origem.status, 'ativo') <> 'ativo' then
    raise exception 'Esta equipe histórica não está disponível para reivindicação.';
  end if;
  if v_origem.auth_user_id is not null or v_origem.dono_auth_user_id is not null then
    raise exception 'Esta equipe já possui responsável.';
  end if;

  select exists (
    select 1 from public.equipes e
    where e.id <> v_origem.id
      and coalesce(e.status, 'ativo') = 'ativo'
      and (e.auth_user_id = p_auth_user_id or e.dono_auth_user_id = p_auth_user_id)
  ) into v_tem_outra_equipe;

  if p_modo = 'assumir' then
    if v_tem_outra_equipe then
      raise exception 'Este login já possui uma equipe. Incorpore a line histórica à sua equipe ou use outra conta.';
    end if;

    update public.equipes
    set auth_user_id = p_auth_user_id,
        dono_auth_user_id = p_auth_user_id,
        updated_at = now()
    where id = v_origem.id;

    update public.tokens
    set usado = true, usado_em = now(), status = 'usado', updated_at = now()
    where id = v_token.id;

    insert into public.sistema_auditoria(
      administrador_auth_user_id, acao, alvo_tipo, alvo_id, detalhes
    ) values (
      p_auth_user_id, 'reivindicar_equipe_historica', 'equipe', v_origem.id::text,
      jsonb_build_object('modo', 'assumir', 'produtora_id', v_token.produtora_id)
    );

    return jsonb_build_object('modo', 'assumir', 'equipe_id', v_origem.id, 'nome', v_origem.nome);
  end if;

  if p_equipe_destino_id is null then
    raise exception 'Escolha a equipe que receberá a line histórica.';
  end if;

  select * into v_destino
  from public.equipes
  where id = p_equipe_destino_id
    and coalesce(status, 'ativo') = 'ativo'
    and (auth_user_id = p_auth_user_id or dono_auth_user_id = p_auth_user_id)
  for update;

  if not found then
    raise exception 'A equipe de destino não pertence a este login.';
  end if;
  if v_destino.id = v_origem.id then
    raise exception 'A equipe de origem e destino são iguais.';
  end if;

  if exists (
    select 1
    from public.equipe_lines origem_line
    join public.equipe_lines destino_line
      on destino_line.equipe_id = v_destino.id
     and destino_line.id <> origem_line.id
     and lower(trim(destino_line.nome)) = lower(trim(origem_line.nome))
    where origem_line.equipe_id = v_origem.id
  ) then
    raise exception 'Sua equipe já possui uma line com o mesmo nome da line histórica.';
  end if;

  -- 1) Prepara o elenco-base. Quando o mesmo jogador já existe no destino,
  -- guardamos um mapa origem -> destino e reaproveitamos o cadastro existente.
  for v_player in
    select *
    from public.equipe_jogadores
    where equipe_id = v_origem.id
    for update
  loop
    v_player_destino := null;

    select * into v_player_destino
    from public.equipe_jogadores destino_player
    where destino_player.equipe_id = v_destino.id
      and (
        (v_player.jogador_auth_user_id is not null and destino_player.jogador_auth_user_id = v_player.jogador_auth_user_id)
        or (v_player.jogador_id is not null and destino_player.jogador_id = v_player.jogador_id)
        or (v_player.jogador_temporario_id is not null and destino_player.jogador_temporario_id = v_player.jogador_temporario_id)
      )
    order by destino_player.created_at asc
    limit 1;

    if v_player_destino.id is not null then
      v_player_map := v_player_map || jsonb_build_object(v_player.id::text, v_player_destino.id::text);
      v_elenco_mesclado := v_elenco_mesclado + 1;
    else
      update public.equipe_jogadores
      set equipe_id = v_destino.id,
          updated_at = now()
      where id = v_player.id;
      v_elenco_transferido := v_elenco_transferido + 1;
    end if;
  end loop;

  -- 2) Move as lines. Depois deste ponto os vínculos de line só podem apontar
  -- para jogadores que também pertençam ao destino.
  update public.equipe_lines
  set equipe_id = v_destino.id, updated_at = now()
  where equipe_id = v_origem.id;
  get diagnostics v_lines = row_count;

  -- 3) Reaponta vínculos dos jogadores que já existiam na equipe de destino.
  for v_pair in select key, value from jsonb_each_text(v_player_map)
  loop
    update public.equipe_line_jogadores
    set equipe_id = v_destino.id,
        equipe_jogador_id = v_pair.value::uuid,
        updated_at = now()
    where equipe_id = v_origem.id
      and equipe_jogador_id = v_pair.key::uuid;
    get diagnostics v_count = row_count;
    v_line_jogadores := v_line_jogadores + v_count;

    update public.campeonato_jogadores
    set equipe_id = v_destino.id,
        equipe_jogador_id = v_pair.value::uuid,
        updated_at = now()
    where equipe_id = v_origem.id
      and equipe_jogador_id = v_pair.key::uuid;
    get diagnostics v_count = row_count;
    v_formacoes := v_formacoes + v_count;

    update public.equipe_jogadores
    set status = 'inativo', updated_at = now()
    where id = v_pair.key::uuid;
  end loop;

  -- 4) Move os demais vínculos. Os jogadores não mesclados já foram transferidos no passo 1.
  update public.equipe_line_jogadores
  set equipe_id = v_destino.id, updated_at = now()
  where equipe_id = v_origem.id;
  get diagnostics v_count = row_count;
  v_line_jogadores := v_line_jogadores + v_count;

  update public.campeonato_equipes
  set equipe_id = v_destino.id, updated_at = now()
  where equipe_id = v_origem.id;
  get diagnostics v_participacoes = row_count;

  update public.campeonato_jogadores
  set equipe_id = v_destino.id, updated_at = now()
  where equipe_id = v_origem.id;
  get diagnostics v_count = row_count;
  v_formacoes := v_formacoes + v_count;

  update public.equipes
  set status = 'incorporada', updated_at = now()
  where id = v_origem.id;

  update public.tokens
  set usado = true, usado_em = now(), status = 'usado',
      equipe_destino_id = v_destino.id, updated_at = now()
  where id = v_token.id;

  insert into public.sistema_auditoria(
    administrador_auth_user_id, acao, alvo_tipo, alvo_id, detalhes
  ) values (
    p_auth_user_id, 'incorporar_equipe_historica', 'equipe', v_origem.id::text,
    jsonb_build_object(
      'equipe_destino_id', v_destino.id,
      'produtora_id', v_token.produtora_id,
      'lines_transferidas', v_lines,
      'elenco_transferido', v_elenco_transferido,
      'elenco_mesclado', v_elenco_mesclado,
      'line_jogadores_atualizados', v_line_jogadores,
      'participacoes_atualizadas', v_participacoes,
      'formacoes_atualizadas', v_formacoes
    )
  );

  return jsonb_build_object(
    'modo', 'incorporar',
    'equipe_origem_id', v_origem.id,
    'equipe_destino_id', v_destino.id,
    'lines_transferidas', v_lines,
    'elenco_transferido', v_elenco_transferido,
    'elenco_mesclado', v_elenco_mesclado,
    'participacoes_atualizadas', v_participacoes,
    'formacoes_atualizadas', v_formacoes
  );
end;
$$;

revoke all on function public.fn_reivindicar_equipe_historica(text, uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.fn_reivindicar_equipe_historica(text, uuid, text, uuid) to service_role;

commit;
