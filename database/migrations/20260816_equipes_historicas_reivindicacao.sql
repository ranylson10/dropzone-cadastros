begin;

-- Equipes históricas podem nascer sem conta vinculada e serem reivindicadas depois.
-- O token fica na tabela já existente e nunca é lido diretamente pelo cliente.

create index if not exists tokens_reivindicacao_equipe_historica_idx
  on public.tokens (equipe_id, status, usado, created_at desc)
  where tipo = 'reivindicacao_equipe_historica';

create or replace function public.fn_criar_equipes_historicas_em_bloco(
  p_produtora_id uuid,
  p_campeonato_id uuid,
  p_criado_por uuid,
  p_equipes jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_produtora public.produtoras%rowtype;
  v_item jsonb;
  v_nome text;
  v_tag text;
  v_equipe public.equipes%rowtype;
  v_line_id uuid;
  v_token text;
  v_existente public.equipes%rowtype;
  v_resultados jsonb := '[]'::jsonb;
  v_criadas integer := 0;
  v_existentes integer := 0;
begin
  if p_produtora_id is null or p_campeonato_id is null or p_criado_por is null then
    raise exception 'Produtora, campeonato e usuário são obrigatórios.';
  end if;
  if p_equipes is null or jsonb_typeof(p_equipes) <> 'array' or jsonb_array_length(p_equipes) = 0 then
    raise exception 'Informe ao menos uma equipe.';
  end if;
  if jsonb_array_length(p_equipes) > 100 then
    raise exception 'O cadastro em bloco aceita no máximo 100 equipes por vez.';
  end if;

  select * into v_produtora
  from public.produtoras
  where id = p_produtora_id
    and auth_user_id = p_criado_por
    and coalesce(status, 'ativo') = 'ativo'
  for share;

  if not found then
    raise exception 'Somente o dono da produtora pode cadastrar equipes históricas em bloco.';
  end if;

  if not exists (
    select 1 from public.campeonatos c
    where c.id = p_campeonato_id
      and c.produtora_id = p_produtora_id
      and c.deleted_at is null
  ) then
    raise exception 'O campeonato não pertence a esta produtora.';
  end if;

  for v_item in select value from jsonb_array_elements(p_equipes)
  loop
    v_nome := regexp_replace(trim(coalesce(v_item->>'nome', '')), '\s+', ' ', 'g');
    if v_nome = '' then
      continue;
    end if;

    v_tag := upper(regexp_replace(trim(coalesce(v_item->>'tag', '')), '[^[:alnum:]]+', '', 'g'));
    if v_tag = '' then
      v_tag := upper(regexp_replace(v_nome, '[^[:alnum:]]+', '', 'g'));
      v_tag := left(v_tag, 5);
    end if;
    if v_tag = '' then
      v_tag := 'TIME';
    end if;

    select * into v_existente
    from public.equipes
    where lower(trim(nome)) = lower(v_nome)
      and coalesce(status, 'ativo') <> 'deletado'
    order by created_at asc
    limit 1;

    if found then
      v_existentes := v_existentes + 1;
      v_resultados := v_resultados || jsonb_build_array(jsonb_build_object(
        'status', 'existente',
        'equipe_id', v_existente.id,
        'nome', v_existente.nome,
        'tag', v_existente.tag,
        'logo_url', v_existente.logo_url,
        'tem_dono', (v_existente.auth_user_id is not null or v_existente.dono_auth_user_id is not null)
      ));
      continue;
    end if;

    insert into public.equipes (
      nome, tag, logo_url, auth_user_id, dono_auth_user_id, status
    ) values (
      v_nome, v_tag, null, null, null, 'ativo'
    )
    returning * into v_equipe;

    -- O trigger oficial trg_equipe_cria_line_principal cria a line.
    select id into v_line_id
    from public.equipe_lines
    where equipe_id = v_equipe.id
      and coalesce(status, 'ativo') = 'ativo'
    order by created_at asc
    limit 1;

    v_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');

    insert into public.tokens (
      token, tipo, produtora_id, campeonato_id, equipe_id, line_id, criado_por,
      usado, status, expira_em
    ) values (
      v_token, 'reivindicacao_equipe_historica', p_produtora_id, p_campeonato_id, v_equipe.id, v_line_id, p_criado_por,
      false, 'ativo', null
    );

    insert into public.sistema_auditoria(
      administrador_auth_user_id, acao, alvo_tipo, alvo_id, detalhes
    ) values (
      p_criado_por,
      'criar_equipe_historica',
      'equipe',
      v_equipe.id::text,
      jsonb_build_object('produtora_id', p_produtora_id, 'campeonato_id', p_campeonato_id, 'nome', v_nome, 'tag', v_tag, 'line_id', v_line_id)
    );

    v_criadas := v_criadas + 1;
    v_resultados := v_resultados || jsonb_build_array(jsonb_build_object(
      'status', 'criada',
      'equipe_id', v_equipe.id,
      'line_id', v_line_id,
      'nome', v_equipe.nome,
      'tag', v_equipe.tag,
      'token', v_token
    ));
  end loop;

  return jsonb_build_object(
    'criadas', v_criadas,
    'existentes', v_existentes,
    'resultados', v_resultados
  );
end;
$$;

revoke all on function public.fn_criar_equipes_historicas_em_bloco(uuid, uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.fn_criar_equipes_historicas_em_bloco(uuid, uuid, uuid, jsonb) to service_role;

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
  v_line_jogadores integer := 0;
  v_participacoes integer := 0;
  v_formacoes integer := 0;
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
     and coalesce(destino_line.status, 'ativo') = 'ativo'
     and lower(trim(destino_line.nome)) = lower(trim(origem_line.nome))
    where origem_line.equipe_id = v_origem.id
      and coalesce(origem_line.status, 'ativo') = 'ativo'
  ) then
    raise exception 'Sua equipe já possui uma line com o mesmo nome da line histórica.';
  end if;

  update public.equipe_lines
  set equipe_id = v_destino.id, updated_at = now()
  where equipe_id = v_origem.id
    and coalesce(status, 'ativo') = 'ativo';
  get diagnostics v_lines = row_count;

  update public.equipe_line_jogadores
  set equipe_id = v_destino.id, updated_at = now()
  where equipe_id = v_origem.id;
  get diagnostics v_line_jogadores = row_count;

  update public.campeonato_equipes
  set equipe_id = v_destino.id, updated_at = now()
  where equipe_id = v_origem.id;
  get diagnostics v_participacoes = row_count;

  update public.campeonato_jogadores
  set equipe_id = v_destino.id, updated_at = now()
  where equipe_id = v_origem.id;
  get diagnostics v_formacoes = row_count;

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
    'participacoes_atualizadas', v_participacoes,
    'formacoes_atualizadas', v_formacoes
  );
end;
$$;

revoke all on function public.fn_reivindicar_equipe_historica(text, uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.fn_reivindicar_equipe_historica(text, uuid, text, uuid) to service_role;

commit;
