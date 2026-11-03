# Rodada 17 — Segurança do laboratório PostgreSQL e homologação pendente

## Diagnóstico

Neste ambiente não há executável `postgres` ou `docker` disponível. A reconstrução offline R16 não foi executada em um servidor PostgreSQL real. Não é correto registrar testes nativos como aprovados.

Durante a revisão de `scripts/testes/postgres-inscricoes/docker-lab.mjs`, foi encontrado um risco: a inspeção do contêiner era **memorizada** na primeira operação. Se o nome do contêiner fosse reutilizado durante uma execução, chamadas seguintes poderiam executar SQL em um destino que não foi reinspecionado.

## Correção R17

- Identificação do laboratório revalidada **antes de cada operação SQL**, sem reutilizar uma verificação anterior.
- A identidade do contêiner é fixada na primeira inspeção e obrigatoriamente permanece igual até o fim do processo.
- `docker exec` utiliza o **ID imutável completo** de 64 caracteres verificado em vez do nome reutilizável.
- A inspeção recusa imagem diferente de `postgres:17.6`, `network` diferente de `none`, status diferente de `running`, label incorreta, saída malformada ou ID inválido.
- Acesso a nomes de banco fora do conjunto `dropzone_audit` / `dropzone_validation_*` continua bloqueado; mensagens de erro e timeouts não são interpretados como sucesso.
- `npm run test:round17` cobre 26 verificações independentes de Docker e rede, inclusive substituição da identidade e revalidação por operação.

## Como avançar no Windows

1. Use o pacote R17 completo extraído e, caso ainda não tenha feito, importe o catálogo histórico com `IMPORTAR_CATALOGO_R16.bat` (o original não é distribuído).
2. Execute `TESTAR_RODADA_17.bat` para testes offline e verificação de prontidão; ele retornará bloqueio enquanto faltar homologação.
3. **Somente em laboratório isolado com Docker Desktop**, siga `scripts/testes/postgres-inscricoes/README.md` para preparar o contêiner de identidade exigida, reconstruir o esquema e executar suítes PostgreSQL em banco sintético. Não use credenciais ou URL de produção.
4. Em um ambiente com dependências instaladas, execute `npm ci`, `npm run typecheck`, `npm run lint`, `npm run build` e o E2E autenticado. Nunca use o histórico de testes do catálogo antigo como evidência do banco atual.

## Limites

A R17 corrige a proteção do executor local, **não** implanta migrations nem prova que convites, inscrições e reservas sejam atômicos em produção. Os testes de concorrência real, os testes E2E e o build integral continuam pendentes. O catálogo usado como fixture foi capturado em 11/10/2026.
