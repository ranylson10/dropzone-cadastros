# Rodada 44 — Formulário de campeonato e cold start

- Corrige o seletor do nome do campeonato usando o primeiro `input[required]` da etapa 2.
- Mantém o envio real do formulário vazio e o cancelamento sem persistência.
- Detecta também as telas `This page couldn’t load` e `A server error occurred`.
- Repete `/jogadores` uma única vez para distinguir cold start transitório de erro persistente.
- Se a segunda tentativa falhar, o teste continua bloqueando normalmente.
