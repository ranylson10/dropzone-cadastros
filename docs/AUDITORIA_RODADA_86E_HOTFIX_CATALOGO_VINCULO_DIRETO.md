# Rodada 86E — Hotfix catálogo por vínculo direto

## Problema
Um manager que já possuía `portfolio_anuncios` preenchido aceitava um convite específico de campeonato, mas o catálogo público removia esse campeonato por não estar na lista antiga do portfólio.

## Correção
- vínculos ativos de `campeonato_vendedores` passam a ter precedência;
- `portfolio_anuncios` continua limitando somente anúncios opcionais/legados;
- as duas APIs públicas de catálogo usam a mesma regra.

## Arquivos
- `web/app/api/vagas/route.ts`
- `web/app/api/vendedores/[managerId]/vagas/route.ts`

## Validação rápida
Executar apenas o teste controlado de vendedor antes da suíte completa.
