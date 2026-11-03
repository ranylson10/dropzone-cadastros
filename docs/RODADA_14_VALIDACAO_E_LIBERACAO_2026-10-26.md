# DropZone R14 — Evidências de homologação e bloqueio de publicação

**Status:** entrega de código para verificação; NÃO É autorização para publicar nem para aplicar SQL em produção.

## O que esta rodada muda

- `scripts/release/round14-evidence.mjs` executa regressões R01–R12, checagens R13 e R14; se executado com `--full` e dependências instaladas, também executa `test:security`, `typecheck`, `lint` e **compilação** do Next.js (não substitui prerender nem E2E).
- Gera `relatorios-testes/round14-local-evidence.json` contendo resultado real de cada subprocesso, código de saída, tempo, Node, hash das fontes e limites. Não salva stdout, stderr, tokens, senhas, strings do banco nem URLs privadas. O relatório é gerado localmente, não por ferramenta independente.
- `scripts/release/round14-readiness.mjs` rejeita logs ausentes, inválidos ou referentes a fontes que mudaram. Mesmo com todas as verificações locais aprovadas, **não libera** sem homologação de PostgreSQL, migrations/RLS, E2E, rollback e integrações reais.
- A automação GitHub ganhou `test:round14`; não tenta passar como concluídos os testes externos.
- O `TESTAR_RODADA_14.bat` permite ao responsável executar as verificações da R14 no Windows. Ele não altera o Supabase.

## Execução no Windows

Na pasta raiz do projeto, com Node e dependências:

```cmd
npm ci
TESTAR_RODADA_14.bat
npm run release:readiness -- --require-ready
```

O verificador R14 e a última linha **retornam saída 2** sempre que houver bloqueios (sem falhas de teste); essa saída é deliberada. Falhas em testes retornam saída 1. Se faltar internet ou dependências, o relatório lista as etapas bloqueadas. Para uma pré-checagem rápida, sem Next.js instalado:

```cmd
npm run release:verify -- --quick
```

## Matriz de evidências indispensáveis

| Área | Comprovação exigida antes de liberar |
| --- | --- |
| npm/build | Instalação limpa `npm ci`, `test:security`, typecheck, lint, compilação e build com dados de homologação |
| PostgreSQL | Laboratório PostgreSQL 17 com duas sessões e cenários concorrentes; logs e asserts dos SQLs candidatos em ordem de dependência |
| Staging | Dump restaurado sem segredos reais, RLS/ACL, índices, migrations e triggers conferidos |
| E2E | Login, perfis, inscrição, convite, equipe, admin, vendas e permissões via navegador autenticado |
| Recuperação | Falha injetada, rollback completo, restauração de snapshot e verificação pós-restauração |
| Integrações | Garena, SPEC, Engine, OBS e Electron instalados, com credenciais de teste |

## Isolamento e risco

- Nunca executar os `validate-native.mjs` ou scripts de fixtures contra o Supabase principal. Esses scripts criam tabelas, gatilhos e registros simulados. Usar o contêiner local previsto em `scripts/testes/postgres-inscricoes/README.md`, sem porta externa.
- Não ativar modos transacionais do `.env` enquanto SQL candidato, triggers e todos os escritores não tiverem sido homologados no mesmo schema.
- Os logs automáticos não são assinatura ou atestado independente. A presença ou edição manual de um arquivo de resultado não substitui inspeção do CI e dos testes reais.
- O build de compilação usado no CI não certifica prerender; o build completo com ambiente de homologação é exigência separada.
- Após homologação, publicar somente com backup recuperável e plano de reversão testado.

## Bloqueios observados aqui

O registro npm devolveu `EAI_AGAIN` e não foi possível instalar Next.js/Playwright. PostgreSQL/Docker não estavam disponíveis no ambiente de execução. As regressões R01–R13 passaram usando TypeScript global temporário apenas na máquina de verificação; não faz parte do ZIP. Nenhuma migration de produção foi executada.
