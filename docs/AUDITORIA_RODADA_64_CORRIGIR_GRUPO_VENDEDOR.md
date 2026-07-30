# Rodada 64 — Corrigir grupo do teste de vendedor

## Problema encontrado
O cenário controlado criava um campeonato do tipo `diario`, mas tentava criar o grupo sem informar um horário válido. A API bloqueou corretamente a operação.

## Ajuste
O teste de vendedor não depende das regras específicas do Diário. O campeonato temporário foi alterado para `copa`, com formato `Mata-mata`, e o grupo passou a usar `championship_type: copa`.

## Impacto
- Nenhuma migration alterada.
- Nenhuma regra de produção alterada.
- Somente o payload do teste controlado foi corrigido.
- A limpeza automática permanece ativa.
