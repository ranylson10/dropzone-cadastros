# Rodada 85I — editar, cancelar e restaurar escolha de grupo/slot

A rota de escolha manual passa a cobrir o ciclo operacional completo:

- `POST`: primeira escolha;
- `PATCH`: edição/troca explícita;
- `DELETE`: cancelamento com liberação do slot;
- `PUT`: restauração da última escolha cancelada, somente quando o slot anterior ainda está livre.

Nenhuma equipe é distribuída automaticamente. Todas as ações validam propriedade da participação, janela ativa, permissão de troca, disponibilidade real do slot e registram histórico.

A Central do Campeonato mostra ações de cancelar e restaurar para cada participação da equipe.
