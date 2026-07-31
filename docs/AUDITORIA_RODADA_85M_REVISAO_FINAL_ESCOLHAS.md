# Rodada 85M — revisão final do módulo de escolha de grupos

## Objetivo

Revisar o fluxo completo entregue nas subrodadas 85F a 85L antes da execução da suíte oficial de encerramento.

## Ajustes aplicados

- Mantida a escolha estritamente manual pelo administrador ou pela equipe.
- Corrigida a contagem de slots livres na Central para desconsiderar slots bloqueados.
- O estado visual de cancelamento/restauração agora identifica a participação em processamento, evitando exibir o texto de carregamento na equipe errada.
- Adicionada compensação de consistência quando o histórico falha durante confirmação, troca, cancelamento ou restauração.
- Em falha intermediária, participação e slot retornam ao estado anterior conhecido.
- Nenhuma migration foi criada.
- Nenhuma distribuição automática foi adicionada.

## Arquivos revisados

- `web/app/api/campeonatos/[id]/escolha-grupo/route.ts`
- `web/components/campeonatos/ChampionshipCentral.tsx`
- `tests-e2e/controlled/rodada-85m-revisao-final-escolhas.spec.ts`

## Validação desta subrodada

Executar:

```bat
npm run typecheck
npm run build
npm run audit:dropzone:full:orchestrated
```

A suíte `npm run testar:tudo` permanece reservada para a Rodada 85N.
