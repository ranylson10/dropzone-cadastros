# Rodada 82 — Fonte oficial global de vagas

## Regra consolidada

O total oficial de vagas de um campeonato vem exclusivamente de `campeonato_configuracoes.numero_vagas`.

- Slots de grupos representam somente a estrutura de distribuição.
- Apenas slots da fase de entrada participam da contagem de ocupação.
- Fases posteriores não aumentam a capacidade comercial.
- Vagas disponíveis = total configurado - ocupações da fase de entrada - reservas comerciais ativas, quando aplicável.
- Ausência de configuração não autoriza usar a soma dos grupos como fallback.

## Áreas revisadas

- Central do Campeonato;
- catálogo público de vagas;
- catálogo público de vendedor;
- páginas públicas de campeonato;
- consultas e detalhes da Lili;
- teste regressivo da fonte oficial.

## Banco

Nenhuma migration foi criada.
