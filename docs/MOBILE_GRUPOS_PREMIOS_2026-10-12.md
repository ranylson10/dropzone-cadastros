# Grupos e premiações no mobile — 12/10/2026

O cliente mobile de criação individual de grupo e slots está preparado para o contrato transacional existente. O painel de premiações também foi corrigido para impedir que respostas e confirmações antigas continuem atuando após troca de conta ou campeonato. As alterações são locais; os caminhos transacionais continuam dependentes de staging e ativação, com flag padrão legacy.

## Criação de grupo

`ChampionshipManagementScreen` agora usa `MobileStructureGroupPanel`. A leitura confirma o modo atomic, a permissão de organizar grupos, a identidade da conta e as fases do campeonato. Grande Final permanece fora da criação manual. Nome, fase e quantidade de slots são enviados pelo contrato compartilhado, com sessão atualizada antes das chamadas.

A conferência de capacidade é seguida da gravação com a revisão opaca retornada pelo servidor. Antes dessa gravação, o aparelho persiste a intenção, seu corpo e a chave de idempotência. Se a resposta se perder, a recuperação repete exatamente a mesma intenção e chave, com credencial atualizada. Uma tentativa pendente impede outra criação; callbacks antigos não geram novas operações. Não há retorno ao writer legado.

Trocas de conta/campeonato invalidam leituras, formulários e confirmações, incluindo a sequência conta A → B → A. A recuperação continua disponível se a leitura posterior falhar ou passar a indicar legacy; a autorização da repetição é decidida pelo servidor. Encerrar a tentativa é uma ação local e não exclui um grupo que já possa ter sido criado.

## Premiações e leituras privadas

O conteúdo de premiações é remontado por conta, campeonato e geração da sessão. Respostas privadas atrasadas e rascunhos da conta anterior não substituem o painel atual. As leituras privadas e ações usam uma sessão obtida no momento da chamada, em vez da credencial antiga recebida por propriedade.

A confirmação de exclusão é consumida uma única vez e fica inválida após a troca de contexto. A gravação confirmada mantém seu aviso de sucesso mesmo se a atualização posterior da tela falhar.

**Isso não torna as gravações de premiação transacionais ou recuperáveis por recibo.** Elas continuam usando as ações existentes. A revisão da atomicidade desses writers, dos demais callbacks do painel principal e de fase/lote/resize/exclusão de estrutura permanece no registro de pendências.

## Verificação

- 27 verificações do cliente real de grupos: contrato, sessão, armazenamento, chave/corpo originais, concorrência, timeout, resposta inválida e ausência de fallback.
- 36 verificações com componentes React reais: 22 de grupos e 14 de premiações, em larguras 390 e 1280. Os testes usam adaptadores para primitivas React Native, Alert, Auth, HTTP e armazenamento; não certificam aparelho nem aparência nativa. O componente irmão de lifecycle foi substituído apenas nos testes focados em premiações.
- 43 suítes de segurança da raiz, tipos, lint e build passaram por `check:code`.
- Dois contratos estáticos mobile, tipos do aplicativo e exportação JavaScript Android passaram. Exportação JavaScript não equivale a APK instalado ou iOS assinado.

As falhas iniciais de sintaxe/tipagem e a expectativa incorreta de igualdade da credencial entre repetição e primeira chamada estão preservadas nos logs. O teste final exige o mesmo corpo/chave e uma credencial atualizada, sem enfraquecer a recuperação original.

Não houve nova consulta de audit. O audit online anterior do mobile continua com 23 pacotes altos reportados; o resultado anterior de produção web foi zero. O audit online de produção da raiz continua não verificado por escolha do usuário, com guarda de release local retornando 2. Esses resultados anteriores não foram repetidos neste lote.

Os 18 SQLs datados anteriores foram conferidos por hash e permanecem iguais. Nenhum banco foi iniciado ou testado novamente neste lote. Não houve SQL/MCP ao projeto, alteração remota, commit, push, PR ou deploy. O tráfego de leituras externas do build normal não foi instrumentado.

## Evidências e limites

[Verificação consolidada](E:/dropzone-cadastros/relatorios-testes/mobile-grupo-premios-2026-10-12/final-verification.json), [manifesto de hashes](E:/dropzone-cadastros/relatorios-testes/mobile-grupo-premios-2026-10-12/final-artifacts.json) e [pendências de fechamento](E:/dropzone-cadastros/docs/PENDENCIAS_FECHAMENTO_2026-10-12.md).

Os 26 achados originais continuam com 20 corrigidos e seis parciais. A matriz integral de subpáginas/layout/acessibilidade, os writers já identificados, staging/ativação e QA físico mobile/desktop continuam pendentes. Quantidades de testes e lotes não representam percentual de prontidão.
