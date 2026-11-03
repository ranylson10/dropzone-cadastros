# DropZone — R22: cinco painéis, ações diretas

Base: R21 (cadastro rápido de campeonato, equipe e jogador). A R22 é **somente interface**: não modifica tabelas, dados, pagamentos, permissões ou rotas de API.

## O que mudou

| Perfil | Ao abrir o painel | Ferramentas avançadas |
|---|---|---|
| Produtora | Criar campeonato, abrir campeonatos e acompanhar equipes | Financeiro, equipe interna, permissões, configurações |
| Equipe | Gerenciar elenco, procurar competição e ver agenda | Treinos, estatísticas, staff, convites, configurações |
| Jogador | Encontrar equipe, competições e agenda | Estatísticas e edição de perfil |
| Manager | Início com vínculos de equipes e jogadores; entradas diretas | Edição de perfil |
| Vendedor | Área **Vendas** do manager, separada da gestão: link, contato, carteira | Configuração comercial, anúncios e detalhes de vendas |

No código legado, o perfil manager também atua como vendedor. A R22 separa **as áreas do painel**, sem criar um novo tipo de usuário ou mexer na autorização. Rotas antigas como `vendas`, `campeonatos` e `produtora` continuam abrindo a seção comercial.

## Componente

`web/components/workspace/WorkspaceFocus.tsx` renderiza até três ações prioritárias por perfil. Ele usa links ou botões reais, respeita `disabled`, identifica a área para leitores de tela e utiliza os mesmos handlers de cada painel. O estilo está em `web/styles/workspace-r22.css`, com layout próprio para celular, controle de overflow e preferência por movimento reduzido.

## Testes

```bat
TESTAR_RODADA_22.bat
```

O CI também executa `npm run test:round22`. Testes de integração autenticados em navegador e build integral desta versão precisam rodar em ambiente com dependências instaladas. Nenhum SQL foi aplicado.

## Próximo passo

R23: refino de identidade visual, transições e adaptação mobile em páginas internas, com teste visual autenticado nas larguras 360, 390, 768 e desktop.
