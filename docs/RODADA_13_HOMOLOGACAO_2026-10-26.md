# DropZone R13 — Homologação e portão de release (26/10/2026)

**Situação: publicação bloqueada.** R01–R12 estão no código, porém não são comprovação de operação segura em produção. Esta etapa **não alterou o Supabase de produção**.

## Comprovado nesta sessão

- Código R12 foi extraído e identificado (1.838 entradas do pacote anterior).
- `npm run test:rounds`: passou após vincular **temporariamente, apenas no ambiente de teste**, o TypeScript global ao `node_modules/typescript` ausente; o vínculo não será distribuído.
- `node scripts/testes/test-engine-result-r11.mjs`: passou.
- `npm ci --ignore-scripts ...`: falhou por falta de acesso ao registro npm (`EAI_AGAIN`; npm terminou com `Exit handler never called!`). Os pacotes **não foram instalados**.
- `npm run test:security`: parou após a R01 porque falta o módulo `next/server`.
- Teste Garena requer `web/.env.local`, intencionalmente excluído do ZIP; teste ranking exige `.next/BUILD_ID`.
- Consulta **somente leitura** ao Supabase mostrou 28 migrations, 14 participações ativas, 14 slots ocupados, índice global de inscrição ainda instalado e tabela de recibos ainda ausente.
- R13 acrescentou `npm run test:round13` e a etapa correspondente ao CI para impedir ativação acidental de SQL candidato e verificar arquivos/flags. Esse teste é **estático**; não prova que PostgreSQL ou Next funcionam.

## Requisitos obrigatórios antes da liberação

1. Em uma máquina conectada ao npm: `npm ci`, `npm run test:security`, `npm run test:rounds`, `npm run test:round13`, `npm run typecheck`, `npm run lint`, `npm run build`.
2. PostgreSQL 17 **isolado**, nunca em produção: seguir `scripts/testes/postgres-inscricoes/README.md` e usar dados fictícios. Validar migrations R02 e R09–R11, funções/trigger/ACL com duas sessões, falha forçada, idempotência, restituição e rollback. Não rodar candidatos isoladamente fora da ordem de dependência.
3. Homologar especificamente os fluxos novos da R12: consumo do token + gravação no elenco/vendedor, retry após falha, concorrência entre dois destinatários e rollback integral. O claim condicional **não é** transação única com o cadastro.
4. Testar login/permissões, equipe, inscrição, administrador, SPEC, Engine, MatchStats, Electron, web mobile e pagamentos em ambiente apropriado.
5. Confirmar novamente contagem, integridade, políticas e migrations no banco; revisar o plano de implantação e de restauração; **não ativar flags `atomic`** até todos os escritores seguirem o mesmo protocolo.
6. Guardar logs sem tokens, checklists e registros da revisão; somente então avaliar publicar.

## Mecanismos adicionados

- `npm run test:round13`: verifica a integridade estrutural do release e pode entrar no CI mesmo sem banco.
- `npm run release:readiness`: exibe condições pendentes sem afirmar sucesso.
- `npm run release:readiness -- --require-ready`: retorna código de erro até existir homologação real; portão intencionalmente bloqueado, não um teste de funcionalidades.

## Sem alterações em produção

Nenhuma migration, mudança de índice, política, token, vaga ou campeonato foi aplicada pela R13. Os SQLs candidatos permanecem separados em `docs/sql/`.
