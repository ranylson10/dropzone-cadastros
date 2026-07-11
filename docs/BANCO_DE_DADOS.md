# Banco de dados

## Regra principal

Este documento registra somente o que foi confirmado. Campos, relacionamentos e finalidades não devem ser inventados.

## Tabelas conhecidas e finalidade preliminar

| Tabela | Finalidade preliminar | Situação |
|---|---|---|
| `campeonatos` | cadastro principal de campeonatos | usada no código atual |
| `campeonato_fases` | fases de um campeonato | usada no código atual |
| `campeonato_grupos` | grupos vinculados a campeonato/fase | usada no código atual |
| `campeonato_slots` | slots de grupos no modelo atual | usada; confirmar relação com `campeonato_grupo_slots` |
| `campeonato_grupo_slots` | provável modelo específico de slots por grupo | não confirmado |
| `campeonato_jogos` | jogos ou quedas do campeonato | usada no código atual |
| `campeonato_jogos_grupos` | vínculo entre jogos e grupos | usada no código atual |
| `campeonato_equipes` | vínculo de equipes com campeonato | usada no código atual |
| `campeonato_jogadores` | jogadores vinculados ao campeonato no modelo atual | usada; confirmar relação com inscrições |
| `inscricoes_jogadores` | provável registro formal de inscrições | não confirmado |
| `campeonato_links` | links do campeonato no modelo atual | usada |
| `campeonato_links_inscricao` | provável link específico de inscrição | não confirmado |
| `campeonato_regras` | regras gerais no modelo atual | usada |
| `campeonato_regras_escalacao` | regras específicas de escalação | não confirmado |
| `campeonato_substituicoes` | substituições do campeonato | não integrado |
| `inscricoes_substituicoes` | solicitações ou registros de substituição | não confirmado |
| `equipes` | cadastro principal de equipes | usada |
| `equipe_jogadores` | vínculo de jogadores no modelo atual | usada |
| `jogadores_equipes` | possível vínculo alternativo jogador-equipe | não confirmado |
| `equipes_perfis` | possível associação de perfis a equipes | não confirmado |
| `jogadores` | cadastro principal de jogadores | usada |
| `produtoras` | cadastro principal de produtoras | usada na autenticação |
| `managers` | cadastro principal de managers | usada na autenticação |
| `manager_produtora` | autorização/vínculo do manager com produtora | ainda não integrado corretamente |
| `manager_equipe` | autorização/vínculo do manager com equipe | ainda não integrado corretamente |
| `manager_jogador` | autorização/vínculo do manager com jogador | ainda não integrado corretamente |
| `tokens` | tokens usados no modelo atual | usada |
| `convites_tokens` | provável modelo especializado de convites | não confirmado |

## Levantamento necessário

Antes de consolidar o schema, coletar para todas as tabelas:

- colunas e tipos;
- chave primária;
- chaves estrangeiras;
- índices e uniques;
- checks;
- triggers;
- políticas RLS;
- funções que escrevem nelas;
- views dependentes.

## Decisão aprovada para slots

O frontend não cadastra slots individualmente. O backend recebe a quantidade de slots ao criar o grupo e executa a criação em transação.
