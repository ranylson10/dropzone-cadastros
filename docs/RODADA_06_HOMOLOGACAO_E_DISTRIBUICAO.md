# DropZone — R06: homologação, regressão acumulada e distribuição segura

**Data:** 25/10/2026. **Base:** ZIP R05 acumulado. **Escopo:** CI/testes/empacotamento/documentação. **Produção:** não modificada.

## Achado crítico de distribuição

O arquivo `DROPZONE_RODADA_05_FONTE_COMPLETA.zip` continha artefatos gerados pelo Playwright em `tests-e2e/.auth/`, incluindo estados de sessão com tokens de acesso JWT e `refresh_token` de contas de teste Supabase. A validade atual das credenciais não foi verificada. Esses artefatos estavam ausentes do Git por `.gitignore`, mas foram incluídos na geração antiga do ZIP. Um ZIP de código-fonte **não pode** conter esses arquivos.

**Mitigação R06:** os pacotes completos passam a ser gerados por `node scripts/release/empacotar-fonte.mjs`. O empacotador:

- Exclui diretórios `.auth`, `.temp`, `node_modules`, relatórios, caches e instaladores gerados;
- Exclui arquivos de ambiente privados, chaves e bancos locais; preserva somente modelos `.env.example`;
- Rejeita empacotar qualquer arquivo que contenha padrões reconhecidos de token JWT ou objetos JSON de sessão;
- Ignora links simbólicos e cria um ZIP por meio de APIs nativas do Node, sem npm extras.

**Ação de segurança recomendada:** revogar sessões dos perfis de testes, reautenticar as contas E2E e não compartilhar os pacotes completos R01–R05 sem antes sanitizá-los. Não é suficiente apenas apagar os arquivos do ZIP para invalidar credenciais já emitidas. Não houve revogação automática nesta rodada.

## Regressão e CI

- `npm run test:rounds` executa R01, R02, R03, R04, contrato Engine e R05; valida parsing TypeScript/JSX/JSON; e verifica a política de distribuição.
- O workflow `.github/workflows/quality.yml` agora chama `npm run test:rounds` além de `npm run test:security`, typecheck, lint e compilação.
- Executado em ambiente isolado: os seis testes cumulativos passaram, 1.084 arquivos de código passaram no parser TypeScript, e 29 JSON de origem foram validados (arquivos de sessões excluídos).
- `node scripts/release/empacotar-fonte.mjs --dry-run` passa; o ZIP gerado foi inspecionado quanto a arquivos secretos, CRC e formatos.

## Limites — não confundir com validação funcional integral

- `npm ci --offline` falhou por pacote ausente no cache npm, impedindo execução de `next build`, `tsc` e ESLint completos neste ambiente. Os testes isolados usaram o TypeScript instalado globalmente para execução local, mas o pacote distribuído não o inclui.
- Chromium headless não finalizou a renderização do fixture CSS dentro do tempo limite. Sem teste visual autenticado.
- Não foram testados: PostgreSQL real transacional e concorrência, specs nativos e Playwright autenticado, aplicativo Electron empacotado, SPEC oficial, OBS, MatchStats externo ou aplicativo Android.
- Nenhuma modificação foi feita no Supabase, Vercel, GitHub remoto ou arquivos de produção.

## Executar no Windows

1. Extraia a versão R06 completa para uma pasta nova.
2. Configure seus próprios `.env.local` **fora do ZIP**; não copie credenciais de sessões antigas.
3. Execute `npm ci` na raiz com Node.js 22+; conectividade com o npm é necessária para dependências ausentes.
4. Dê duplo clique em `TESTAR_RODADA_06.bat` para os testes acumulados.
5. Opcionalmente use `TESTAR_RODADA_06.bat --build` no Prompt de Comando para typecheck, lint e compilação.
6. Para gerar um ZIP de fontes seguro, execute `node scripts/release/empacotar-fonte.mjs`.

Se houver qualquer falha, não publique o resultado. As migrations R02/R03 e demais alterações de banco permanecem separadas e não homologadas.
