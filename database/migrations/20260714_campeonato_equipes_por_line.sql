alter table public.campeonato_equipes
  drop constraint if exists campeonato_equipes_unique;

alter table public.campeonato_equipes
  add column if not exists line_id uuid references public.equipe_lines(id) on delete set null,
  add column if not exists vaga_id uuid,
  add column if not exists nome_exibicao text,
  add column if not exists origem_entrada text not null default 'organizador',
  add column if not exists criado_por uuid references auth.users(id) on delete set null;

create unique index if not exists campeonato_equipes_line_unique
  on public.campeonato_equipes (campeonato_id, line_id)
  where line_id is not null and status = 'ativo';
