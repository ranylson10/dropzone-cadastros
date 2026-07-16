-- Soft-delete de links de inscrição + consumo atômico de vaga do link de grupo.
-- Rodar no SQL Editor do Supabase (uma vez).

-- 1) Soft-delete
alter table public.campeonato_links
  add column if not exists deleted_at timestamptz;

create index if not exists campeonato_links_deleted_at_idx
  on public.campeonato_links (deleted_at)
  where deleted_at is null;

comment on column public.campeonato_links.deleted_at is
  'Exclusão lógica. Link excluído ainda pode abrir em modo acompanhamento.';

-- 2) Consumo atômico de 1 vaga do link multi-uso (FOR UPDATE)
create or replace function public.fn_consumir_vaga_link_grupo(p_link_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.campeonato_links%rowtype;
  meta jsonb;
  usos int;
  limite int;
  next_usos int;
  at_limit boolean;
  group_slots int;
  human_desc text;
  marker text := '__dz_meta__:';
  marker_pos int;
  body text;
begin
  select * into r
  from public.campeonato_links
  where id = p_link_id
  for update;

  if not found then
    raise exception 'Link nao encontrado';
  end if;

  if r.deleted_at is not null then
    raise exception 'Este link foi excluido pelo organizador.';
  end if;

  if r.ativo is false then
    raise exception 'Este link de equipes foi desativado pelo organizador.';
  end if;

  if r.expira_em is not null and r.expira_em < now() then
    raise exception 'Este link expirou e nao aceita mais inscricoes.';
  end if;

  meta := coalesce(r.metadata, '{}'::jsonb);

  -- Fallback: meta embutida em descricao (ambientes sem coluna metadata preenchida)
  if (meta = '{}'::jsonb or meta is null) and r.descricao is not null then
    marker_pos := position(marker in r.descricao);
    if marker_pos > 0 then
      begin
        meta := (substring(r.descricao from marker_pos + length(marker)))::jsonb;
      exception when others then
        meta := '{}'::jsonb;
      end;
    end if;
  end if;

  usos := greatest(0, coalesce((meta->>'usos')::int, 0));
  if meta ? 'limite_vagas' and (meta->>'limite_vagas') is not null and (meta->>'limite_vagas') <> '' then
    limite := greatest(1, (meta->>'limite_vagas')::int);
  else
    select greatest(1, coalesce(slots, 1)) into group_slots
    from public.campeonato_grupos
    where id = r.grupo_id;
    limite := coalesce(group_slots, 1);
  end if;

  if usos >= limite then
    raise exception 'Este link expirou: o limite de vagas do link foi atingido.';
  end if;

  next_usos := usos + 1;
  at_limit := next_usos >= limite;

  meta := meta
    || jsonb_build_object('usos', next_usos, 'limite_vagas', limite);

  if at_limit then
    meta := meta || jsonb_build_object(
      'closed_reason', 'limite_atingido',
      'closed_at', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
    );
  end if;

  -- Regrava descricao com meta embutida (compat sem depender só da coluna metadata)
  marker_pos := position(marker in coalesce(r.descricao, ''));
  if marker_pos > 0 then
    human_desc := trim(both from substring(r.descricao from 1 for marker_pos - 1));
  else
    begin
      -- se descricao inteira for JSON de meta, não há texto humano
      perform coalesce(r.descricao, '')::jsonb;
      human_desc := '';
    exception when others then
      human_desc := trim(both from coalesce(r.descricao, ''));
    end;
  end if;

  body := meta::text;
  if human_desc <> '' then
    body := human_desc || E'\n' || marker || body;
  else
    body := marker || body;
  end if;

  update public.campeonato_links
  set
    metadata = meta,
    descricao = body,
    ativo = case when at_limit then false else ativo end,
    updated_at = now()
  where id = p_link_id;

  return jsonb_build_object(
    'ok', true,
    'usos', next_usos,
    'limite', limite,
    'restantes', greatest(0, limite - next_usos),
    'entradas', coalesce(meta->'entradas', '[]'::jsonb),
    'at_limit', at_limit
  );
end;
$$;

revoke all on function public.fn_consumir_vaga_link_grupo(uuid) from public;
grant execute on function public.fn_consumir_vaga_link_grupo(uuid) to service_role;

comment on function public.fn_consumir_vaga_link_grupo(uuid) is
  'Consome 1 uso do link de grupo de forma atômica (SELECT FOR UPDATE).';
