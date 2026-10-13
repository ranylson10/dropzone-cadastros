# DropZone — revisão de layout página por página (R161–R190)

Esta rodada substitui a abordagem anterior de “tema geral”. O critério agora é **rota/subárea real do sistema**. Uma rodada só é considerada coberta quando o componente da página e as subáreas exibidas por ela têm regra visual explícita e responsiva.

## Regras da interface

- Conteúdo e leitura: fundo `#f1f3f5` / cards brancos.
- Grafite: cabeçalhos, hero e áreas operacionais que precisam de contraste.
- Amarelo: CTA, item ativo e estado importante; não é fundo dominante da página.
- Textura: SVG local (`texture-halftone`, `texture-speedlines`, `texture-brush`) em baixa opacidade.
- Largura desktop: até ~1480 px nas páginas de catálogo/listas; nada “espremido” em 1000 px num monitor 1920.
- Mobile: nenhuma página deve depender de grid desktop; navegações longas viram scroll horizontal.
- OBS (`/broadcast/obs/[token]`) é exceção deliberada: continua sem chrome do site porque é saída de transmissão.

## R161–R167 — Campeonatos

### R161 — `/campeonatos`
- Cabeçalho público compartilhado.
- Hero/vitrine de campeonato.
- Destaques laterais.
- Categorias comerciais.
- Busca, chips, ordenação e filtros.
- Grid real de campeonatos e ações de favoritar/carrinho.
- Cards com mídia separada do corpo; informação não fica escondida em overlay escuro.

### R162 — `/campeonatos/[id]`
- Banner real do campeonato no hero.
- Identidade, fatos, CTA, tabs e conteúdo público.
- Equipes, jogadores, estatísticas e vagas públicas em superfícies claras.

### R163 — `/campeonatos/[id]/regulamento`
- Header público.
- Hero do regulamento.
- Viewer, TOC, busca e documento.
- Corrigida semântica: não existe mais `<main>` dentro de outro `<main>`.

### R164 — `/campeonatos/[id]/stream`
- Header público.
- Handoff para o Studio local em card claro e legível.

### R165 — `/campeonatos/[id]/pontuador/[jogoId]`
- Workspace do pontuador.
- Toolbar, tabs de quedas, tabela, inputs, warnings e estados bloqueados.

### R166 — `/central-campeonato`
- Cabeçalho, seletor do campeonato, visão geral, alertas, logs e escolhas.

### R167 — gestão do campeonato no painel da produtora
Subáreas revisadas individualmente:
1. Visão geral.
2. Equipes / inscrições / vagas.
3. Jogadores.
4. Estrutura / fases / grupos / slots.
5. Estrutura avançada / progressão.
6. Jogos e quedas.
7. Calls / XTreino.
8. Regulamento (editor).
9. Classificação / estatísticas / compartilhamento.
10. Financeiro / vendedores.
11. Exportação / SPEC.
12. Stream / pacote de transmissão.
13. Formulário completo de criação/edição do campeonato (wizard, pontuação, premiação, identidade e recursos).

Arquivo principal: `web/features/campeonatos/championship-page-refresh.css`.

## R168–R170 — Equipes

### R168 — `/equipes` e `/equipes/[id]`
- Diretório, pesquisa, lista e perfil público.
- Perfil: hero, fatos, abas, lines, elenco e vínculos.

### R169 — painel de Equipe (`/?painel=1`)
Subáreas:
1. Início.
2. Elenco > Jogadores.
3. Elenco > Lines.
4. Elenco > Convites.
5. Competições.
6. Desempenho / treinos / telemetria / análise técnica.
7. Mais > Staff.
8. Mais > Configurações.

### R170 — fluxos de equipe
- `/convite/equipe/[token]`
- `/equipe/entrar/[token]`
- `/equipe/reivindicar/[token]`
- `/escala/[token]`

## R171–R172 — Jogadores

### R171 — `/jogadores` e `/jogadores/[id]`
- Diretório e perfil público.

### R172 — painel de Jogador (`/?painel=1`)
1. Início.
2. Competições.
3. Equipe.
4. Desempenho.
5. Perfil.
6. Entrada por token de escalação.

## R173–R174 — Produtoras

### R173 — `/produtoras` e `/produtoras/[id]`
- Diretório e perfil público.

### R174 — painel de Produtora (`/?painel=1`)
1. Visão geral.
2. Campeonatos (inclui todas as subáreas da R167).
3. Financeiro > resumo.
4. Financeiro > vendedores.
5. Equipe > membros internos.
6. Equipe > cadastros provisórios.
7. Configurações.

## R175–R176 — Managers / Afiliados

### R175 — `/managers` e `/managers/[id]`
- Diretório e perfil público.

### R176 — painel de Manager (`/?painel=1`)
- Central de afiliado.
- Campanhas/vendas.
- Carteira.
- Edição de perfil.
- Componentes de contexto vinculados para equipes/jogadores permanecem compatíveis, quando expostos pela permissão.

## R177 — Ranking
- `/rank`
- Hero, tabela/lista e cards do hub de ranking.

## R178 — Comunidade
- `/comunidade`
- Cards de acesso a Equipes, Jogadores, Ranking, Produtoras e demais áreas públicas.

## R179–R182 — Venda de vagas / marketplace

### R179 — catálogo de vagas
- `/vagas`
- `/vendedores/[managerId]`
- Hero, escopo, filtros, grid, cards e estados vazios.

### R180 — compra/reserva
- `/vagas/compra/[token]`
- Etapas, identidade, pagamento, PIX, retry e resumo.

### R181 — carrinho
- `/carrinho`
- Itens, quantidades, faturamento, resumo, checkout, compras e recomendações.

### R182 — vendas e afiliados
- `/vendas/[token]`
- `/vendedor/[token]`
- `/afiliados`
- Checkout atribuído, link de vendedor e landing/dashboard de afiliado.

## R183 — Agenda e Carteira

### `/agenda`
- Toolbar, calendário diário/mensal, próximos compromissos, lista, sequência, editor e experiência de visitante.

### `/carteira`
- Hero, saldo, extrato, saques, pagamentos, PIX, comprovantes e formulários.

## R184 — Administração

### `/admin`
9 abas revisadas:
1. Visão geral.
2. Página inicial (editor completo de hero, categorias, promoções e newsletter).
3. Produtoras.
4. Publicações.
5. Preços.
6. Saques.
7. Contas.
8. Denúncias.
9. Auditoria.

## R185 — Autenticação
- `/login`
- `/atualizar-senha`
- Entrada, criação, conta existente, código/OTP, recuperação, seleção/criação de perfil.

## R186 — Convites e links especiais
- `/convite/equipe/[token]`
- `/convite/grupo/[token]`
- `/convite/produtora/[token]`
- `/equipe/entrar/[token]`
- `/equipe/reivindicar/[token]`
- `/escala/[token]`
- `/i/[token]`
- `/vendedor/[token]`

Todos usam a mesma linguagem de card claro, CTA amarelo e estados legíveis.

## R187 — Lili e Broadcast

### `/lili`
- Header próprio, conversa, cards, ações, seletor de perfil e composer.

### `/broadcast/control/[token]`
- Controlador operacional claro, com header grafite e cards brancos.

### `/broadcast/obs/[token]`
- **Exceção funcional intencional:** saída limpa para OBS, sem header, fundo ou padding do site.

## R188 — Legais
- `/politica-de-privacidade`
- `/termos-de-servico`
- `/exclusao-de-dados`

## R189 — Callback mobile
- `/auth/mobile-callback`
- Removido o layout inline azul/vermelho antigo; usa card branco + amarelo/grafite igual ao sistema.

## R190 — Home, header e auditoria final
- `/`
- Mantida a Home marketplace já aprovada como base.
- StorefrontHeader é a fonte de navegação das páginas públicas.
- Teste novo: `tests-e2e/controlled/rodada-190-page-by-page-layout.spec.ts`.
- O teste visita páginas reais, mede overflow e, quando há dados, entra no primeiro campeonato/perfil em vez de validar somente strings no código.

## Matriz das 43 rotas `page.tsx`

| Rota | Rodada | Estado |
|---|---:|---|
| `/` | R190 | revisada |
| `/admin` | R184 | revisada |
| `/afiliados` | R182 | revisada |
| `/agenda` | R183 | revisada |
| `/atualizar-senha` | R185 | revisada |
| `/auth/mobile-callback` | R189 | revisada |
| `/broadcast/control/[token]` | R187 | revisada |
| `/broadcast/obs/[token]` | R187 | saída OBS intencional |
| `/campeonatos` | R161 | revisada |
| `/campeonatos/[id]` | R162 | revisada |
| `/campeonatos/[id]/pontuador/[jogoId]` | R165 | revisada |
| `/campeonatos/[id]/regulamento` | R163 | revisada |
| `/campeonatos/[id]/stream` | R164 | revisada |
| `/carrinho` | R181 | revisada |
| `/carteira` | R183 | revisada |
| `/central-campeonato` | R166 | revisada |
| `/comunidade` | R178 | revisada |
| `/convite/equipe/[token]` | R170/R186 | revisada |
| `/convite/grupo/[token]` | R186 | revisada |
| `/convite/produtora/[token]` | R186 | revisada |
| `/equipe/entrar/[token]` | R170/R186 | revisada |
| `/equipe/reivindicar/[token]` | R170/R186 | revisada |
| `/equipes` | R168 | revisada |
| `/equipes/[id]` | R168 | revisada |
| `/escala/[token]` | R170/R186 | revisada |
| `/exclusao-de-dados` | R188 | revisada |
| `/i/[token]` | R186 | revisada |
| `/jogadores` | R171 | revisada |
| `/jogadores/[id]` | R171 | revisada |
| `/lili` | R187 | revisada |
| `/login` | R185 | revisada |
| `/managers` | R175 | revisada |
| `/managers/[id]` | R175 | revisada |
| `/politica-de-privacidade` | R188 | revisada |
| `/produtoras` | R173 | revisada |
| `/produtoras/[id]` | R173 | revisada |
| `/rank` | R177 | revisada |
| `/termos-de-servico` | R188 | revisada |
| `/vagas` | R179 | revisada |
| `/vagas/compra/[token]` | R180 | revisada |
| `/vendas/[token]` | R182 | revisada |
| `/vendedor/[token]` | R182/R186 | revisada |
| `/vendedores/[managerId]` | R179 | revisada |

**Total encontrado na árvore atual: 43 rotas Next `page.tsx`; 43 classificadas acima.**
