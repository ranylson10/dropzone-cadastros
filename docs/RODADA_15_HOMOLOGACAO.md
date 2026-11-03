# DropZone — R15: evidências completas e preparação de laboratório

**Resultado no ambiente atual:** código de verificadores validado. Sem liberação de produção.

## Falhas verificáveis corrigidas

1. O fingerprint da R14 só incluía `app/src`, não `app/app.json`, demais configurações nativas nem a pasta `tests-e2e` (341 arquivos). Não cobria todos os workflows GitHub, configs `playwright*.config.ts` ou `database/migrations`. Agora inclui essas entradas, bem como web, backend, desktop, scripts, migrations e SQLs candidatos. `.auth`, `.env` e relatórios continuam excluídos do hash para não copiar nem expor segredos.
2. O gate R14 aceitava apenas o modo Next.js `--experimental-build-mode compile` como prova de build. Agora exige também `build_next_completo`, executando `npm run build --workspace dropzone-web` **quando `--full` é selecionado e o Next.js está instalado**. O modo compilação segue separado, porque tem finalidade diferente.
3. Adicionado `release:lab-preflight`: somente lê os requisitos do laboratório Docker/PostgreSQL. Não cria banco, não executa SQL, não contém URLs nem credenciais e rejeita contêiner que não tenha o nome, label, imagem `postgres:17.6` e `--network none` esperados. O código 2 significa laboratório ausente ou inadequado.

## Como executar na máquina do projeto

1. Extraia **o ZIP completo**, instale Node.js e use `npm ci` com acesso ao registro npm.
2. Execute `TESTAR_RODADA_15.bat` (ou `npm run test:round15`). Por segurança, o BAT inicia em **modo rápido**. Para build completo, somente depois de configurar o ambiente de STAGING: `set DROPZONE_RELEASE_STAGING=1` e execute o BAT novamente. Nunca use a URL real de produção nesse ensaio. Para revisar bloqueios isoladamente: `npm run release:lab-preflight` e `npm run release:verify -- --full`.
3. Se for configurar laboratório PostgreSQL, use **somente** `scripts/testes/postgres-inscricoes/README.md`, um contêiner **sintético isolado** e o catálogo local `relatorios-testes/banco-publicado.json`. Este catálogo não acompanha o ZIP distribuível e não deve ser substituído por produção. Os scripts de fixtures fazem ALTER, CREATE, INSERT e outras gravações.
4. O relatório `relatorios-testes/round14-local-evidence.json` registra o hash da fonte, resultados e falhas. A R15 usa o mesmo formato para manter compatibilidade, mas o campo de status `build_next_completo` passou a ser obrigatório.
5. O próximo passo após aprovação do laboratório sintético é staging separado, com restauração sem segredos, migrations na ordem correta, ACL/RLS, testes com duas conexões, E2E e recuperação após falha. **Não rode os candidatos SQL em produção** antes disso.

## Critérios de liberação

- `npm ci`, `test:security`, `typecheck`, `lint`, build de compilação **e build Next.js completo** aprovados.
- PostgreSQL 17 com concorrência real, rollback, migrations e ACLs testados sobre base de homologação.
- E2E autenticado e integrações MatchStats / Engine / SPEC / OBS / Electron verificados.
- Backup recuperável, plano de reversão ensaiado e revisão humana documentada.

Um teste local aprovado não substitui essas evidências. O gate ainda retorna **2** quando existem pendências, inclusive sem erros de código.

## Limitações observadas

- `npm ping`: `EAI_AGAIN registry.npmjs.org`; Next.js não pôde ser instalado.
- Sem Docker e sem PostgreSQL disponíveis no ambiente desta execução.
- O catálogo de 118 tabelas tem origem na auditoria passada, mas não está incluso na distribuição; resultados sobre ele não equivalem ao estado atualizado de produção.
- Nenhuma migration aplicada ao projeto hospedado; nenhuma publicação realizada.
