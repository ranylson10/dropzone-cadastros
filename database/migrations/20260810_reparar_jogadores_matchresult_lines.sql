-- Jogadores importados pelo MatchResult pertencem à participação da line no campeonato.
-- Dados antigos podiam ter sido gravados sem a line/equipe, causando lines vazias na tela.
update public.campeonato_jogadores jogador
set
  equipe_id = coalesce(jogador.equipe_id, participacao.equipe_id),
  line_id = coalesce(jogador.line_id, participacao.line_id),
  updated_at = now()
from public.campeonato_equipes participacao
where participacao.id = jogador.campeonato_equipe_id
  and (jogador.equipe_id is null or jogador.line_id is null)
  and (participacao.equipe_id is not null or participacao.line_id is not null);

update public.campeonato_resultados_jogadores resultado
set
  equipe_id = coalesce(resultado.equipe_id, participacao.equipe_id),
  line_id = coalesce(resultado.line_id, participacao.line_id),
  updated_at = now()
from public.campeonato_equipes participacao
where participacao.id = resultado.campeonato_equipe_id
  and (resultado.equipe_id is null or resultado.line_id is null)
  and (participacao.equipe_id is not null or participacao.line_id is not null);

create index if not exists campeonato_jogadores_participacao_ativo_idx
  on public.campeonato_jogadores (campeonato_equipe_id, status);
