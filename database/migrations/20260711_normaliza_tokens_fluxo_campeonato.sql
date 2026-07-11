update public.tokens
set tipo = 'convite_equipe_campeonato',
    updated_at = now()
where tipo = 'team_invite';

update public.tokens
set tipo = 'convite_jogador_campeonato',
    updated_at = now()
where tipo = 'player_invite';

create index if not exists campeonato_equipes_campeonato_grupo_slot_idx
  on public.campeonato_equipes (campeonato_id, grupo_id, slot_numero);

create index if not exists campeonato_jogadores_campeonato_participacao_idx
  on public.campeonato_jogadores (campeonato_id, campeonato_equipe_id);

create index if not exists tokens_tipo_status_usado_idx
  on public.tokens (tipo, status, usado);
