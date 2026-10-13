# Publicação GitHub e Vercel — 13/10/2026

O usuário autorizou nesta data atualizar o repositório GitHub e a Vercel com o trabalho local, para continuar a auditoria depois. Esta publicação não encerra as seis pendências originais nem ativa as migrations candidatas.

Destino conferido: repositório público `ranylson10/dropzone-cadastros`, branch `main`; projeto Vercel `dropzone-cadastros`, root directory `web`, produção `dpzone.site` e `www.dpzone.site`. O `main` remoto foi comparado com a base local antes do envio. O projeto Vercel separado chamado `web` não é o destino desta publicação.

Validação mais recente: 43 suítes, tipos e lint web/backend aprovados; o build foi retomado após spawn EPERM e aprovado. Também passaram 38 cenários de formulários, 38 regressões de diálogos e 29 checks estáticos. Credenciais não são adicionadas: arquivos de ambiente, relatórios gerados e sessões E2E permanecem ignorados. A inspeção dos arquivos selecionáveis não encontrou os padrões de credenciais definidos pelo scanner; isso não constitui garantia absoluta de ausência de dados sensíveis.

O audit online da raiz continua não verificado, conforme a decisão anterior do usuário. `check:release` e sua guarda permanecem intactos: a guarda retorna 2 sem consultar o registro. A publicação direta desta vez decorre do pedido explícito atual, com a validação de código já concluída e essa limitação registrada; não apresenta a guarda como aprovada.

O workflow novo de qualidade foi ajustado antes do envio para não disparar automaticamente a consulta audit da raiz recusada pelo usuário. O CI valida código, tipos, lint e compilação; não certifica advisories. O índice final também conferiu os arquivos novos e removeu somente whitespace em seis arquivos, sem mudança do conteúdo não branco. A trava Git vazia de 11/10 foi removida após confirmar que não havia processo Git ativo.

As instalações do CI e da Vercel usam `--no-audit`, evitando também a consulta automática durante a instalação. As dependências continuam instaladas normalmente; nenhum pacote foi atualizado por essa configuração.

As variáveis de produção foram conferidas pelos nomes, sem ler seus valores. As flags transacionais não estavam cadastradas; seus defaults permanecem `legacy`. Nenhuma variável ou SQL remoto foi alterado nesta etapa. Os 18 SQLs datados seguem candidatos/preflight. Os bloqueios locais de lote legado de temporada, vínculo Diário e salvamento de edição/franquia passam a integrar o código publicado; essas operações podem responder 503 até staging e ativação revisada. Os demais requisitos estão nas [pendências de fechamento](PENDENCIAS_FECHAMENTO_2026-10-12.md).

O commit e o estado real do deploy serão conferidos após o envio. Esta nota descreve a autorização e a preparação; a confirmação final do envio fica no registro de publicação local e na resposta ao usuário.

O primeiro envio, `14935af8`, foi publicado na Vercel e os quatro GETs públicos conferidos responderam 200. O CI detectou dependência de fixtures históricas dentro da pasta ignorada de relatórios. Os quatro snapshots usados pelos testes foram transferidos, com bytes preservados, para `scripts/testes/fixtures`; as referências de teste foram ajustadas para funcionar em checkout limpo. Essa correção de CI não muda os handlers publicados nem remove os testes de segurança.
