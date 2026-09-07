# R11 — ingestão do resultado do DPZ Live Engine

## Endpoint oficial

`POST /api/desktop/campeonatos/{campeonato_id}/partidas/{partida_id}/resultado`

A rota exige uma sessão de usuário em `Authorization: Bearer`, valida `requireCampeonatoScore` e exige que `Idempotency-Key` seja igual à chave no corpo. Não existe chave `service_role` no contrato do computador.

Respostas de sucesso:

- `201`: consolidação criada, com `already_processed: false`.
- `200`: a mesma consolidação já existia, com `already_processed: true`.

Reutilizar a chave ou a combinação `partida_id + match_id` com payload diferente é conflito e não sobrescreve o resultado oficial.

## DTO v1

O corpo contém contexto (`campeonato_id`, `fase_id`, `jogo_id`, `partida_id`), `match_id` quando conhecido, equipes, jogadores, armas, loadouts e `source`. IDs competitivos são as únicas chaves de vínculo. `team_id_externo` e `player_id_externo` são informativos e nunca agregam ou identificam inscrições.

O Site rejeita IDs ausentes/duplicados, jogador fora da equipe, posição inválida, abates inválidos, contexto divergente e fonte sem `api_finalized: true`. O payload completo é guardado para auditoria, preservando `null` versus zero. Colunas legadas obrigatórias recebem zero somente onde o schema histórico não aceita nulo; o JSON auditável continua fiel à fonte.

## Transação e autoridade

A RPC `fn_ingerir_resultado_dpz_engine_v1` executa numa única transação:

1. serializa concorrência pela chave idempotente;
2. valida campeonato/fase/jogo/partida e inscrições;
3. grava resultados de equipes e jogadores;
4. deixa o trigger/tabela oficial do Site calcular pontos, classificação e MVP — pontos do Engine não são aceitos;
5. consolida MatchStats detalhado quando há `match_id`;
6. marca a partida como `finalizada`;
7. grava auditoria com fonte `DPZ Live Engine`.

Qualquer exceção reverte tudo, inclusive finalização e auditoria. Assim, uma falha em armas/loadouts não deixa pontuação parcial.

## MatchStats histórico e baseline seguinte

`garena_matchstats_importacoes.consolidacao_oficial` e o índice parcial garantem uma única consolidação oficial por `partida_id + match_id`. A migração elege deterministicamente um registro oficial entre duplicatas históricas, sem apagar nenhuma linha. A view geral, o fallback de MVP e o baseline passam a ler somente importações oficiais.

Consequência operacional: após sincronizar a Q4, o baseline carregado para a Q5 inclui a Q4 exatamente uma vez. O histórico anterior permanece disponível para auditoria, mas não duplica ranking, MVP ou MatchStats agregado.

## Implantação

Aplicar `database/migrations/20260907_dpz_engine_resultado_idempotente.sql` antes de publicar o código da rota. O banco concede a RPC somente a `service_role`; a rota server-side é a fronteira que autentica e autoriza o usuário do Engine.
