-- ============================================================================
-- MODELO ÚNICO: vaga física = slot do grupo | meta comercial = limite
-- ============================================================================
-- Antes (dual / confuso):
--   campeonato_vagas  (vaga comercial numerada, paralela)
--   campeonato_slots  (assento real A/B/C no grupo)
--   campeonato_equipes.vaga_id + tokens.vaga_id
--
-- Depois (claro):
--   campeonato_configuracoes.numero_vagas  = LIMITE (meta; 0/null = sem teto)
--   campeonato_slots                      = ÚNICA vaga física
--   campeonato_equipes.slot_id            = participação da line no assento
--   tokens.slot_id                        = convite/reserva do assento
--   lista de equipes                      = view dos slots (+ convite ativo)
--
-- Removido:
--   public.campeonato_vagas
--   public.campeonato_equipes.vaga_id
--   public.tokens.vaga_id
-- ============================================================================
-- Aplicar no Supabase SQL Editor (ou pipeline de migrations) em janela de deploy
-- junto com o código que já não grava em campeonato_vagas.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 0) Pré-requisitos leves (idempotente)
-- ---------------------------------------------------------------------------
alter table public.campeonato_equipes
  add column if not exists slot_id uuid references public.campeonato_slots(id) on delete set null;

alter table public.tokens
  add column if not exists slot_id uuid references public.campeonato_slots(id) on delete set null;

-- Limite comercial explícito (meta do campeonato)
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'campeonato_configuracoes'
  ) then
    alter table public.campeonato_configuracoes
      add column if not exists numero_vagas integer;

    -- null/0 = sem teto; >0 = limite máximo de slots estruturais
    update public.campeonato_configuracoes
       set numero_vagas = null
     where numero_vagas is not null and numero_vagas <= 0;

    alter table public.campeonato_configuracoes
      drop constraint if exists campeonato_configuracoes_numero_vagas_check;

    alter table public.campeonato_configuracoes
      add constraint campeonato_configuracoes_numero_vagas_check
      check (numero_vagas is null or numero_vagas > 0);

    comment on column public.campeonato_configuracoes.numero_vagas is
      'Limite/meta de vagas do campeonato. NÃO materializa rows. null = sem teto. Capacidade real = count(campeonato_slots). Preenchidas = slots com line.';
  end if;
end $$;

-- Status canônicos do slot físico
alter table public.campeonato_slots
  drop constraint if exists campeonato_slots_status_check;

-- normaliza valores antigos antes do check
update public.campeonato_slots
   set status = case
     when lower(coalesce(status, '')) in ('ocupado', 'ocupada', 'preenchido', 'preenchida') then 'ocupado'
     when lower(coalesce(status, '')) in ('reservado', 'reservada') then 'reservado'
     when line_id is not null or equipe_id is not null then 'ocupado'
     else 'livre'
   end;

alter table public.campeonato_slots
  add constraint campeonato_slots_status_check
  check (status = any (array['livre', 'reservado', 'ocupado']::text[]));

comment on table public.campeonato_slots is
  'Vaga física do campeonato (fase > grupo > letra). Única fonte de assento. Criada ao montar o grupo.';

comment on column public.campeonato_slots.status is
  'livre | reservado (convite ativo no slot) | ocupado (line inscrita)';

-- ---------------------------------------------------------------------------
-- 1) Backfill: participação → slot_id (grupo + número)
-- ---------------------------------------------------------------------------
update public.campeonato_equipes p
   set slot_id = s.id
  from public.campeonato_slots s
 where p.slot_id is null
   and p.grupo_id is not null
   and p.slot_numero is not null
   and s.campeonato_id = p.campeonato_id
   and s.grupo_id = p.grupo_id
   and s.slot_numero = p.slot_numero;

-- ---------------------------------------------------------------------------
-- 2) Backfill a partir de campeonato_vagas (se a tabela ainda existir)
--    Heurística: mesmo campeonato + numero_vaga ≈ slot_numero do grupo
--    (quando só existe um match óbvio por grupo/participação)
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.campeonato_vagas') is null then
    raise notice 'campeonato_vagas não existe — pulando backfill legado.';
    return;
  end if;

  -- 2a) participações com vaga_id: tenta achar slot pelo espelho ocupado / numero
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'campeonato_equipes' and column_name = 'vaga_id'
  ) then
    -- via campeonato_equipe_id na vaga
    update public.campeonato_equipes p
       set slot_id = s.id
      from public.campeonato_vagas v
      join public.campeonato_slots s
        on s.campeonato_id = v.campeonato_id
       and s.line_id is not distinct from p.line_id
       and s.equipe_id is not distinct from p.equipe_id
     where p.slot_id is null
       and p.vaga_id = v.id
       and p.status = 'ativo'
       and p.line_id is not null;

    -- via numero_vaga = slot_numero no mesmo grupo da participação
    update public.campeonato_equipes p
       set slot_id = s.id
      from public.campeonato_vagas v
      join public.campeonato_slots s
        on s.campeonato_id = v.campeonato_id
       and s.grupo_id = p.grupo_id
       and s.slot_numero = v.numero_vaga
     where p.slot_id is null
       and p.vaga_id = v.id
       and p.grupo_id is not null
       and v.numero_vaga is not null;
  end if;

  -- 2b) tokens.vaga_id → tokens.slot_id
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'tokens' and column_name = 'vaga_id'
  ) then
    -- se a participação já tem slot, usa
    update public.tokens t
       set slot_id = p.slot_id
      from public.campeonato_equipes p
     where t.slot_id is null
       and t.vaga_id is not null
       and p.vaga_id = t.vaga_id
       and p.slot_id is not null;

    -- se vaga tem grupo implícito via participação e numero
    update public.tokens t
       set slot_id = s.id
      from public.campeonato_vagas v
      join public.campeonato_equipes p
        on p.vaga_id = v.id
       and p.grupo_id is not null
      join public.campeonato_slots s
        on s.campeonato_id = v.campeonato_id
       and s.grupo_id = p.grupo_id
       and s.slot_numero = v.numero_vaga
     where t.slot_id is null
       and t.vaga_id = v.id
       and v.numero_vaga is not null;

    -- tokens com grupo_id + vaga.numero_vaga
    update public.tokens t
       set slot_id = s.id
      from public.campeonato_vagas v
      join public.campeonato_slots s
        on s.campeonato_id = coalesce(t.campeonato_id, v.campeonato_id)
       and s.grupo_id = t.grupo_id
       and s.slot_numero = v.numero_vaga
     where t.slot_id is null
       and t.vaga_id = v.id
       and t.grupo_id is not null
       and v.numero_vaga is not null;
  end if;

  -- 2c) espelha ocupação das vagas legadas nos slots (quando ainda não espelhado)
  update public.campeonato_slots s
     set equipe_id = p.equipe_id,
         line_id = p.line_id,
         status = 'ocupado',
         updated_at = now()
    from public.campeonato_equipes p
   where p.status = 'ativo'
     and p.slot_id = s.id
     and p.line_id is not null
     and (
       s.line_id is distinct from p.line_id
       or s.equipe_id is distinct from p.equipe_id
       or s.status is distinct from 'ocupado'
     );
end $$;

-- ---------------------------------------------------------------------------
-- 3) Relatório de órfãos (não bloqueia; fica em notice)
-- ---------------------------------------------------------------------------
do $$
declare
  parts_sem_slot int := 0;
  tokens_sem_slot int := 0;
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'campeonato_equipes' and column_name = 'vaga_id'
  ) then
    select count(*) into parts_sem_slot
      from public.campeonato_equipes
     where status = 'ativo'
       and slot_id is null
       and vaga_id is not null;
  else
    select count(*) into parts_sem_slot
      from public.campeonato_equipes
     where status = 'ativo' and slot_id is null;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'tokens' and column_name = 'vaga_id'
  ) then
    select count(*) into tokens_sem_slot
      from public.tokens
     where tipo = 'convite_equipe_campeonato'
       and status = 'ativo'
       and usado = false
       and slot_id is null
       and vaga_id is not null;
  end if;

  raise notice 'Participações ativas sem slot_id: %', parts_sem_slot;
  raise notice 'Convites ativos só com vaga_id (sem slot_id): %', tokens_sem_slot;
  -- Se parts_sem_slot > 0, revise manualmente ANTES de dropar vaga_id em produção crítica.
end $$;

-- ---------------------------------------------------------------------------
-- 4) Índices canônicos (slot-first)
-- ---------------------------------------------------------------------------
create index if not exists campeonato_equipes_slot_id_idx
  on public.campeonato_equipes (slot_id)
  where slot_id is not null;

drop index if exists public.campeonato_equipes_slot_ativo_unique;
create unique index if not exists campeonato_equipes_slot_ativo_unique
  on public.campeonato_equipes (slot_id)
  where status = 'ativo' and slot_id is not null;

create index if not exists tokens_slot_id_idx
  on public.tokens (slot_id)
  where slot_id is not null and status = 'ativo' and usado = false;

create index if not exists tokens_campeonato_slot_ativo_idx
  on public.tokens (campeonato_id, slot_id, status)
  where tipo = 'convite_equipe_campeonato';

create index if not exists campeonato_slots_camp_status_idx
  on public.campeonato_slots (campeonato_id, status);

-- ---------------------------------------------------------------------------
-- 5) Funções de domínio: capacidade / limite
-- ---------------------------------------------------------------------------
create or replace function public.fn_campeonato_limite_vagas(p_campeonato_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select case
    when c.numero_vagas is null or c.numero_vagas <= 0 then null
    else c.numero_vagas
  end
  from public.campeonato_configuracoes c
  where c.campeonato_id = p_campeonato_id
  limit 1;
$$;

create or replace function public.fn_campeonato_slots_criados(p_campeonato_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer
  from public.campeonato_slots s
  where s.campeonato_id = p_campeonato_id;
$$;

create or replace function public.fn_campeonato_slots_ocupados(p_campeonato_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer
  from public.campeonato_slots s
  where s.campeonato_id = p_campeonato_id
    and (s.line_id is not null or s.status = 'ocupado');
$$;

comment on function public.fn_campeonato_limite_vagas(uuid) is
  'Meta comercial (numero_vagas). null = sem teto.';
comment on function public.fn_campeonato_slots_criados(uuid) is
  'Capacidade estrutural real = quantidade de slots criados nos grupos.';
comment on function public.fn_campeonato_slots_ocupados(uuid) is
  'Vagas preenchidas = slots com line / status ocupado.';

-- Impede criar mais slots do que o limite do campeonato
create or replace function public.fn_enforce_limite_ao_criar_slot()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limite integer;
  v_criados integer;
begin
  v_limite := public.fn_campeonato_limite_vagas(new.campeonato_id);
  if v_limite is null then
    return new;
  end if;

  select count(*)::integer into v_criados
  from public.campeonato_slots
  where campeonato_id = new.campeonato_id
    and (tg_op = 'INSERT' or id is distinct from new.id);

  -- no INSERT, count ainda não inclui NEW
  if tg_op = 'INSERT' then
    v_criados := v_criados; -- explícito
  end if;

  if v_criados + 1 > v_limite then
    raise exception
      'Limite de vagas do campeonato atingido (%). Não é possível criar o slot %. Capacidade real vem dos grupos; numero_vagas é só o teto.',
      v_limite, coalesce(new.slot_letra, new.slot_numero::text)
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_limite_ao_criar_slot on public.campeonato_slots;
create trigger trg_enforce_limite_ao_criar_slot
before insert on public.campeonato_slots
for each row execute function public.fn_enforce_limite_ao_criar_slot();

-- Reserva de slot via token ativo (espelho de status)
create or replace function public.fn_sync_slot_reserva_from_token()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_slot uuid;
  v_ainda_reservado boolean;
begin
  v_slot := coalesce(new.slot_id, old.slot_id);
  if v_slot is null then
    return coalesce(new, old);
  end if;

  -- se token ativo + não usado + slot → reservado (se ainda livre)
  if tg_op in ('INSERT', 'UPDATE')
     and new.tipo = 'convite_equipe_campeonato'
     and new.status = 'ativo'
     and coalesce(new.usado, false) = false
     and new.slot_id is not null then
    update public.campeonato_slots
       set status = 'reservado',
           updated_at = now()
     where id = new.slot_id
       and status = 'livre'
       and line_id is null;
  end if;

  -- se token saiu de ativo/usado, libera se não houver outro convite e slot sem line
  if tg_op = 'UPDATE'
     and old.slot_id is not null
     and (
       new.status is distinct from 'ativo'
       or coalesce(new.usado, false) = true
       or new.slot_id is distinct from old.slot_id
     ) then
    select exists (
      select 1 from public.tokens t
       where t.slot_id = old.slot_id
         and t.tipo = 'convite_equipe_campeonato'
         and t.status = 'ativo'
         and coalesce(t.usado, false) = false
         and t.id is distinct from new.id
    ) into v_ainda_reservado;

    if not v_ainda_reservado then
      update public.campeonato_slots
         set status = 'livre',
             updated_at = now()
       where id = old.slot_id
         and status = 'reservado'
         and line_id is null;
    end if;
  end if;

  if tg_op = 'DELETE' and old.slot_id is not null then
    select exists (
      select 1 from public.tokens t
       where t.slot_id = old.slot_id
         and t.tipo = 'convite_equipe_campeonato'
         and t.status = 'ativo'
         and coalesce(t.usado, false) = false
    ) into v_ainda_reservado;

    if not v_ainda_reservado then
      update public.campeonato_slots
         set status = 'livre',
             updated_at = now()
       where id = old.slot_id
         and status = 'reservado'
         and line_id is null;
    end if;
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_sync_slot_reserva_from_token on public.tokens;
create trigger trg_sync_slot_reserva_from_token
after insert or update of status, usado, slot_id, tipo
on public.tokens
for each row execute function public.fn_sync_slot_reserva_from_token();

-- ---------------------------------------------------------------------------
-- 6) Views canônicas (lista de equipes = slots)
-- ---------------------------------------------------------------------------
drop view if exists public.vw_campeonato_capacidade;
create view public.vw_campeonato_capacidade as
select
  c.id as campeonato_id,
  c.nome as campeonato_nome,
  cfg.numero_vagas as limite_vagas,
  coalesce(stats.slots_criados, 0) as slots_criados,
  coalesce(stats.slots_ocupados, 0) as slots_ocupados,
  coalesce(stats.slots_reservados, 0) as slots_reservados,
  coalesce(stats.slots_livres, 0) as slots_livres,
  case
    when cfg.numero_vagas is null then null
    else greatest(cfg.numero_vagas - coalesce(stats.slots_ocupados, 0), 0)
  end as vagas_restantes_meta,
  case
    when cfg.numero_vagas is null then null
    else greatest(cfg.numero_vagas - coalesce(stats.slots_criados, 0), 0)
  end as slots_ainda_podem_ser_criados
from public.campeonatos c
left join public.campeonato_configuracoes cfg
  on cfg.campeonato_id = c.id
left join lateral (
  select
    count(*)::integer as slots_criados,
    count(*) filter (where s.status = 'ocupado' or s.line_id is not null)::integer as slots_ocupados,
    count(*) filter (where s.status = 'reservado' and s.line_id is null)::integer as slots_reservados,
    count(*) filter (where s.status = 'livre' and s.line_id is null)::integer as slots_livres
  from public.campeonato_slots s
  where s.campeonato_id = c.id
) stats on true
where c.deleted_at is null;

comment on view public.vw_campeonato_capacidade is
  'Meta (limite_vagas) vs estrutura (slots_criados) vs preenchimento (slots_ocupados).';

-- Atualiza view de listagem: inclui reserva por token (sem campeonato_vagas)
drop view if exists public.vw_campeonato_slots_lines;
create view public.vw_campeonato_slots_lines as
select
  s.id as slot_id,
  s.campeonato_id,
  s.fase_id,
  s.grupo_id,
  s.slot_numero,
  s.slot_letra,
  s.status as slot_status,
  p.id as participacao_id,
  p.line_id,
  p.equipe_id,
  p.nome_exibicao,
  p.origem_entrada,
  p.status as participacao_status,
  p.criado_por,
  p.created_at as participacao_created_at,
  coalesce(nullif(trim(p.nome_exibicao), ''), l.nome, e.nome) as line_nome,
  coalesce(l.tag, e.tag) as line_tag,
  coalesce(l.logo_url, e.logo_url) as line_logo_url,
  e.nome as equipe_nome,
  e.tag as equipe_tag,
  e.logo_url as equipe_logo_url,
  g.nome as grupo_nome,
  f.nome as fase_nome,
  f.ordem as fase_ordem,
  t.id as convite_id,
  t.token as convite_token,
  t.expira_em as convite_expira_em,
  t.nome_equipe_reservada,
  t.nome_line_reservada,
  case
    when p.id is not null and p.status = 'ativo' then 'ocupada'
    when s.line_id is not null or s.status = 'ocupado' then 'ocupada'
    when t.id is not null or s.status = 'reservado' then 'reservada'
    else 'livre'
  end as status_ui
from public.campeonato_slots s
left join public.campeonato_equipes p
  on p.status = 'ativo'
 and p.slot_id = s.id
left join public.equipe_lines l
  on l.id = coalesce(p.line_id, s.line_id)
left join public.equipes e
  on e.id = coalesce(p.equipe_id, l.equipe_id, s.equipe_id)
left join public.campeonato_grupos g
  on g.id = s.grupo_id
left join public.campeonato_fases f
  on f.id = coalesce(s.fase_id, g.fase_id)
left join lateral (
  select tk.*
  from public.tokens tk
  where tk.slot_id = s.id
    and tk.tipo = 'convite_equipe_campeonato'
    and tk.status = 'ativo'
    and coalesce(tk.usado, false) = false
    and (tk.expira_em is null or tk.expira_em > now())
  order by tk.created_at desc
  limit 1
) t on true;

comment on view public.vw_campeonato_slots_lines is
  'Lista de equipes = view dos slots (livre/reservada/ocupada). Sem campeonato_vagas.';

-- ---------------------------------------------------------------------------
-- 7) Remoção do legado (colunas e tabela)
-- ---------------------------------------------------------------------------

-- 7a) FKs / índices em vaga_id
do $$
declare
  r record;
begin
  -- drop FKs apontando para campeonato_vagas
  if to_regclass('public.campeonato_vagas') is not null then
    for r in
      select con.conname, rel.relname as tbl
      from pg_constraint con
      join pg_class rel on rel.oid = con.conrelid
      join pg_namespace nsp on nsp.oid = rel.relnamespace
      join pg_class ref on ref.oid = con.confrelid
      where nsp.nspname = 'public'
        and ref.relname = 'campeonato_vagas'
        and con.contype = 'f'
    loop
      execute format('alter table public.%I drop constraint if exists %I', r.tbl, r.conname);
    end loop;
  end if;
end $$;

-- 7b) coluna vaga_id em campeonato_equipes
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'campeonato_equipes' and column_name = 'vaga_id'
  ) then
    -- participações ativas sem slot e com vaga: não dropa silenciosamente se houver muitas
    -- (só dropa a coluna; dados órfãos já foram notificados no passo 3)
    drop index if exists public.campeonato_equipes_vaga_id_idx;
    drop index if exists public.campeonato_equipes_vaga_idx;
    alter table public.campeonato_equipes drop column vaga_id;
  end if;
end $$;

-- 7c) coluna vaga_id em tokens
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'tokens' and column_name = 'vaga_id'
  ) then
    drop index if exists public.tokens_vaga_id_idx;
    alter table public.tokens drop column vaga_id;
  end if;
end $$;

-- 7d) tabela campeonato_vagas
drop table if exists public.campeonato_vagas cascade;

-- 7e) tabela paralela antiga, se existir
drop table if exists public.campeonato_grupo_slots cascade;

-- ---------------------------------------------------------------------------
-- 8) Comentários finais do modelo
-- ---------------------------------------------------------------------------
comment on table public.campeonato_equipes is
  'Participação da LINE no campeonato. Escrita: campeonato_id + line_id + slot_id. Equipe = pasta via line.';

comment on column public.campeonato_equipes.slot_id is
  'Assento físico (FK campeonato_slots). Obrigatório no fluxo novo.';

comment on column public.tokens.slot_id is
  'Convite/reserva de assento. Substitui tokens.vaga_id.';

commit;

-- ============================================================================
-- CHECKLIST PÓS-MIGRATION (app)
-- ============================================================================
-- 1) Remover qualquer .from('campeonato_vagas') no código.
-- 2) APIs de convite: só slot_id / grupo_id.
-- 3) POST equipes: body.slot_id (não vaga_id como entidade).
-- 4) UI "Número de vagas" = limite/meta; criar capacidade só em grupos→slots.
-- 5) Lista de equipes = vw_campeonato_slots_lines.
-- 6) Contador 20/96 = vw_campeonato_capacidade.
-- ============================================================================
