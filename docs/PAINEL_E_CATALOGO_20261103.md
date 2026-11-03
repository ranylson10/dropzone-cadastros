# Painel e catálogo com a mesma estrutura — 03/11/2026

Os painéis de produtora, equipe e jogador passam pelo mesmo `StorefrontHeader` do catálogo: faixa superior, navegação lateral no desktop e navegação inferior no celular. O `PlatformPageBody` compartilha o limite de 1160 px e os recuos do conteúdo. O módulo dos painéis deixa de definir uma largura própria.

O seletor de painéis continua no topo do PC e na barra inferior do mobile, usando os contextos autorizados do servidor. A troca dentro de um painel preserva o fluxo existente e volta ao início da página. O destino Início também sai do estado operacional quando a navegação acontece na mesma rota; Painéis recebe o estado ativo enquanto um perfil está em operação. Carteira, notificações, idioma, edição da conta e administração autorizada ficam acessíveis no menu da conta; a administração é consultada em `/api/admin/session`.

Na gestão de campeonatos, o cabeçalho escuro e o assistente roxo foram substituídos por `WorkspaceHeader`, `WorkspaceMetrics`, `WorkspaceNav`, `WorkspaceSubnav` e `WorkspaceMoreMenu`. A seleção e o checklist usam `DataList`, com faixas alternadas e linhas compactas. Indicadores e instruções duplicadas foram retirados. A lista não fica mais fixa ao rolar, evitando sobrepor o campeonato selecionado.

A paleta canônica agora também resolve `--ui-surface-elevated`, que antes caía no fundo escuro antigo. Corrigidos textos secundários e filtros de participantes, seleção de subabas, mensagens de erro, contraste da classificação e nome do período financeiro. A tabela de classificação tem cabeçalhos/células acessíveis e pode receber foco para rolagem por teclado.

Validação local: build completo, TypeScript, lint, segurança e contratos de tema/navegação. Os 16 cenários da suíte de experiência passaram em desktop e Pixel 7. A suíte compara geometria e componentes entre catálogo, painel e campeonato selecionado; verifica a barra lateral recolhida, troca de perfis, foco/Escape, métricas, menu da conta e as áreas Participantes, Operação, Resultados e Financeiro. Inclui dados controlados de um campeonato com equipes e estrutura, inspeção axe e ausência de transbordamento. Evidências em `relatorios-testes/workspace-layout/experience-unified-final.log` e `relatorios-testes/experience-results`.

Regressão adicional: 26 cenários aprovados, cobrindo permissões de vice-líder, revogação, seletor de perfis, retorno ao início, contagens, carregamento por área, troca rápida de campeonato e descarte de respostas antigas. Total local: 42 cenários E2E aprovados.

Esses testes não gravam em contas reais. Não houve migração de banco nem mudança de permissões ou de regras de cobrança.

O CI usa um servidor de catálogo vazio, restrito a GET/HEAD e ligado somente ao loopback, para renderizar a moldura real de `/campeonatos` sem consultar um endereço fictício ou exigir credenciais de produção. A reprodução local do ambiente de CI passou nos 16 cenários; requisições de escrita ao servidor de teste retornaram 405. A publicação da interface também passou em oito cenários no domínio, com as APIs de conta controladas pelo teste.
