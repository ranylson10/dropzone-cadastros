# R157 — Venda de vagas e carrinho

Objetivo: deixar o caminho comprar vaga -> revisar -> pagar -> entrar no campeonato evidente.

## Rotas cobertas
- `/campeonatos`
- `/vagas`
- `/vagas/compra/[token]`
- `/carrinho`
- `/vendas/[token]`
- `/vendedores/[managerId]`
- `/afiliados`

## Ajustes
- Rotas comerciais usam o header público de marketplace.
- Cards priorizam preço, vagas livres, próxima data, premiação e ação.
- Carrinho e checkout usam superfícies claras e CTA amarelo.
- Afiliados foi alinhado à mesma linguagem, com caminho comercial em três etapas.
