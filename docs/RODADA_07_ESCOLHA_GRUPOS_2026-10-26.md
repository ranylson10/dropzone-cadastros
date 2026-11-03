# DropZone — R07: verificações funcionais de escolha e restauração de grupos

**Base:** R01–R06. **Data:** 26/10/2026. **Ambiente:** cópia local; nenhuma alteração no Supabase ou produção.

## Defeitos observáveis no código anterior

1. `PUT /api/campeonatos/:id/escolha-grupo` (restaurar) verificava que a janela de escolha estava aberta, mas **não consultava os bloqueios administrativos de grupo e slot**. Um slot que havia sido bloqueado após o cancelamento ainda poderia ser restaurado.
2. A restauração não validava novamente se `grupo_anterior_id` e `slot_anterior_id` pertenciam à **fase histórica**. O caminho de escolha normal não validava o `fase_id` do slot frente ao do grupo.
3. No caminho **legado** de `POST` e `PUT`, a checagem de `status='livre'` não bastava quando havia reservas ativas em `lili_reservas_slot` ou tokens de convite ainda válidos com espelho de status desatualizado.

## Correção de código

- Implementado `assertLegacySlotEligible()` compartilhado entre escolha e restauração: valida bloqueios da fase, reserva ativa da Lili e tokens vinculados ao slot; erros de consulta impedem prosseguir. Token expirado corretamente não bloqueia; ausência de expiração ou data inválida é tratada como reserva vigente (fail closed).
- Restauração verifica grupo, slot e `fase_id` de ambos contra o histórico antes de qualquer gravação.
- Escolha verifica a fase do slot frente à fase do grupo.
- A rota atômica existente continua sendo encaminhada à função RPC sem leituras ou gravações legadas adicionais. Não há mudança no formato da API.
- **Limitação:** a checagem legada é somente pré-validação, não substitui locks e transação PostgreSQL. Outro escritor ainda pode criar reserva/bloqueio durante a janela entre SELECT e UPDATE. A solução definitiva depende de migração RPC e homologação em staging.

## Evidências de execução local

- `node scripts/testes/test-round7-functional.mjs`: **19 cenários HTTP simulados aprovados**, entre bloqueios, reservas Lili/convite, fases divergentes, slot ocupado, autorização/ownership, convite expirado e caminho atômico sem fallback.
- `node scripts/testes/test-round6-release.mjs`: **9 grupos de regressão R01–R06 aprovados** (inclui parsing dos arquivos e política de empacotamento).
- Nenhuma chamada remota ou escrita em banco ocorreu nos testes.
- Ainda pendente: `npm ci`, `tsc` completo, lint, build Next, Playwright real autenticado, concorrência PostgreSQL, ambiente staging e validação em Android.

## Passos recomendados antes da publicação

1. Extrair projeto completo da R07 em pasta nova, aplicar variáveis de ambiente localmente e executar `npm ci`.
2. Abrir `TESTAR_RODADA_07.bat` e depois `TESTAR_RODADA_07.bat --build` no Prompt de Comando.
3. Em staging, testar restauração quando o administrador bloqueou um grupo ou slot, reservas de convite e da Lili, troca simultânea de duas equipes e recebimento de notificação.
4. Habilitar modo atômico **somente** após migrations e testes completos de integração; jamais aplicar as migrations SQL em lote na produção sem plano de reversão.

**Status:** R07 preparada no código, testes HTTP simulados e regressões locais aprovados. Não é uma homologação total do sistema.
