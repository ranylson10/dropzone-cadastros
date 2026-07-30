# Rodada 48 — aprovação e publicação controlada

## Objetivo

Validar o ciclo administrativo real de um campeonato temporário sem deixar dados ativos após o teste.

## Fluxo coberto

1. A produtora cria um campeonato com prefixo `[E2E]`.
2. O teste confirma que o registro nasce com `aprovacao_status = pendente`.
3. A sessão do administrador aprova o campeonato pela API `/api/admin/aprovacoes`.
4. A cobrança temporária é marcada como `cortesia`.
5. O registro é consultado novamente e deve estar `aprovado`.
6. A página pública `/campeonatos/[id]` deve exibir o nome do campeonato.
7. O bloco `finally` arquiva o campeonato automaticamente, inclusive quando alguma validação falha.

## Segurança

- Não publica campeonatos reais.
- Não altera preços ou configurações globais.
- Não realiza pagamentos.
- Cada execução usa nome e ID únicos.
- A limpeza é executada com a sessão da própria produtora.
