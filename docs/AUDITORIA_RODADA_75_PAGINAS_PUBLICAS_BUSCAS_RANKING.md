# Rodada 75 — Páginas públicas, buscas e ranking

## Cobertura adicionada

- carregamento público do ranking de equipes e jogadores;
- ordenação e numeração sequencial das posições;
- limite máximo de 100 resultados por ranking;
- catálogo público de mapas;
- catálogo público de vagas;
- rejeição de filtros conflitantes de produtora e vendedor;
- bloqueio das buscas privadas sem autenticação;
- comportamento seguro para pesquisas curtas;
- limite máximo de 20 campeonatos por busca;
- verificação de ausência de campos privados nas respostas públicas;
- abertura das páginas Campeonatos, Equipes, Jogadores, Ranking e Vagas.

## Segurança

A rodada é somente leitura. Nenhum campeonato, equipe, jogador, vaga ou
classificação é criado ou alterado.

## Execução

Use somente:

`npm run testar:tudo`

O total esperado passa de 74 para 78 testes, considerando os dois cenários
executados em desktop e mobile.
