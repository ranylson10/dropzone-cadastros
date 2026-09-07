# R12 — suporte do Site ao contexto explícito do Runtime PC2

## Lacuna comprovada

`GET /api/stream/editor-data` já era a melhor fonte para o PC2 porque entrega todos os datasets do Editor em um único snapshot coerente e usa a chave Stream existente. Porém, o serviço sempre resolvia `active_jogo_id` e `active_partida_id` pelo estado global de transmissão. Isso faria um PC2 atrasado avançar junto com o PC1.

## Mudança mínima

O endpoint passou a aceitar `jogo_id` e `partida_id` juntos, além de `fase_id` opcional. Antes de montar o snapshot, o serviço valida que:

- o jogo pertence ao campeonato associado à chave Stream;
- a partida pertence ao mesmo campeonato e jogo.
- quando informado, `fase_id` pertence à partida.

Quando os parâmetros não são enviados, o comportamento histórico permanece inalterado. Nenhum endpoint novo foi criado e nenhum estado do pontuador/transmissão é escrito.

O payload também passou a conservar campos já presentes nas fontes consolidadas necessários aos bindings/identidade do Runtime: `campeonato_equipe_id`, `campeonato_jogador_id` e `logo`. Os IDs e a ordenação dos datasets continuam iguais.

## Contrato usado pelo Runtime

`GET /api/stream/editor-data?jogo_id={id}&partida_id={id}&fase_id={id_opcional}`

Header: `X-DropZone-Stream-Key`.

O serviço continua responsável por ranking, pontuação, agregação geral/jogo/queda, MVP e booyah. O Runtime apenas exibe a resposta.

## Compatibilidade e verificação

- Chamada sem query: mantém a resolução de contexto existente.
- Chamada com apenas um dos IDs: rejeitada, evitando snapshot ambíguo.
- Chamada com IDs fora do campeonato/jogo: rejeitada.
- `npm run typecheck`: concluído sem erros.

Não foram alterados R11, MatchStats, pontuador, Live Data v1 ou DPZ Live Engine.
