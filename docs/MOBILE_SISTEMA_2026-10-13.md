# Mobile no navegador — revisão das rotas e telas internas

Lote posterior a `3c773844`. O pedido é reorganizar as telas como uma aplicação móvel, incluindo páginas auxiliares, subabas, formulários e diálogos. Largura sem transbordamento, isoladamente, não foi usada como aprovação visual.

## Correção posterior do ranking

A captura seguinte do usuário mostrou que `/rank` ainda conservava a composição de desktop: abas com duas molduras, descrição grande, busca e metodologia em caixas e lista com cabeçalho e faixas de tabela. A aprovação visual anterior dessa tela foi insuficiente.

O ranking mobile agora tem título curto com ajuda/atualização, abas simples com indicador, busca com limpeza, contagem e horário discretos, e lista contínua de posição, identidade, score e tier. Cabeçalho de tabela, faixas alternadas, selo de tier e textura decorativa foram retirados no celular. Nomes podem ocupar duas linhas; todas as estatísticas continuam nos detalhes. Equipes, jogadores e campeonatos usam a mesma composição. Ajuda e detalhes abrem como folhas na parte inferior; textos longos não são truncados nos detalhes. As linhas são botões nativos em lista ordenada, mantendo ativação por teclado.

O cálculo, a ordem, os scores, os tiers e a API não foram alterados. A busca conserva a posição original. A primeira leitura não mostra um falso estado vazio, e uma falha de atualização conserva os resultados anteriores para nova tentativa.

Evidências locais em `relatorios-testes/rank-mobile-2026-10-13`: página Next compilada em 320/360/390/430 e desktop1280, três modos, detalhes/estatísticas adicionais, ajuda, busca com posição original, limpeza/troca de aba, vazio, erro, carregamento e recuperação. As combinações controladas usam apenas fixtures GET locais; contrato de publicação/privacidade do ranking também foi executado sem gravações. CI, deploy e conferência pública posterior ficam em `final.json` nesse diretório. Isso corrige a tela apontada; não é certificação de todos os estados do sistema nem de aparelho físico.

## Correções

- Acesso, agenda, carteira, carrinho, afiliados, leitura de documentos, convites e ferramentas de operação passam a usar a hierarquia de superfícies, texto e ações do mobile. Banners, caixas aninhadas e cabeçalhos duplicados foram reduzidos em áreas específicas. Comprovantes, documentos editáveis e conteúdo autoral de transmissão conservam seus papéis próprios.
- Edição de campeonato ganhou seções navegáveis. A estrutura avançada ganhou seções recolhíveis no celular, mantendo os campos montados e os valores ao fechar e reabrir. Os campos continuam expostos no desktop.
- O menu da conta excedia a tela em 271 px. Agora ocupa uma folha dentro da viewport. A denúncia tinha o cancelamento coberto pela navegação inferior; passou ao diálogo compartilhado. Também foram migrados os diálogos de acesso de manager, venda, detalhe de vaga de convite, transferência de jogador, horário de jogo e comprovante.
- O pontuador apresentava campos escondidos e controles sobrepostos mesmo com transbordamento horizontal zero. No mobile, os registros agora distribuem os campos com seus rótulos em duas colunas, mantendo os cabeçalhos semânticos da tabela. Os controles de equipes, MVP, jogo e mapa permanecem disponíveis.
- A Lili ganhou retorno ao início e mantém o compositor em sua própria área de rolagem. O atalho flutuante foi retirado do mobile; a navegação continua dando acesso à assistente.
- Histórico e logs da Central do Campeonato tinham fundo claro com texto do tema escuro. Foram corrigidos junto com os contornos excessivos da área de desempenho. A marca oficial foi preservada nas máscaras e nos fallbacks; um seletor de subtítulo que também ocultava o símbolo no login foi corrigido.
- O desempenho do jogador mostrava várias telas de gráficos/metas/telemetria vazios. Sem partidas no recorte, agora mostra uma única mensagem com os filtros disponíveis. Com resultados, as análises continuam presentes; a troca para um campeonato vazio e a volta para as últimas cinco partidas são conferidas com fixture local.
- Um convite de elenco que falhava na leitura ainda mostrava “Aceitar convite”. O estado sem dados agora exibe indisponibilidade e retorno ao início, sem mensagem técnica do banco. Isso não corrige a incompatibilidade de banco descrita abaixo.

## Cobertura e evidência

Arquivos locais em `relatorios-testes/mobile-sistema-2026-10-13`, ignorados pelo Git. Sessões de teste e capturas autenticadas não são publicadas.

- Inventário de fontes: 43 rotas e 16 subáreas, com hashes das fontes. O inventário estático não certifica aparência ou arquitetura.
- Navegador Chromium local: todas as 43 rotas em 320 e 390 px, nos estados públicos/de acesso disponíveis; carteira, agenda, carrinho, central, afiliados e Lili também com sessões próprias de produtora/equipe. Nas rotas por token, esta varredura usa token inválido.
- Perfis: 28 abas principais dos cinco perfis, subabas disponíveis, criação de line, menus e estados de acesso/denúncia. A revisão final tem 90 capturas de interação; são estados amostrados, não 90 páginas distintas.
- Conteúdo condicional com respostas GET fictícias: 150 amostras dos componentes reais de Calls, estrutura avançada, formulários dos quatro perfis, criação e edição dos cinco formatos de campeonato, exportação/transmissão e passagem para estúdio local. O laboratório temporário foi removido antes do build de publicação.
- Convites/links: 34 amostras com respostas locais fictícias, incluindo vagas abertas/fechadas, compra paga, escalação, mesa de transmissão e detalhes de slots; seis amostras adicionais dos diálogos de manager/venda/transferência. Não houve aceite, envio, pagamento ou transmissão.
- Carteira/comprovante, agenda/edição de jogo, carrinho/cobrança e pontuador: 36 estados com GETs fictícios na aplicação compilada. Impressão do comprovante foi renderizada para PDF com dados fictícios, sem acionar impressora ou movimentar dinheiro.
- Abas públicas e gestão de um campeonato de teste: 22 capturas, incluindo uma em desktop. A captura inicial de Vendas ainda estava carregando; `sales-check.json` registra a conferência complementar após o carregamento terminar.
- Diálogo e formulário compartilhados: 38 verificações de cada componente. Seções recolhíveis: teclado, associação ARIA, exclusão dos campos ocultos da sequência de foco, preservação dos valores e visibilidade desktop em 320/390 → 1280 px.
- Conferências complementares após os últimos ajustes: marca visível no login, erro de convite sem botão de aceite, histórico/logs abertos, menu da conta e desempenho com dados/sem dados/restaurado. As rotas são compiladas; somente o histórico preenchido do jogador usa fixture GET explicitamente local. Esses resultados ficam em `utilities.json` e `profiles.json`.
- Lint e build de produção; regressão de 43 suítes de segurança/contratos. A CI do commit publicado repete as verificações configuradas do projeto. A confirmação de CI, deploy, alias e amostras públicas está em `final.json` local após a publicação.

As leituras públicas e das sessões próprias usam dados reais. As amostras de formulários/fluxos condicionais usam fixtures explicitamente locais e montam os componentes reais; não demonstram integração nem autorização desses fluxos. Os testes bloquearam gravações da aplicação, permitindo apenas renovação das sessões de teste já existentes. Fontes externas foram bloqueadas para isolar o layout; não é medição de desempenho de rede.

O contraste automatizado considera texto sobre fundos sólidos. Imagens, gráficos SVG, conteúdo autoral, controles desabilitados e áreas inertes têm limites próprios e não são certificados por esse cálculo. As capturas também foram inspecionadas para composição, densidade, hierarquia e campos visíveis.

## Limites e pendências funcionais

- Não foram fornecidos links válidos de convite/compra/OBS. O usuário pediu para continuar sem eles. A revisão de seus layouts com fixtures não é confirmação de acesso válido em produção.
- A leitura real de `/equipe/entrar/[token]` retornou erro de coluna `campeonatos_2.jogadores_por_equipe`. O botão indevido e a exposição da mensagem técnica foram corrigidos na interface. A consulta e sua compatibilidade com o esquema atual permanecem para a pendência de integração/banco; o fluxo de aceite real não foi certificado.
- Não foram executadas compras, pagamentos sandbox, alterações de placar, saques, exportações reais, envio de convites, gravações de cadastros ou mudanças de transmissão.
- QA em aparelho físico, Safari/iOS, teclado virtual real, zoom, leitor de tela, todas as combinações de dados/permissões e desktop instalado continua pendente. Nenhuma afirmação de “todas as telas sem qualquer bug” decorre deste lote.
- Migrations, flags transacionais e configurações de autenticação não foram alteradas. O audit online da raiz continua sem consulta, conforme decisão do usuário. As pendências originais de banco, escritores, acessibilidade, arquitetura e aplicativos permanecem registradas em [pendências de fechamento](PENDENCIAS_FECHAMENTO_2026-10-12.md).
