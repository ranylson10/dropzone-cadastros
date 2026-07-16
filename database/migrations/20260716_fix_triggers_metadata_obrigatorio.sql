
-- schema mínimo para links de inscrição funcionarem 100%
alter table public.campeonato_links
  add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table public.campeonato_links
  add column if not exists deleted_at timestamptz;

-- Reescreve triggers para NÃO quebrar se metadata falhar (defensivo)
create or replace function public.fn_fechar_link_grupo_se_cheio()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_campeonato_id uuid;
  v_grupo_id uuid;
  v_total int;
  v_livres int;
  v_has_metadata boolean;
begin
  v_campeonato_id := coalesce(new.campeonato_id, old.campeonato_id);
  v_grupo_id := coalesce(new.grupo_id, old.grupo_id);
  if v_campeonato_id is null or v_grupo_id is null then
    return coalesce(new, old);
  end if;

  select count(*)::int into v_total
  from public.campeonato_slots s
  where s.campeonato_id = v_campeonato_id and s.grupo_id = v_grupo_id;
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
    select exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'campeonato_links' and column_name = 'metadata'
    ) into v_has_metadata;

    if v_has_metadata then
      update public.campeonato_links l
         set ativo = false,
             metadata = coalesce(l.metadata, '{}'::jsonb)
                        || jsonb_build_object('closed_reason', 'grupo_cheio', 'closed_at', now()),
             updated_at = now()
       where l.campeonato_id = v_campeonato_id
         and l.grupo_id = v_grupo_id
         and l.tipo = 'inscricao_equipes_grupo'
         and coalesce(l.ativo, true) is true;
    else
      update public.campeonato_links l
         set ativo = false,
             updated_at = now()
       where l.campeonato_id = v_campeonato_id
         and l.grupo_id = v_grupo_id
         and l.tipo = 'inscricao_equipes_grupo'
         and coalesce(l.ativo, true) is true;
    end if;
  end if;

  return coalesce(new, old);
end;
$$;

create or replace function public.fn_fechar_link_grupo_apos_participacao()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_has_metadata boolean;
begin
  if tg_op = 'UPDATE' and new.grupo_id is not null then
    if not exists (
      select 1 from public.campeonato_slots s
      where s.campeonato_id = new.campeonato_id
        and s.grupo_id = new.grupo_id
        and s.line_id is null
        and s.equipe_id is null
    ) then
      select exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'campeonato_links' and column_name = 'metadata'
      ) into v_has_metadata;

      if v_has_metadata then
        update public.campeonato_links l
           set ativo = false,
               metadata = coalesce(l.metadata, '{}'::jsonb)
                          || jsonb_build_object('closed_reason', 'grupo_cheio', 'closed_at', now()),
               updated_at = now()
         where l.campeonato_id = new.campeonato_id
           and l.grupo_id = new.grupo_id
           and l.tipo = 'inscricao_equipes_grupo'
           and coalesce(l.ativo, true) is true;
      else
        update public.campeonato_links l
           set ativo = false,
               updated_at = now()
         where l.campeonato_id = new.campeonato_id
           and l.grupo_id = new.grupo_id
           and l.tipo = 'inscricao_equipes_grupo'
           and coalesce(l.ativo, true) is true;
      end if;
    end if;
  end if;
  return new;
end;
$$;
