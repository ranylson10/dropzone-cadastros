begin;

alter table public.tokens
  add column if not exists line_id uuid
    references public.equipe_lines(id)
    on delete set null;

alter table public.tokens
  add column if not exists campeonato_equipe_id uuid
    references public.campeonato_equipes(id)
    on delete set null;

create index if not exists tokens_convite_jogador_line_idx
  on public.tokens (equipe_id, line_id, status)
  where tipo = 'convite_jogador_equipe';

create index if not exists tokens_convite_jogador_formacao_idx
  on public.tokens (campeonato_equipe_id, status)
  where tipo = 'convite_jogador_equipe';

comment on column public.tokens.line_id is
  'Line opcional para convite de jogador. Ao aceitar, entra no elenco e nesta line.';

comment on column public.tokens.campeonato_equipe_id is
  'Participação opcional para convite de formação. Ao aceitar, tenta incluir o jogador respeitando limite e bloqueios.';

commit;
