-- ============================================================================
-- Regras definitivas: equipe / line / slot / participação
-- ============================================================================
-- Modelo:
--   1 equipe tem N lines
--   1 line ocupa no máximo 1 participação ATIVA por campeonato
--   1 slot de grupo (grupo_id + slot_numero) tem no máximo 1 participação ATIVA
--   campeonato_slots deve espelhar a participação ativa (sync por trigger)
-- ============================================================================

begin;

-- 1) Origem de entrada permitida (compatível com fluxos reais)
alter table public.campeonato_equipes
  drop constraint if exists campeonato_equipes_origem_entrada_check;

alter table public.campeonato_equipes
  add constraint campeonato_equipes_origem_entrada_check
  check (
    origem_entrada = any (
      array[
        'organizador',
        'convite',
        'inscricao',
        'link',
        'vendedor',
        'manual',
        'token'
      ]::text[]
    )
  );

-- 2) Uma line ativa por campeonato
drop index if exists public.campeonato_equipes_line_unique;
create unique index if not exists campeonato_equipes_line_unique
  on public.campeonato_equipes (campeonato_id, line_id)
  where line_id is not null and status = 'ativo';

-- 3) Um slot de grupo por participação ativa
--    (evita o bug: slot visual livre + unique antigo bloqueando)
alter table public.campeonato_equipes
  drop constraint if exists campeonato_equipes_grupo_id_slot_numero_key;

drop index if exists public.campeonato_equipes_grupo_id_slot_numero_key;
drop index if exists public.campeonato_equipes_grupo_slot_unique;
drop index if exists public.campeonato_equipes_grupo_slot_ativo_unique;

create unique index if not exists campeonato_equipes_grupo_slot_ativo_unique
  on public.campeonato_equipes (grupo_id, slot_numero)
  where status = 'ativo'
    and grupo_id is not null
    and slot_numero is not null;

-- 4) Nome de line único por equipe (já existe em alguns ambientes; garante)
--    equipe_lines_equipe_nome_unique (equipe_id, lower(trim(nome)))
do $$
begin
  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and indexname = 'equipe_lines_equipe_nome_unique'
  ) then
    execute $idx$
      create unique index equipe_lines_equipe_nome_unique
      on public.equipe_lines (equipe_id, lower(trim(both from nome)))
    $idx$;
  end if;
exception when others then
  -- se já existir com outro nome, não interrompe
  null;
end $$;

-- 5) Trigger: ao ativar/atualizar participação com grupo+slot, ocupa o slot
create or replace function public.fn_sync_slot_from_participacao()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'ativo'
     and new.grupo_id is not null
     and new.slot_numero is not null
     and new.equipe_id is not null then
    update public.campeonato_slots
       set equipe_id = new.equipe_id,
           line_id = new.line_id,
           status = 'ocupado',
           updated_at = now()
     where grupo_id = new.grupo_id
       and slot_numero = new.slot_numero
       and campeonato_id = new.campeonato_id;
  end if;

  -- se saiu de ativo, libera o slot se ainda apontar para esta line/equipe
  if tg_op = 'UPDATE'
     and old.status = 'ativo'
     and new.status is distinct from 'ativo'
     and old.grupo_id is not null
     and old.slot_numero is not null then
    update public.campeonato_slots
       set equipe_id = null,
           line_id = null,
           status = 'livre',
           updated_at = now()
     where grupo_id = old.grupo_id
       and slot_numero = old.slot_numero
       and campeonato_id = old.campeonato_id
       and (
         (old.line_id is not null and line_id = old.line_id)
         or (old.line_id is null and equipe_id = old.equipe_id)
       );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_sync_slot_from_participacao on public.campeonato_equipes;
create trigger trg_sync_slot_from_participacao
after insert or update of status, grupo_id, slot_numero, equipe_id, line_id
on public.campeonato_equipes
for each row execute function public.fn_sync_slot_from_participacao();

-- 6) Trigger: ao criar equipe, garante line principal
create or replace function public.fn_equipe_cria_line_principal()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.equipe_lines (equipe_id, nome, tag, logo_url, status)
  values (new.id, new.nome, new.tag, new.logo_url, 'ativo')
  on conflict do nothing;
  -- se o unique for por expressão, on conflict pode não casar; tenta fallback
  if not exists (
    select 1 from public.equipe_lines where equipe_id = new.id and status <> 'inativo' limit 1
  ) then
    insert into public.equipe_lines (equipe_id, nome, tag, logo_url, status)
    values (new.id, coalesce(nullif(trim(new.nome), ''), 'Line principal'), new.tag, new.logo_url, 'ativo');
  end if;
  return new;
exception when unique_violation then
  return new;
end;
$$;

drop trigger if exists trg_equipe_cria_line_principal on public.equipes;
create trigger trg_equipe_cria_line_principal
after insert on public.equipes
for each row execute function public.fn_equipe_cria_line_principal();

-- 7) Heal one-shot: slots ocupados sem part ativa -> liberar
update public.campeonato_slots s
   set equipe_id = null,
       line_id = null,
       status = 'livre',
       updated_at = now()
 where (s.equipe_id is not null or s.line_id is not null or s.status = 'ocupado')
   and not exists (
     select 1
       from public.campeonato_equipes p
      where p.status = 'ativo'
        and p.campeonato_id = s.campeonato_id
        and (
          (p.grupo_id = s.grupo_id and p.slot_numero = s.slot_numero)
          or (p.line_id is not null and p.line_id = s.line_id)
        )
   );

-- 8) Heal one-shot: part ativa com grupo/slot e slot livre -> ocupar
update public.campeonato_slots s
   set equipe_id = p.equipe_id,
       line_id = p.line_id,
       status = 'ocupado',
       updated_at = now()
  from public.campeonato_equipes p
 where p.status = 'ativo'
   and p.grupo_id = s.grupo_id
   and p.slot_numero = s.slot_numero
   and p.campeonato_id = s.campeonato_id
   and (s.equipe_id is null or s.line_id is null or s.status is distinct from 'ocupado');

-- 9) Equipes ativas sem line: cria line principal
insert into public.equipe_lines (equipe_id, nome, tag, logo_url, status)
select e.id, e.nome, e.tag, e.logo_url, 'ativo'
  from public.equipes e
 where coalesce(e.status, 'ativo') = 'ativo'
   and not exists (
     select 1 from public.equipe_lines l
      where l.equipe_id = e.id and coalesce(l.status, 'ativo') <> 'inativo'
   );

commit;
