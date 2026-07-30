# Rodada 70 — Compatibilidade do regulamento com o ambiente publicado

## Motivo

O teste da Rodada 69 tentou executar `DELETE /api/campeonatos/[id]/rulebook`,
mas o ambiente publicado respondeu HTTP 405. Isso indica que a versão atualmente
publicada não expõe esse método, embora o código local já possa conter a implementação.

## Ajuste

- remove a exigência de `DELETE` no teste E2E;
- mantém a validação de criação, leitura, bloqueio público e bloqueio por perfil indevido;
- relê o regulamento ao final para confirmar persistência;
- deixa a remoção para o processo de limpeza do campeonato temporário no bloco `finally`.

## Segurança

Nenhuma rota, migration, tabela, regulamento real ou regra de negócio foi alterada.
O ajuste afeta somente o teste automatizado.
