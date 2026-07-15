-- O unique antigo (grupo_id, slot_numero) bloqueava reinscricao mesmo com status removido
-- e gerava falso "equipe/line ja inscrita" quando o slot parecia livre em campeonato_slots.
-- Passa a ser unico apenas para participacoes ativas.

alter table public.campeonato_equipes
  drop constraint if exists campeonato_equipes_grupo_id_slot_numero_key;

drop index if exists public.campeonato_equipes_grupo_id_slot_numero_key;
drop index if exists public.campeonato_equipes_grupo_slot_unique;

create unique index if not exists campeonato_equipes_grupo_slot_ativo_unique
  on public.campeonato_equipes (grupo_id, slot_numero)
  where status = 'ativo'
    and grupo_id is not null
    and slot_numero is not null;
