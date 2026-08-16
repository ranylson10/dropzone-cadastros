begin;

create or replace function public.fn_criar_equipes_provisorias_em_bloco(
  p_produtora_id uuid,
  p_criado_por uuid,
  p_equipes jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_item jsonb;
  v_nome text;
  v_tag text;
  v_equipe public.equipes%rowtype;
  v_line_id uuid;
  v_token text;
  v_existente public.equipes%rowtype;
  v_criadas integer := 0;
  v_existentes integer := 0;
begin
  if p_produtora_id is null or p_criado_por is null then
    raise exception 'Produtora e usuário são obrigatórios.';
  end if;
  if p_equipes is null or jsonb_typeof(p_equipes) <> 'array' or jsonb_array_length(p_equipes) = 0 then
    raise exception 'Informe ao menos uma equipe.';
  end if;
  if jsonb_array_length(p_equipes) > 100 then
    raise exception 'O cadastro em bloco aceita no máximo 100 equipes por vez.';
  end if;

  if not exists (
    select 1 from public.produtoras p
    where p.id = p_produtora_id
      and p.auth_user_id = p_criado_por
      and coalesce(p.status, 'ativo') = 'ativo'
  ) then
    raise exception 'Somente o dono da produtora pode cadastrar equipes provisórias.';
  end if;

  for v_item in select value from jsonb_array_elements(p_equipes)
  loop
    v_nome := regexp_replace(trim(coalesce(v_item->>'nome', '')), '\s+', ' ', 'g');
    if v_nome = '' then continue; end if;

    v_tag := upper(regexp_replace(trim(coalesce(v_item->>'tag', '')), '[^[:alnum:]]+', '', 'g'));
    if v_tag = '' then
      v_tag := left(upper(regexp_replace(v_nome, '[^[:alnum:]]+', '', 'g')), 5);
    end if;
    if v_tag = '' then v_tag := 'TIME'; end if;

    select * into v_existente
    from public.equipes
    where lower(trim(nome)) = lower(v_nome)
      and coalesce(status, 'ativo') <> 'deletado'
    order by created_at asc
    limit 1;

    if found then
      v_existentes := v_existentes + 1;
      continue;
    end if;

    insert into public.equipes (nome, tag, logo_url, auth_user_id, dono_auth_user_id, status)
    values (v_nome, v_tag, null, null, null, 'ativo')
    returning * into v_equipe;

    select id into v_line_id
    from public.equipe_lines
    where equipe_id = v_equipe.id
      and coalesce(status, 'ativo') = 'ativo'
    order by created_at asc
    limit 1;

    v_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');

    insert into public.tokens (
      token, tipo, produtora_id, equipe_id, line_id, criado_por,
      usado, status, expira_em
    ) values (
      v_token, 'reivindicacao_equipe_historica', p_produtora_id, v_equipe.id, v_line_id, p_criado_por,
      false, 'ativo', null
    );

    insert into public.sistema_auditoria(administrador_auth_user_id, acao, alvo_tipo, alvo_id, detalhes)
    values (
      p_criado_por, 'criar_equipe_provisoria', 'equipe', v_equipe.id::text,
      jsonb_build_object('produtora_id', p_produtora_id, 'nome', v_nome, 'tag', v_tag, 'line_id', v_line_id)
    );

    v_criadas := v_criadas + 1;
  end loop;

  return jsonb_build_object('criadas', v_criadas, 'existentes', v_existentes);
end;
$$;

revoke all on function public.fn_criar_equipes_provisorias_em_bloco(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.fn_criar_equipes_provisorias_em_bloco(uuid, uuid, jsonb) to service_role;

commit;
