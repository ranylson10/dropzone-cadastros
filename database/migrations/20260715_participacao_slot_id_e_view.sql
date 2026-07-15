-- ============================================================================
-- Modelo enxuto de participação (line-first)
-- ============================================================================
-- Escrita fina: campeonato_equipes ganha slot_id (FK do assento).
-- Leitura rica: view vw_campeonato_slots_lines (join fase/grupo/line/equipe).
-- ============================================================================
-- Unidade competitiva = line_id
-- Lugar no grupo     = slot_id
-- Equipe             = pasta (via equipe_lines.equipe_id / denorm equipe_id)
-- ============================================================================

begin;

-- 1) Coluna canônica do assento
alter table public.campeonato_equipes
  add column if not exists slot_id uuid references public.campeonato_slots(id) on delete set null;

-- 2) Backfill a partir de grupo_id + slot_numero
update public.campeonato_equipes p
   set slot_id = s.id
  from public.campeonato_slots s
 where p.slot_id is null
   and p.grupo_id is not null
   and p.slot_numero is not null
   and s.campeonato_id = p.campeonato_id
   and s.grupo_id = p.grupo_id
   and s.slot_numero = p.slot_numero;

-- 3) Índices / uniques enxutos (status ativo)
create index if not exists campeonato_equipes_slot_id_idx
  on public.campeonato_equipes (slot_id)
  where slot_id is not null;

drop index if exists public.campeonato_equipes_slot_ativo_unique;
create unique index if not exists campeonato_equipes_slot_ativo_unique
  on public.campeonato_equipes (slot_id)
  where status = 'ativo' and slot_id is not null;

-- Mantém unique por line no campeonato
drop index if exists public.campeonato_equipes_line_unique;
create unique index if not exists campeonato_equipes_line_unique
  on public.campeonato_equipes (campeonato_id, line_id)
  where line_id is not null and status = 'ativo';

-- Índice de listagem rápida
create index if not exists campeonato_equipes_camp_status_idx
  on public.campeonato_equipes (campeonato_id, status);

create index if not exists campeonato_slots_camp_grupo_idx
  on public.campeonato_slots (campeonato_id, grupo_id);

-- 4) Sync: participação ativa -> espelha no slot (e preenche slot_id se vier só grupo+numero)
create or replace function public.fn_sync_slot_from_participacao()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_slot_id uuid;
begin
  -- Resolve slot_id se veio grupo+numero
  if new.slot_id is null
     and new.grupo_id is not null
     and new.slot_numero is not null
     and new.campeonato_id is not null then
    select s.id into v_slot_id
      from public.campeonato_slots s
     where s.campeonato_id = new.campeonato_id
       and s.grupo_id = new.grupo_id
       and s.slot_numero = new.slot_numero
     limit 1;
    if v_slot_id is not null then
      new.slot_id := v_slot_id;
    end if;
  end if;

  -- Se tem slot_id, espelha grupo/numero a partir do slot (fonte da verdade do assento)
  if new.slot_id is not null then
    select s.grupo_id, s.slot_numero
      into new.grupo_id, new.slot_numero
      from public.campeonato_slots s
     where s.id = new.slot_id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_sync_slot_from_participacao_bi on public.campeonato_equipes;
create trigger trg_sync_slot_from_participacao_bi
before insert or update of status, grupo_id, slot_numero, slot_id, equipe_id, line_id
on public.campeonato_equipes
for each row execute function public.fn_sync_slot_from_participacao();

-- After: ocupa / libera espelho no campeonato_slots
create or replace function public.fn_sync_slot_mirror_from_participacao()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' or tg_op = 'UPDATE' then
    if new.status = 'ativo' and new.slot_id is not null and new.line_id is not null then
      update public.campeonato_slots
         set equipe_id = new.equipe_id,
             line_id = new.line_id,
             status = 'ocupado',
             updated_at = now()
       where id = new.slot_id;
    end if;

    if tg_op = 'UPDATE'
       and old.status = 'ativo'
       and new.status is distinct from 'ativo' then
      update public.campeonato_slots
         set equipe_id = null,
             line_id = null,
             status = 'livre',
             updated_at = now()
       where id = coalesce(old.slot_id, new.slot_id)
         and (
           (old.line_id is not null and line_id is not distinct from old.line_id)
           or (old.line_id is null and equipe_id is not distinct from old.equipe_id)
           or status = 'ocupado'
         );
    end if;
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_sync_slot_from_participacao on public.campeonato_equipes;
drop trigger if exists trg_sync_slot_mirror_from_participacao on public.campeonato_equipes;
create trigger trg_sync_slot_mirror_from_participacao
after insert or update of status, slot_id, equipe_id, line_id
on public.campeonato_equipes
for each row execute function public.fn_sync_slot_mirror_from_participacao();

-- 5) VIEW de leitura (listagem rápida e legível)
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
  case
    when p.id is not null and p.status = 'ativo' then 'ocupada'
    else case when s.equipe_id is not null or s.line_id is not null then 'ocupada' else 'livre' end
  end as status_ui
from public.campeonato_slots s
left join public.campeonato_equipes p
  on p.status = 'ativo'
 and (
      p.slot_id = s.id
   or (
        p.slot_id is null
    and p.campeonato_id = s.campeonato_id
    and p.grupo_id = s.grupo_id
    and p.slot_numero = s.slot_numero
   )
 )
left join public.equipe_lines l
  on l.id = coalesce(p.line_id, s.line_id)
left join public.equipes e
  on e.id = coalesce(p.equipe_id, l.equipe_id, s.equipe_id)
left join public.campeonato_grupos g
  on g.id = s.grupo_id
left join public.campeonato_fases f
  on f.id = coalesce(s.fase_id, g.fase_id);

comment on view public.vw_campeonato_slots_lines is
  'Leitura line-first: slot + participação ativa + line + pasta equipe + fase/grupo';

-- 6) Heal: espelha slots a partir de participações com slot_id
update public.campeonato_slots s
   set equipe_id = p.equipe_id,
       line_id = p.line_id,
       status = 'ocupado',
       updated_at = now()
  from public.campeonato_equipes p
 where p.status = 'ativo'
   and p.slot_id = s.id
   and (s.line_id is distinct from p.line_id or s.equipe_id is distinct from p.equipe_id or s.status is distinct from 'ocupado');

commit;
