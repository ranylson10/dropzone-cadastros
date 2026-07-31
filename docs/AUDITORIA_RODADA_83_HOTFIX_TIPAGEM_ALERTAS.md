# Rodada 83 — Hotfix de tipagem dos alertas inteligentes

## Motivo
O TypeScript em modo estrito identificou parâmetros implícitos como `any` nas operações de filtro, mapeamento e ordenação usadas para calcular alertas operacionais da Central do Campeonato.

## Correção
Foram adicionados tipos locais mínimos aos callbacks que processam equipes, jogos e regras de escalação.

## Escopo
- Nenhuma regra de negócio foi alterada.
- Nenhuma consulta ao banco foi alterada.
- Nenhum contrato da API foi alterado.
- Nenhuma migration foi criada.

## Arquivo corrigido
- `web/app/api/central-campeonato/route.ts`

## Validação esperada
- `npm run lint`
- `npm run typecheck`
- `npm run build`
- após deploy, `npm run testar:tudo`
