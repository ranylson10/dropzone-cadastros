# Rodada 78 — Limpeza dos avisos locais da auditoria

## Problema identificado

Os 25 avisos restantes eram produzidos por artefatos locais e esperados:

- `node_modules`;
- `.next`;
- perfis temporários do Chrome;
- sessões E2E;
- relatórios;
- `.env.e2e.example`, que é um arquivo de exemplo e não um segredo real.

Esses itens não representam falha de aplicação, banco ou segurança.

## Correções

- diretórios gerados passam a ser excluídos da varredura de arquivos-fonte;
- somente resíduos inesperados continuam gerando aviso;
- perfis temporários do navegador deixam de aparecer como arquivos grandes;
- `.env.e2e.example` passa a ser reconhecido como exemplo permitido;
- `.gitignore` passa a proteger explicitamente sessões e perfis E2E;
- relatórios Playwright e da auditoria ficam integralmente ignorados.

## Execução

`npm run testar:tudo`

Resultado esperado da auditoria:

`0 AVISO(S) | 0 ERRO(S)`

As rotas de debug continuam avaliadas pelo módulo específico de segurança.
