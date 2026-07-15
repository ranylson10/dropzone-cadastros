-- =============================================================================
-- DropZone — SEGURANÇA TOTAL (banco)
-- =============================================================================
-- Execute no Supabase SQL Editor (uma vez).
--
-- Princípio:
--   - Toda mutação de negócio passa pelo BACKEND com service_role
--   - anon / authenticated NÃO escrevem (nem leem dados sensíveis) direto no PostgREST
--   - RLS ligado em todas as tabelas de domínio
--   - Triggers fecham regras de negócio (link de grupo cheio, etc.)
--
-- Idempotente: pode rodar de novo com segurança.
-- =============================================================================

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- 1) Helpers de papel no banco
-- -----------------------------------------------------------------------------
create or replace function public.fn_is_service_role()
returns boolean
language sql
stable
as $$
  select coalesce(
    current_setting('request.jwt.claim.role', true),
    current_setting('role', true)
  ) in ('service_role', 'supabase_admin', 'postgres');
$$;

create or replace function public.fn_auth_uid()
returns uuid
language sql
stable
as $$
  select auth.uid();
$$;

comment on function public.fn_is_service_role() is
  'True quando a conexão é service_role/admin (backend). Usado em policies/defesa em profundidade.';

-- Owner do campeonato: criado_por OU auth da produtora dona
create or replace function public.fn_is_campeonato_owner(p_campeonato_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.campeonatos c
    left join public.produtoras p on p.id = c.produtora_id
    where c.id = p_campeonato_id
      and c.deleted_at is null
      and p_user_id is not null
      and (
        c.criado_por = p_user_id
        or p.auth_user_id = p_user_id
      )
  );
$$;

-- Manager staff com gestão no campeonato
create or replace function public.fn_is_campeonato_manager_gestao(p_campeonato_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.campeonatos c
    join public.managers m
      on m.auth_user_id = p_user_id
     and m.status = 'ativo'
    join public.manager_produtora mp
      on mp.manager_id = m.id
     and mp.produtora_id = c.produtora_id
     and mp.status = 'ativo'
     and mp.pode_gerenciar_campeonato is true
    where c.id = p_campeonato_id
      and c.deleted_at is null
  );
$$;

-- Vendedor com flag jsonb true (opt-in)
create or replace function public.fn_vendedor_flag(
  p_campeonato_id uuid,
  p_flag text,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.campeonato_vendedores cv
    join public.managers m on m.id = cv.manager_id
    where cv.campeonato_id = p_campeonato_id
      and cv.status = 'ativo'
      and m.auth_user_id = p_user_id
      and m.status = 'ativo'
      and coalesce((cv.permissoes ->> p_flag)::boolean, false) is true
  );
$$;

-- -----------------------------------------------------------------------------
-- 2) Defaults de permissão do vendedor (opt-in para write)
-- -----------------------------------------------------------------------------
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'campeonato_vendedores' and column_name = 'permissoes'
  ) then
    execute $sql$
      alter table public.campeonato_vendedores
        alter column permissoes set default jsonb_build_object(
          'vendedor_vagas', true,
          'adicionar_equipes', false,
          'remover_proprias_equipes', false,
          'gerar_convites_equipe', true,
          'ver_estrutura', true,
          'organizar_grupos', false,
          'pontuar_tabela', false
        )
    $sql$;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'tokens' and column_name = 'manager_permissoes'
  ) then
    execute $sql$
      alter table public.tokens
        alter column manager_permissoes set default jsonb_build_object(
          'vendedor_vagas', true,
          'adicionar_equipes', false,
          'remover_proprias_equipes', false,
          'gerar_convites_equipe', true,
          'ver_estrutura', true,
          'organizar_grupos', false,
          'pontuar_tabela', false
        )
    $sql$;
  end if;
end $$;

comment on column public.campeonato_vendedores.permissoes is
  'Flags vendedor. Padrão: só convite + ver. adicionar/remover/organizar/pontuar são opt-in.';

-- -----------------------------------------------------------------------------
-- 3) Trigger: fecha link de grupo quando não há slots livres
-- -----------------------------------------------------------------------------
create or replace function public.fn_fechar_link_grupo_se_cheio()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total int;
  v_livres int;
  v_campeonato_id uuid;
  v_grupo_id uuid;
begin
  v_campeonato_id := coalesce(new.campeonato_id, old.campeonato_id);
  v_grupo_id := coalesce(new.grupo_id, old.grupo_id);
  if v_campeonato_id is null or v_grupo_id is null then
    return coalesce(new, old);
  end if;

  select count(*)::int into v_total
  from public.campeonato_slots s
  where s.campeonato_id = v_campeonato_id
    and s.grupo_id = v_grupo_id;

  if coalesce(v_total, 0) < 1 then
    return coalesce(new, old);
  end if;

  select count(*)::int into v_livres
  from public.campeonato_slots s
  where s.campeonato_id = v_campeonato_id
    and s.grupo_id = v_grupo_id
    and s.line_id is null
    and s.equipe_id is null;

  if coalesce(v_livres, 0) = 0 then
    update public.campeonato_links l
       set ativo = false,
           metadata = coalesce(l.metadata, '{}'::jsonb)
                      || jsonb_build_object(
                           'closed_reason', 'grupo_cheio',
                           'closed_at', now()
                         )
     where l.campeonato_id = v_campeonato_id
       and l.grupo_id = v_grupo_id
       and l.tipo = 'inscricao_equipes_grupo'
       and coalesce(l.ativo, true) is true;
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_fechar_link_grupo_slot on public.campeonato_slots;
create trigger trg_fechar_link_grupo_slot
after insert or update of line_id, equipe_id, grupo_id, campeonato_id
on public.campeonato_slots
for each row
execute function public.fn_fechar_link_grupo_se_cheio();

-- Também reavalia ao remover participação (soft remove libera slot)
create or replace function public.fn_fechar_link_grupo_apos_participacao()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- se status virou inativo/removido e havia slot, o slot já deve ser liberado pelo app;
  -- reavalia o grupo de qualquer forma
  if tg_op = 'UPDATE' and new.grupo_id is not null then
    perform 1;
    update public.campeonato_links l
       set ativo = false,
           metadata = coalesce(l.metadata, '{}'::jsonb)
                      || jsonb_build_object('closed_reason', 'grupo_cheio', 'closed_at', now())
     where l.campeonato_id = new.campeonato_id
       and l.grupo_id = new.grupo_id
       and l.tipo = 'inscricao_equipes_grupo'
       and coalesce(l.ativo, true) is true
       and not exists (
         select 1
         from public.campeonato_slots s
         where s.campeonato_id = new.campeonato_id
           and s.grupo_id = new.grupo_id
           and s.line_id is null
           and s.equipe_id is null
       )
       and exists (
         select 1
         from public.campeonato_slots s2
         where s2.campeonato_id = new.campeonato_id
           and s2.grupo_id = new.grupo_id
       );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_fechar_link_grupo_part on public.campeonato_equipes;
create trigger trg_fechar_link_grupo_part
after insert or update of status, slot_id, grupo_id, line_id, equipe_id
on public.campeonato_equipes
for each row
execute function public.fn_fechar_link_grupo_apos_participacao();

-- -----------------------------------------------------------------------------
-- 4) Trigger: convite único não pode ser reativado após uso
-- -----------------------------------------------------------------------------
create or replace function public.fn_token_convite_unico_imute_usado()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.tipo in ('convite_equipe_campeonato', 'team_invite')
     and coalesce(old.usado, false) is true
     and (
       coalesce(new.usado, false) is false
       or coalesce(new.status, '') = 'ativo'
     )
  then
    raise exception 'Convite único já utilizado não pode ser reativado (token %).', old.id
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_token_convite_unico_imute_usado on public.tokens;
create trigger trg_token_convite_unico_imute_usado
before update on public.tokens
for each row
execute function public.fn_token_convite_unico_imute_usado();

-- -----------------------------------------------------------------------------
-- 5) RLS + REVOKE: tranca PostgREST (anon/authenticated)
--    Backend com service_role continua operando.
-- -----------------------------------------------------------------------------

-- Tabelas de domínio sensíveis (campeonato / estrutura / resultados / tokens)
do $$
declare
  t text;
  tables text[] := array[
    'campeonatos',
    'campeonato_configuracoes',
    'campeonato_fases',
    'campeonato_grupos',
    'campeonato_slots',
    'campeonato_equipes',
    'campeonato_jogadores',
    'campeonato_links',
    'campeonato_links_inscricao',
    'campeonato_vendedores',
    'campeonato_jogos',
    'campeonato_partidas',
    'campeonato_resultados_equipes',
    'campeonato_resultados_jogadores',
    'campeonato_rodadas',
    'matchresult_vinculos_equipes',
    'tokens',
    'produtora_vendedores',
    'manager_produtora',
    'manager_equipe',
    'manager_jogador',
    'auth_verification_codes',
    'sistema_administradores',
    'sistema_denuncias',
    'sistema_restricoes_conta',
    'sistema_auditoria',
    'jogadores_temporarios'
  ];
begin
  foreach t in array tables loop
    if exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name = t
    ) then
      execute format('alter table public.%I enable row level security', t);
      execute format('alter table public.%I force row level security', t);

      -- remove grants perigosos herdados de baselines antigas
      execute format('revoke all on table public.%I from anon, authenticated, public', t);

      -- sem policies = deny total para roles com RLS (anon/authenticated)
      -- service_role / superuser contornam RLS no Supabase
    end if;
  end loop;
end $$;

-- Tabelas de perfil: leitura pública controlada (somente SELECT de ativos), sem write
do $$
declare
  t text;
  profile_tables text[] := array['produtoras', 'equipes', 'jogadores', 'managers', 'equipe_lines'];
begin
  foreach t in array profile_tables loop
    if exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name = t
    ) then
      execute format('alter table public.%I enable row level security', t);
      execute format('alter table public.%I force row level security', t);
      execute format('revoke all on table public.%I from anon, authenticated, public', t);

      -- limpa policies antigas de escrita se existirem
      execute format('drop policy if exists %I on public.%I', t || '_select_public', t);
      execute format('drop policy if exists %I on public.%I', t || '_deny_write', t);

      -- SELECT público só de registros ativos (vitrine / directory)
      execute format(
        'create policy %I on public.%I for select to anon, authenticated using (coalesce(status, ''ativo'') = ''ativo'')',
        t || '_select_public',
        t
      );
    end if;
  end loop;
end $$;

-- Views de leitura pública de campeonato (se existirem)
do $$
declare
  v text;
  views text[] := array[
    'vw_campeonato_slots_lines',
    'vw_campeonato_permissoes_vendedores'
  ];
begin
  foreach v in array views loop
    if exists (
      select 1 from information_schema.views
      where table_schema = 'public' and table_name = v
    ) then
      execute format('revoke all on table public.%I from anon, authenticated, public', v);
      -- views usam security do owner; backend service_role lê normalmente
      -- se precisar de SELECT autenticado, reabra com grant pontual + security_invoker
    end if;
  end loop;
end $$;

-- View de auditoria de permissões (só service)
create or replace view public.vw_campeonato_permissoes_vendedores as
select
  cv.id,
  cv.campeonato_id,
  cv.produtora_id,
  cv.manager_id,
  cv.status,
  cv.limite_vagas,
  coalesce((cv.permissoes->>'gerar_convites_equipe')::boolean, true) as gerar_convites_equipe,
  coalesce((cv.permissoes->>'adicionar_equipes')::boolean, false) as adicionar_equipes,
  coalesce((cv.permissoes->>'remover_proprias_equipes')::boolean, false) as remover_proprias_equipes,
  coalesce((cv.permissoes->>'ver_estrutura')::boolean, true) as ver_estrutura,
  coalesce((cv.permissoes->>'organizar_grupos')::boolean, false) as organizar_grupos,
  coalesce((cv.permissoes->>'pontuar_tabela')::boolean, false) as pontuar_tabela
from public.campeonato_vendedores cv;

revoke all on table public.vw_campeonato_permissoes_vendedores from anon, authenticated, public;

-- -----------------------------------------------------------------------------
-- 6) Bloqueio extra: funções de código de auth só service_role
-- -----------------------------------------------------------------------------
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'auth_verification_codes'
  ) then
    revoke all on table public.auth_verification_codes from anon, authenticated, public;
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 7) Defaults default privileges: novas tabelas não herdam write para authenticated
-- -----------------------------------------------------------------------------
alter default privileges in schema public
  revoke all on tables from anon, authenticated, public;

alter default privileges in schema public
  revoke all on sequences from anon, authenticated, public;

alter default privileges in schema public
  revoke all on functions from anon, authenticated, public;

-- usage no schema continua (auth/storage do Supabase precisam)
grant usage on schema public to anon, authenticated;

-- -----------------------------------------------------------------------------
-- 8) Sanity check (opcional — retorna contagem de tabelas com RLS)
-- -----------------------------------------------------------------------------
-- select relname, relrowsecurity, relforcerowsecurity
-- from pg_class c
-- join pg_namespace n on n.oid = c.relnamespace
-- where n.nspname = 'public' and relkind = 'r'
-- order by 1;

-- FIM
-- Após rodar: teste no Supabase Table Editor / PostgREST com anon key
--   → SELECT/INSERT em campeonato_equipes deve falhar
-- Backend (service_role) continua normal.
