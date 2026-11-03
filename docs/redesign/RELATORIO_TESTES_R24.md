# DropZone R24 — Evidências locais de 03/11/2026

**Base:** R23 integral. **Arquivos de aplicação modificados:** useDisclosureFocus, os dois cabeçalhos e a importação de CSS. Novo helper puro e CSS de revisão mobile. Nenhuma modificação em `backend/`, `supabase/`, `api/` ou autenticação/pagamentos.

## Execuções realizadas neste ambiente

| Teste | Resultado observado |
|---|---|
| `npm run test:round24` | 50 verificações aprovadas, incluindo 11 cenários executados de foco com Tab/Shift+Tab |
| `npm run test:round23` | 63 verificações aprovadas |
| `npm run test:round22` | 59 verificações aprovadas |
| `npm run test:round21` | 45 verificações aprovadas |
| `npm run test:round20` | 37 verificações aprovadas |
| `npm run test:round19:buildfix` | 22 verificações aprovadas |
| `npm run test:rounds` | R01–R12 aprovadas nos testes disponíveis; relatório de parser: 1.102 fontes TS/JS/JSX/TSX e 48 JSON |
| `npm run test:round13` a `npm run test:round19` | Todas as baterias locais aprovadas |

Os testes históricos R20 e R23 foram atualizados **somente nas expectativas dos controles de menu** porque a R24 tornou o nome acessível do botão dinâmico e habilitou retenção de foco. Não foram removidos casos nem reduzidas as contagens.

## Ainda não executado / não certificado

- **Build completo Next.js da R24:** depende de `npm ci` e do ambiente de compilação adequado. O build aprovado no Windows anteriormente era da R19, não da R24.
- **E2E no navegador real:** teste público R24 foi escrito para Playwright em 320–768 e 1280 px, mas não foi executado nesta sessão.
- **Testes com contas autenticadas:** produtora, equipe, jogador e manager/vendedor exigem sessões isoladas de homologação, conforme checklist da R24.
- **Concorrência/rollback PostgreSQL:** pendentes desde a revisão transacional; não cobertos pela R24.
- **Implantação:** não houve escrita no Supabase de produção nem publicação.

**Conclusão:** código do redesign R20–R24 consolidado e regressões locais aprovadas; homologação da publicação ainda depende de build, navegador real, perfis autenticados e banco.
