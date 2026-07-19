-- =============================================================================
-- DROPZONE · Limite de vagas somente na FASE DE ENTRADA
-- Idempotente (create or replace). Rode no SQL Editor do Supabase.
-- Fonte: database/migrations/20260719_limite_vagas_somente_fase_entrada.sql
--
-- Efeito: numero_vagas bloqueia só slots da 1ª fase (menor ordem).
-- Grupos de fases seguintes (classificados) não consomem o teto.
-- =============================================================================
-- =============================================================================
-- Limite de vagas (numero_vagas) vale sÃ³ para a FASE DE ENTRADA
-- =============================================================================
-- Problema: criar 8 grupos Ã— 12 na 1Âª fase (96) esgotava o teto e impedia
-- montar grupos nas fases seguintes â€” mesmo elas sÃ³ reutilizando classificados.
--
-- Regra:
--   Â· Fase de entrada = fase(s) com menor `ordem` no campeonato
--   Â· Slots sem fase (fase_id null) tambÃ©m contam como entrada
--   Â· Fases com ordem > mÃ­nima NÃƒO consomem o limite e nÃ£o sÃ£o bloqueadas
-- =============================================================================

-- Conta sÃ³ slots de entrada (fase mÃ­nima + sem fase)
create or replace function public.fn_campeonato_slots_criados(p_campeonato_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  with entrada as (
    select min(f.ordem) as ordem_min
    from public.campeonato_fases f
    where f.campeonato_id = p_campeonato_id
  )
  select count(*)::integer
  from public.campeonato_slots s
  left join public.campeonato_fases f
    on f.id = s.fase_id
  cross join entrada e
  where s.campeonato_id = p_campeonato_id
    and (
      -- sem fases cadastradas: tudo Ã© entrada
      e.ordem_min is null
      -- slot sem fase: entrada
      or s.fase_id is null
      -- fase com a menor ordem: entrada
      or f.ordem = e.ordem_min
    );
$$;

comment on function public.fn_campeonato_slots_criados(uuid) is
  'Capacidade estrutural de ENTRADA = slots da fase de menor ordem (+ slots sem fase). Fases posteriores nÃ£o contam.';

-- Ocupados sÃ³ na fase de entrada (meta de preenchimento)
create or replace function public.fn_campeonato_slots_ocupados(p_campeonato_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  with entrada as (
    select min(f.ordem) as ordem_min
    from public.campeonato_fases f
    where f.campeonato_id = p_campeonato_id
  )
  select count(*)::integer
  from public.campeonato_slots s
  left join public.campeonato_fases f
    on f.id = s.fase_id
  cross join entrada e
  where s.campeonato_id = p_campeonato_id
    and (s.line_id is not null or s.status = 'ocupado')
    and (
      e.ordem_min is null
      or s.fase_id is null
      or f.ordem = e.ordem_min
    );
$$;

comment on function public.fn_campeonato_slots_ocupados(uuid) is
  'Vagas preenchidas na fase de entrada (meta comercial).';

-- Trigger: sÃ³ bloqueia criaÃ§Ã£o de slots na fase de entrada
create or replace function public.fn_enforce_limite_ao_criar_slot()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limite integer;
  v_criados integer;
  v_ordem_min integer;
  v_ordem_slot integer;
begin
  v_limite := public.fn_campeonato_limite_vagas(new.campeonato_id);
  if v_limite is null then
    return new;
  end if;

  select min(f.ordem)
    into v_ordem_min
  from public.campeonato_fases f
  where f.campeonato_id = new.campeonato_id;

  -- Slot em fase posterior Ã  de entrada: classificados, sem consumir meta
  if new.fase_id is not null and v_ordem_min is not null then
    select f.ordem
      into v_ordem_slot
    from public.campeonato_fases f
    where f.id = new.fase_id
      and f.campeonato_id = new.campeonato_id;

    if v_ordem_slot is not null and v_ordem_slot > v_ordem_min then
      return new;
    end if;
  end if;

  -- Conta sÃ³ slots de entrada jÃ¡ existentes
  select count(*)::integer
    into v_criados
  from public.campeonato_slots s
  left join public.campeonato_fases f
    on f.id = s.fase_id
  where s.campeonato_id = new.campeonato_id
    and (tg_op = 'INSERT' or s.id is distinct from new.id)
    and (
      v_ordem_min is null
      or s.fase_id is null
      or f.ordem = v_ordem_min
    );

  if v_criados + 1 > v_limite then
    raise exception
      'Limite de vagas do campeonato atingido (%). NÃ£o Ã© possÃ­vel criar o slot % na fase de entrada. Fases seguintes nÃ£o consomem este limite.',
      v_limite, coalesce(new.slot_letra, new.slot_numero::text)
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

comment on function public.fn_enforce_limite_ao_criar_slot() is
  'Impede criar slots de entrada alÃ©m de numero_vagas. Fases posteriores (classificados) ficam livres do teto.';

-- View de capacidade alinhada Ã  fase de entrada
create or replace view public.vw_campeonato_capacidade as
select
  c.id as campeonato_id,
  c.nome as campeonato_nome,
  cfg.numero_vagas as limite_vagas,
  coalesce(stats.slots_criados, 0) as slots_criados,
  coalesce(stats.slots_ocupados, 0) as slots_ocupados,
  coalesce(stats.slots_reservados, 0) as slots_reservados,
  coalesce(stats.slots_livres, 0) as slots_livres,
  case
    when cfg.numero_vagas is null or cfg.numero_vagas <= 0 then null
    else greatest(cfg.numero_vagas - coalesce(stats.slots_ocupados, 0), 0)
  end as vagas_restantes_meta,
  case
    when cfg.numero_vagas is null or cfg.numero_vagas <= 0 then null
    else greatest(cfg.numero_vagas - coalesce(stats.slots_criados, 0), 0)
  end as slots_ainda_podem_ser_criados
from public.campeonatos c
left join public.campeonato_configuracoes cfg
  on cfg.campeonato_id = c.id
left join lateral (
  with entrada as (
    select min(f.ordem) as ordem_min
    from public.campeonato_fases f
    where f.campeonato_id = c.id
  )
  select
    count(*)::integer as slots_criados,
    count(*) filter (where s.status = 'ocupado' or s.line_id is not null)::integer as slots_ocupados,
    count(*) filter (where s.status = 'reservado' and s.line_id is null)::integer as slots_reservados,
    count(*) filter (where s.status = 'livre' and s.line_id is null)::integer as slots_livres
  from public.campeonato_slots s
  left join public.campeonato_fases f
    on f.id = s.fase_id
  cross join entrada e
  where s.campeonato_id = c.id
    and (
      e.ordem_min is null
      or s.fase_id is null
      or f.ordem = e.ordem_min
    )
) stats on true
where c.deleted_at is null;

comment on view public.vw_campeonato_capacidade is
  'Meta (limite_vagas) vs estrutura/preenchimento da FASE DE ENTRADA. Fases de classificaÃ§Ã£o nÃ£o entram na conta.';

