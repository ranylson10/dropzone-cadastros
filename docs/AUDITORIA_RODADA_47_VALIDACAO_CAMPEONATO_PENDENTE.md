# Rodada 47 — validação correta de campeonato pendente

O teste controlado criava o campeonato com sucesso, mas tentava abrir a rota pública `/campeonatos/[id]`.
Campeonatos recém-criados ficam com `aprovacao_status = pendente`, portanto não aparecem no diretório público e a rota retorna 404 corretamente.

A validação foi ajustada para:

1. consultar o campeonato recém-criado pela API autenticada da produtora;
2. confirmar ID e nome retornados;
3. abrir o painel autenticado com `/?campeonato=<id>`;
4. confirmar que o campeonato aparece para a proprietária;
5. arquivar o registro no `finally`.

Nenhuma regra de publicação ou aprovação foi alterada.
