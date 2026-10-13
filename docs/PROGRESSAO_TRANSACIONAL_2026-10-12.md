# Progressão entre etapas — preparação transacional

12/10/2026, America/Sao_Paulo. Preparação local, sem aplicação no Supabase ou publicação. `PROGRESSION_WRITE_MODE` permanece `legacy`. Este trabalho encerra a implementação e o ensaio local do candidato de progressão; não encerra a pendência de transações do projeto, que inclui temporada, estrutura, integração e staging.

## Problemas e correções preparadas

**PR02/P2 — validador publicado consulta uma coluna inexistente.** A definição de `fn_validar_campeonato_etapa_equipe_85c()` consultava `ce.campeonato_id` na tabela `campeonatos`, cuja chave é `id`. O catálogo atual salvo e o corpo histórico têm o mesmo MD5 `601c899761abdf8dafbd0878199187c1`. A reconstrução nativa reproduziu a falha ao inserir um vínculo válido. O candidato troca somente essa expressão por `ce.id`, depois de conferir o hash e o trecho exatos. Definição desconhecida ou reaplicação recusa a alteração. A consulta agregada anterior encontrou zero vínculos de etapa: não houve comprovação de incidente com usuários reais.

**PR03/P2 — aplicação e reversão independentes.** O fluxo legado cria execução, escreve vínculos e itens e altera a origem em requisições separadas. A reversão legada não restaura toda a posição/marcação anterior da origem. O candidato calcula a classificação no banco, compara a prévia apresentada e aplica ou reverte tudo na mesma transação, incluindo recibo e imagens privadas. As alterações ainda não estão em produção.

O [candidato SQL](E:/dropzone-cadastros/docs/sql/20261012_progression_candidate.sql) depende do espelho de slots e do helper de permissões candidatos, além do catálogo público atual. As imagens guardam estado completo antes/depois dos vínculos e do histórico público. A reversão confere todas as imagens antes de restaurar campos de negócio, incluindo posição e marcadores anteriores da origem. Vínculo novo de destino passa a `retirada`, preservando a referência histórica. Execução histórica sem imagens privadas é recusada; não se tenta reconstruir seu estado anterior por suposição.

Seis gatilhos coordenam escritores comuns de vínculos, fases, regras, resultados, execuções e itens por meio das mesmas etapas/fases. A revisão monotônica dos vínculos detecta uma alteração que tenha sido desfeita posteriormente. Resultados concorrentes, uma fase nova e o preenchimento da última vaga foram observados esperando travas nativas; o excesso de capacidade foi recusado após o commit da progressão. Alterações posteriores nos vínculos ou no histórico impedem a reversão.

Isso não garante ausência de deadlocks. A ordem de travas dos gatilhos de linha pode inverter a de outros escritores. O transporte repete apenas um erro `40P01` conhecido como transação abortada, uma vez, com o payload original; prévia obsoleta não recebe repetição automática. Referências: [travas do PostgreSQL 17](https://www.postgresql.org/docs/17/explicit-locking.html) e [comportamento dos gatilhos](https://www.postgresql.org/docs/17/trigger-definition.html). A repetição de deadlock foi verificada no transporte fictício; não foi reproduzido um deadlock nativo específico. Phantoms de permissões e os demais escritores do inventário continuam no fechamento geral.

## Transporte e interface

O [transporte](E:/dropzone-cadastros/backend/src/campeonatos/progression-transport.ts) usa somente a RPC em modo `atomic`, com limite de 20 segundos e diagnóstico privado oculto. Autenticação e permissão precedem o corpo nas rotas. O GET informa a flag e a própria conta autorizada, sem cache. A URL dedicada `/estrutura-avancada/progressao-atomica` recusa flag desativada, configuração inválida e RPC ausente; não encaminha ao caminho legado. A URL canônica preserva compatibilidade em `legacy`, e em `atomic` exige o contrato transacional.

A [interface](E:/dropzone-cadastros/web/features/campeonatos/estrutura-avancada/AdvancedStructureTab.tsx) conserva UUID e corpo originais antes do envio. A tentativa pertence à conta/campeonato; a sessão é relida depois da persistência. Falha de armazenamento impede o envio. Resposta perdida, HTML inesperado, recibo incompatível e rota desativada mantêm a tentativa. O cliente limita a espera HTTP a 30 segundos: timeout mantém a tentativa e libera a trava local, sem presumir rollback do servidor. A repetição usa a URL dedicada e os mesmos dados mesmo após a flag informada pelo GET voltar a `legacy`. Encerramento local exige confirmação depois de conferir vínculos/histórico e não reverte o servidor.

O armazenamento por aba contém a prévia, os snapshots e o motivo limitado da reversão; não contém credenciais. A chave de armazenamento separa conta/campeonato e um checksum detecta corrupção/cópia acidental do registro. Não é defesa contra código malicioso na mesma origem. Fechar a aba ou limpar seu armazenamento pode eliminar a recuperação local; retenção e reconciliação no servidor ainda precisam de política de rollout.

A camada do cliente compartilha a trava de operação existente no mesmo runtime e impede intenções concorrentes de progressão. Mudança de conta/campeonato, retorno A–B–A observado por renderizações e desmontagem invalidam callbacks antigos. Confirmação recebida encerra a tentativa antes da recarga: se a leitura seguinte falhar, a tela informa que a operação foi confirmada e pede atualização, sem tratá-la como mutação desfeita. Isso não torna as outras gravações legadas da estrutura transacionais.

## Evidência e limites

- **53 cenários PostgreSQL 17.6 aprovados.** Banco local novo com 118 tabelas e 14 views exatas do catálogo salvo; tipos, constraints, índices, políticas e 76 gatilhos publicados preservados. Os 74 corpos históricos foram confrontados com os MD5 atuais antes da reconstrução. Auth/JWT/Realtime e grants de infraestrutura são fictícios, não uma réplica completa do Supabase. Cinco corpos compilados e seis gatilhos novos conferidos contra o candidato final.
- **47 verificações HTTP/cliente aprovadas.** SDK Supabase real, handlers Next e armazenamento com respostas fictícias: permissão, UUID, erros privados, flag, recuperação, mudança de intenção, conta, persistência, timeout e concorrência local.
- **12 cenários do componente aprovados**, seis em Chromium desktop e seis em viewport móvel: aplicação/reversão, resposta perdida, remount, flag desativada, prévia obsoleta, encerramento explícito, troca A–B–A e recarga falha após confirmação. O componente e hooks são reais; Auth/HTTP/feedback, campos cosméticos e ícones são adaptados. Não é QA visual, modal real, dispositivo, Supabase staging ou navegação de todas as páginas.
- **Dez contratos estáticos anteriores aprovados.** A validação final do projeto e seus logs estão vinculados no relatório de correções.

O ranking nativo foi comparado com a função JavaScript existente usando resultados da view publicada reconstruída: pontuação normal, empate completo e 1.005 linhas de detalhe. Limites recusados pelo candidato: mais de 50 mil linhas de detalhe, mil participantes classificados, dois mil vínculos de destino ou quatro MiB de argumentos. Não se certificou desempenho sob carga.

Os logs iniciais são preservados: fixture tentou coluna ausente, depois reproduziu o validador quebrado e tentou duplicar partida já criada pelo gatilho publicado. A expectativa de revisão de equipe não selecionada também foi corrigida. Nenhuma constraint/gatilho foi relaxado para aprovar os testes. O primeiro teste de navegador usou um seletor de label incompatível com a fixture e foi substituído pelo papel/nome acessível; as execuções finais foram completas, sem retries do runner.

Fonte: [evidências desta continuação](E:/dropzone-cadastros/relatorios-testes/progressao-transacao-2026-10-12/). Contêiner sem rede, portas ou mounts do host; uma instância/volume identificados removidos e Docker restaurado ao estado parado. Nenhuma nova consulta ou escrita remota, alteração de Auth/env remoto, commit, push, PR ou deploy.

## Antes de ativar

O registro de [pendências de fechamento](E:/dropzone-cadastros/docs/PENDENCIAS_FECHAMENTO_2026-10-12.md) permanece a referência. São necessários dump/backup/restauração, revisão de DDL/owners/ACL atuais, ensaio em staging real e decisão para execuções históricas sem imagens. Também faltam temporada e demais gravações de estrutura, permissões concorrentes, compatibilidade dos clientes antigos, demais writers, retenção/reconciliação e QA integral.

Desativar a flag faz a rota dedicada recusar as tentativas guardadas. Não apagar recibos, imagens ou gatilhos como rollback improvisado: isso elimina a evidência necessária para conciliar respostas perdidas. A reversão da operação e a reversão da migration são decisões diferentes. Não foi preparada nem executada aplicação remota ou migration destrutiva de rollback.
