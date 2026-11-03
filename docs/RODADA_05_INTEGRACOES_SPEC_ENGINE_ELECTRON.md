# DropZone — R05 (22/10/2026): integrações e proteção de dados

**Escopo:** correções locais acumuladas sobre R01 + R02 + R03 + R04. Nenhuma alteração no Supabase, no deploy Vercel ou na instalação de qualquer usuário.

## Correções verificadas no código

1. **Electron / imagens remotas** (`desktop/remote-assets.cjs`, `desktop/main.cjs`): antes, `cacheAsset()` aceitava qualquer URL HTTP/HTTPS, seguia redirecionamentos e só verificava o limite de 8 MB após ler o arquivo inteiro. Agora só aceita imagens HTTPS do próprio DropZone em caminhos de mídia/branding e do Storage público da plataforma Supabase; bloqueia credenciais na URL, redirecionamentos, formatos inesperados e leituras acima de 8 MB *durante o stream*. Falhas de imagem retornam `''`, permitindo sincronizar os demais dados. Imagens de terceiros devem ser carregadas previamente no Storage oficial se a política não as permitir. A origem fixa do site está em `desktop/remote-assets.cjs` e precisa ser alterada se o domínio de produção mudar.
2. **Electron / abrir link externo** (`desktop/main.cjs`): `system:open` não passa mais URLs arbitrárias ao `shell.openExternal`. Aceita somente a saída local de overlay em `http://127.0.0.1:19386/overlay/{id}` — único uso encontrado no renderer atual.
3. **Instalador Electron** (`desktop/package.json`): inclui explicitamente `remote-assets.cjs`, que é uma dependência runtime do arquivo principal.
4. **Live Engine / entrada de resultados** (`backend/src/campeonatos/estatisticas/engine-result.service.ts`): rejeita `damage`, `assists` e `revives` negativos, fracionários ou não numéricos quando informados. `null`/ausência continuam válidos para dados não disponíveis. `weapons` e `loadouts` precisam ser arrays quando informados (ou podem ser `null`/ausentes). O JSON, as rotas HTTP e a RPC existentes não foram alterados.
5. **MatchStats / vínculo de jogador** (`backend/src/campeonatos/estatisticas/garena-matchstats.service.ts`): importações antigas às vezes incluem um `id_jogo` sem `campeonato_jogador_id`, `jogador_id` ou equipe; o código sobrescrevia os vínculos válidos já encontrados no elenco com `null`. Agora conserva os vínculos válidos como fallback e mantém prioridade do vínculo da importação quando presente.
6. **SPEC / PlayerNameOverwrite** (`web/features/campeonatos/export/utils/player-name-overwrite.ts`): `PlayerID` é numérico no JSON e JavaScript perde precisão acima de `Number.MAX_SAFE_INTEGER`. Em vez de exportar outro ID por arredondamento, pula o ID não representável e o contabiliza como ignorado. O jogador precisa ter um ID seguro na fonte.

## Testes

- `node scripts/testes/test-round5-integrations.mjs`: **55 verificações aprovadas** de políticas de download, redirecionamentos, tamanho real, IPC, objetos Engine, vínculos MatchStats e geração do SPEC; fakes locais, sem rede ou banco.
- `node scripts/testes/test-round2-guards.mjs`: 6 verificações estruturais aprovadas.
- `node scripts/testes/test-round3-db-gates.mjs`: 7 verificações estruturais aprovadas.
- `node scripts/testes/test-round4-ui.mjs`: 15 verificações estruturais aprovadas.
- `node scripts/testes/test-engine-result-r11.mjs`: verificação de contrato do resultado Engine aprovada.
- `node --check desktop/main.cjs desktop/remote-assets.cjs`: sintaxe válida em ambos os arquivos (um por comando).

**Nota:** o teste R05 usa `typescript` (instalado no projeto ou globalmente) para executar testes unitários dos módulos TS sem Next/Supabase. Para executar no Windows: `TESTAR_RODADA_05.bat`. Caso o TypeScript não esteja disponível, execute `npm install` na raiz antes do teste.

## Testes ainda necessários antes de publicar

- `npm install`, `npm run typecheck`, `npm run lint`, `npm run build` com a configuração adequada em **homologação** (dependências ausentes neste ambiente de testes).
- Electron real no Windows: autenticação, atualização das estatísticas, URLs de imagens reais, overlay no navegador e OBS, salvar PNG e empacotamento NSIS (`npm run desktop:package:win`).
- Uma amostra real do Engine com `damage/assists/revives` nulos, preenchidos e inválidos; exercício da RPC PostgreSQL em homologação com rollback.
- MatchStats com uma importação incompleta/legada e uma completa, reconciliando jogador, time, armas, habilidades e estatísticas sem sobrescrever pontuação indevidamente.
- SPEC oficial: exportar logos/fotos e `PlayerNameOverwrite.json`, confirmar o mapeamento das equipes e a aplicação no cliente do jogo.
- Uma rodada específica de regressões visuais no editor de overlays/OBS e na interface responsiva não foi concluída nesta R05.

## Banco

**Nenhum SQL aplicado**, pois a implantação direta foi bloqueada anteriormente. Migrações R02/R03 permanecem pendentes de homologação. Esta rodada não autoriza aplicar scripts de banco em produção.
