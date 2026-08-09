begin;

-- O modelo canônico atual usa public.equipes(id).
-- O próprio reset versionado já define equipe_jogadores.equipe_id -> public.equipes(id).
-- Esta migração corrige FKs publicadas antigas que ainda apontam para public.equipes_perfis(id).

do $$
begin
  if exists (
    select 1
    from public.equipe_jogadores ej
    left join public.equipes e on e.id = ej.equipe_id
    where ej.equipe_id is not null
      and e.id is null
  ) then
    raise exception
      'Não foi possível corrigir equipe_jogadores.equipe_id: existem equipe_id sem correspondência em public.equipes.';
  end if;
end
$$;

alter table public.equipe_jogadores
  drop constraint if exists equipe_jogadores_equipe_id_fkey;

alter table public.equipe_jogadores
  add constraint equipe_jogadores_equipe_id_fkey
  foreign key (equipe_id)
  references public.equipes(id)
  on delete cascade;

do $$
begin
  if to_regclass('public.inscricoes_substituicoes') is not null then
    if exists (
      select 1
      from public.inscricoes_substituicoes s
      left join public.equipes e on e.id = s.equipe_id
      where s.equipe_id is not null
        and e.id is null
    ) then
      raise exception
        'Não foi possível corrigir inscricoes_substituicoes.equipe_id: existem equipe_id sem correspondência em public.equipes.';
    end if;

    alter table public.inscricoes_substituicoes
      drop constraint if exists inscricoes_substituicoes_equipe_id_fkey;

    alter table public.inscricoes_substituicoes
      add constraint inscricoes_substituicoes_equipe_id_fkey
      foreign key (equipe_id)
      references public.equipes(id)
      on delete cascade;
  end if;
end
$$;

commit;
