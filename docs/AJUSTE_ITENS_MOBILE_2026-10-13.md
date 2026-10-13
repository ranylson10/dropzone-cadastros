# Reorganização dos itens no navegador do celular

As capturas enviadas pelo usuário mostraram que retirar os cards não bastava: nomes/tags, descrições genéricas, indicadores e três botões ainda estavam empilhados. A revisão anterior mediu limites de largura e altura, mas não assegurou uma composição adequada dos itens. Este lote corrige essa organização.

Equipes, jogadores, produtoras e managers usam miniatura e identificação à esquerda, com os indicadores reunidos abaixo do nome. Tags redundantes e a descrição genérica repetida saem da apresentação mobile da lista; os dados completos continuam no perfil e na apresentação desktop. Nome, tag e usuário seguem disponíveis; nomes longos ocupam até duas linhas. A lista real de equipes apresentou linhas de 64 px, com variação para usuários/nomes longos.

Na home, o título tem prioridade sobre a produtora e o formato. Preço e quantidade de vagas ficam juntos, e favorito/carrinho ocupam uma coluna à direita com alvos de 44 px. A informação padrão “Vagas abertas” deixa de repetir a quantidade; situações específicas, últimas vagas e participação continuam visíveis. O link de informações padrão é substituído visualmente pelo acesso no nome/imagem; callbacks específicos de informações continuam disponíveis. Os três campeonatos públicos medidos na home ficaram em linhas de aproximadamente 105 px. O catálogo preserva preço, vagas, premiação e próxima data na apresentação mais compacta.

Categorias têm atalhos discretos; os links do rodapé ficam sob “Ajuda e informações”. A Lili fica acessível no menu e seu botão flutuante deixa de cobrir os itens das páginas públicas no celular. A apresentação desktop e as regras de compra/inscrição permanecem preservadas.

Também foi concluída a correção de teclado dos cabeçalhos que estava em andamento quando o usuário enviou as capturas. Conta, idioma e navegação têm Escape, foco inicial e retorno ao acionador. Os popups não modais fecham quando o foco segue para outro controle. Ações rápidas passam pelo Dialog compartilhado, com fundo isolado, sequência de Tab dentro da janela e restauração de foco/rolagem. A janela fica no rodapé da tela mobile. Mudanças somente de altura não fecham a busca; mudança de largura fecha o menu.

Evidência local: `relatorios-testes/itens-mobile-2026-10-13` e `relatorios-testes/cabecalhos-2026-10-13`. Conferências em Next real, com dados/imagens públicos reais para as listas; callbacks de estados pendentes/sem vagas/favorito/carrinho usam uma fixture local. Requisições de gravação são bloqueadas. Cabeçalhos usam conta fictícia e APIs interceptadas; não executam upload, troca de conta ou logout. Rotas de conferência são removidas antes da compilação.

Passaram 28 combinações de página/largura (320, 390, 430 e 1280 px), 12 cenários dos cabeçalhos, 38 regressões do Dialog compartilhado e as 43 suítes de segurança existentes. Os testes de apresentação bloqueiam importações de fontes externas; não medem velocidade de rede. O teste de resize espera a atualização do React após o evento do navegador. Capturas incluem a composição desktop para conferir sua preservação.

A compilação de produção passou, incluindo TypeScript; as duas rotas temporárias de conferência foram retiradas. O registro final de publicação, CI e amostra em produção fica em `relatorios-testes/itens-mobile-2026-10-13/final.json` após a publicação autorizada.

A verificação não certifica celulares físicos, Safari, leitor de tela, zoom real nem toda a matriz de subáreas autenticadas. L03 e as outras cinco pendências originais continuam parciais. Nenhuma migration, flag transacional ou dependência foi alterada; o audit online da raiz continua dispensado pelo usuário.
