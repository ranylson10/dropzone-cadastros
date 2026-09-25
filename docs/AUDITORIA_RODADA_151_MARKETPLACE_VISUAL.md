# Rodada 151 — Marketplace visual

## Objetivo

Transformar a experiência de descoberta do DropZone em um marketplace de campeonatos, mantendo os workspaces de gestão separados. A referência estrutural enviada para a rodada foi reinterpretada para o domínio competitivo: busca, hero, categorias, vitrines e cards comerciais continuam; frete, avaliação de produto e catálogo genérico não entram no produto.

## Alterações principais

- A home passa a abrir como vitrine do marketplace, mesmo quando o usuário está autenticado.
- O workspace administrativo continua acessível, mas deixa de dominar a primeira tela.
- Home com busca por campeonato/produtora/formato, atalhos comerciais e hero alimentado por `/api/vagas`.
- Vitrines de campeonatos em destaque, vagas acabando e maiores premiações.
- `/campeonatos` ganha hero, categorias comerciais, busca, filtros e ordenação orientada à compra de vaga.
- Cards mostram banner, produtora, data, premiação, preço, vagas livres, ocupação, favorito e CTA de compra/acompanhamento.
- `/api/vagas` e o diretório público passam a expor nome/logo da produtora para enriquecer a vitrine.
- Home e marketplace usam header horizontal; sidebar preta fica restrita aos workspaces de gestão.
- Layout responsivo mantém a densidade do marketplace no mobile.

## Preservado

- Fluxos de carrinho, favoritos, compra e acompanhamento implementados nas rodadas anteriores.
- Jornada equipe/jogador da R149.
- Workspaces privados e permissões de produtora.
- Financeiro gerencial da R148.
- APIs do DPZ Live Engine continuam separadas; nenhuma captura SPEC foi movida para o marketplace.

## Banco

Nenhuma migration ou alteração de schema nesta rodada.

## Validação da rodada

O teste `tests-e2e/controlled/rodada-151-marketplace-visual.spec.ts` cobre a estrutura marketplace-first, dados reais, filtros, identidade da produtora, cards, responsividade, separação entre marketplace e gestão e isolamento do DPZ Live Engine.
