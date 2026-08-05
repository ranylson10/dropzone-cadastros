begin;

create or replace function public.fn_transferir_line_equipe(
  p_line_id uuid,
  p_equipe_origem_id uuid,
  p_equipe_destino_id uuid,
  p_realizado_por uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_line public.equipe_lines%rowtype;
  v_destino public.equipes%rowtype;
  v_line_jogadores integer := 0;
  v_participacoes integer := 0;
  v_formacoes integer := 0;
begin
  if p_line_id is null or p_equipe_origem_id is null or p_equipe_destino_id is null or p_realizado_por is null then
    raise exception 'Parâmetros obrigatórios ausentes.';
  end if;

  if p_equipe_origem_id = p_equipe_destino_id then
    raise exception 'A equipe de origem e destino são iguais.';
  end if;

  select * into v_line
  from public.equipe_lines
  where id = p_line_id
    and equipe_id = p_equipe_origem_id
    and coalesce(status, 'ativo') = 'ativo'
  for update;

  if not found then
    raise exception 'Line ativa não encontrada na equipe de origem.';
  end if;

  select * into v_destino
  from public.equipes
  where id = p_equipe_destino_id
    and coalesce(status, 'ativo') = 'ativo';

  if not found then
    raise exception 'Equipe de destino não encontrada ou inativa.';
  end if;

  if exists (
    select 1
    from public.equipe_lines
    where equipe_id = p_equipe_destino_id
      and id <> p_line_id
      and coalesce(status, 'ativo') = 'ativo'
      and lower(trim(nome)) = lower(trim(v_line.nome))
  ) then
    raise exception 'A equipe de destino já possui uma line com este nome.';
  end if;

  update public.equipe_lines
  set equipe_id = p_equipe_destino_id,
      updated_at = now()
  where id = p_line_id
    and equipe_id = p_equipe_origem_id;

  update public.equipe_line_jogadores
  set equipe_id = p_equipe_destino_id,
      updated_at = now()
  where line_id = p_line_id
    and equipe_id = p_equipe_origem_id;
  get diagnostics v_line_jogadores = row_count;

  update public.campeonato_equipes
  set equipe_id = p_equipe_destino_id,
      updated_at = now()
  where line_id = p_line_id
    and equipe_id = p_equipe_origem_id;
  get diagnostics v_participacoes = row_count;

  update public.campeonato_jogadores
  set equipe_id = p_equipe_destino_id,
      updated_at = now()
  where line_id = p_line_id
    and equipe_id = p_equipe_origem_id;
  get diagnostics v_formacoes = row_count;

  insert into public.sistema_auditoria(
    administrador_auth_user_id,
    acao,
    alvo_tipo,
    alvo_id,
    detalhes
  ) values (
    p_realizado_por,
    'transferir_line_equipe',
    'equipe_line',
    p_line_id::text,
    jsonb_build_object(
      'equipe_origem_id', p_equipe_origem_id,
      'equipe_destino_id', p_equipe_destino_id,
      'line_nome', v_line.nome,
      'line_tag', v_line.tag,
      'line_jogadores_atualizados', v_line_jogadores,
      'participacoes_atualizadas', v_participacoes,
      'formacoes_atualizadas', v_formacoes
    )
  );

  return jsonb_build_object(
    'line_id', p_line_id,
    'equipe_origem_id', p_equipe_origem_id,
    'equipe_destino_id', p_equipe_destino_id,
    'line_jogadores_atualizados', v_line_jogadores,
    'participacoes_atualizadas', v_participacoes,
    'formacoes_atualizadas', v_formacoes
  );
end;
$$;

revoke all on function public.fn_transferir_line_equipe(uuid, uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.fn_transferir_line_equipe(uuid, uuid, uuid, uuid) to service_role;

commit;
