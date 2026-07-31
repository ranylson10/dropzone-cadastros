# Rodada 85K — Avisos operacionais da escolha de grupo e slot

## Entrega

- Confirmação no correio interno quando a equipe cria, edita, cancela ou restaura sua escolha.
- Aviso ao responsável quando a administração define, move, cancela ou restaura grupo/slot.
- Envio manual em massa no painel operacional, respeitando os filtros atuais.
- Atalho para avisar somente as equipes pendentes.
- Tipos de aviso: escolha pendente, prazo próximo e aviso geral.
- Registro do remetente, destinatário e data pela tabela `notificacoes`.
- Nenhuma distribuição automática de equipes.
- Nenhuma migration nova.

## Arquivos

- `web/app/api/campeonatos/[id]/estrutura-avancada/route.ts`
- `web/app/api/campeonatos/[id]/escolha-grupo/route.ts`
- `web/features/campeonatos/estrutura-avancada/AdvancedStructureTab.tsx`
- `web/app/globals.css`
- `tests-e2e/controlled/estrutura-avancada-avisos-escolhas.spec.ts`
