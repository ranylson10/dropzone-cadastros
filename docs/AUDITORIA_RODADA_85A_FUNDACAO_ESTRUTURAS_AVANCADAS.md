# Rodada 85A — Fundação de estruturas avançadas

## Objetivo

Criar uma base aditiva para campeonatos mistos, séries/divisões, edições/temporadas e Diários por horário, sem mudar o funcionamento dos campeonatos atuais.

## Modelo criado

- `campeonato_franquias`: identidade histórica, como “Copa ALOE”.
- `campeonato_edicoes`: edição/temporada vinculada a um campeonato operacional existente.
- `campeonato_divisoes`: séries configuráveis, como C, B e A.
- `campeonato_etapas`: qualificatória, pontos corridos, mata-mata, final ou outra etapa.
- `campeonato_etapa_fontes`: composição da etapa por classificadas, promovidas, venda direta, convite ou inclusão manual.
- `campeonato_progressao_regras`: avanço, promoção, eliminação, premiação e, somente quando usados, rebaixamento ou permanência.
- `campeonato_etapa_premiacoes`: Top 1/2/3, MVP e premiações adicionais.
- `campeonato_diario_horarios`: cada horário do Diário como unidade independente.

## Regras importantes

- Rebaixamento e permanência não são obrigatórios nem presumidos.
- Uma série pode ter sua própria qualificatória e sua própria etapa de pontos corridos.
- A capacidade da etapa pode combinar várias origens.
- Vagas vendidas na qualificatória e na fase de pontos corridos possuem configurações independentes.
- A progressão pode enviar equipes diretamente para uma etapa específica da série seguinte.
- As equipes não classificadas podem simplesmente ser eliminadas.
- Cada etapa pode ter premiação e MVP próprios.
- Diários continuam aproveitando grupos existentes, mas recebem uma representação própria por horário.

## Compatibilidade

A migration não faz backfill obrigatório e não muda dados existentes. Os vínculos em `campeonato_fases.etapa_id` e `campeonato_grupos.diario_horario_id` são opcionais. As APIs atuais continuam usando o modelo anterior até a Rodada 85B.

## Segurança

Todas as novas tabelas têm RLS habilitado e estão classificadas como `service_role_only`. A abertura pública e as autorizações por produtora serão implementadas pelas APIs da Rodada 85B.

## Aplicação

Executar a migration oficial:

`database/migrations/20260731_campeonatos_estruturas_avancadas.sql`
