# Rodada 22 — Restaurar regulamento

Adiciona restauração segura do Rulebook para o estado inicial baseado nos dados atuais do campeonato.

## Comportamento

- restaura perfil, respostas, infrações, alertas e etapa;
- remove a publicação pública e limpa `regras_url`;
- mantém campeonato, equipes, jogadores, partidas, resultados e demais dados;
- exige permissão administrativa no campeonato;
- solicita confirmação explícita na interface.

## API

`DELETE /api/campeonatos/[id]/rulebook`
