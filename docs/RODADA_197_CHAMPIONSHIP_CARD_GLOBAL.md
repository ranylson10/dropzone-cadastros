# R197 — ChampionshipCard único global

Objetivo: parar de manter três arquiteturas diferentes para o mesmo campeonato.

## Componente canônico

- `web/components/championship/ChampionshipCard.tsx`
- `web/styles/championship-card.css`

## Adoção real

- Home: `AuthenticatedHomeFeed.tsx`
- Diretório `/campeonatos`: `DirectoryListClient.tsx`
- Catálogo `/vagas`: `VacancyCard.tsx`
- Página de vendedor: herda automaticamente por usar `VacancyCard`

Listas/linhas/accordions de gestão não usam este card; continuam sendo componentes de lista, conforme a regra do produto.

O card canônico mostra a arte inteira na proporção real, sem recorte; favorito, carrinho e informações ficam no topo; identificação/preço/vagas ficam em overlay sobre a própria arte.
