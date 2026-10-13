# Painel mobile e matriz de fontes — 12/10/2026

O painel principal de administração mobile foi corrigido para descartar respostas, rascunhos e confirmações antigas após troca de conta, perfil ativo, campeonato ou desmontagem. O inventário de layout agora gera uma matriz atual de fontes, sem apresentar presença de arquivos como aprovação visual ou arquitetural.

## Painel principal

Antes, `loadList` e `loadDetail` aplicavam seus resultados sem verificar se a conta/campeonato ainda eram os mesmos. A confirmação de exclusão capturava a seleção e a credencial antigas. Uma resposta lenta podia substituir o detalhe atual; uma confirmação aberta anteriormente podia iniciar uma ação no contexto anterior.

O painel é remontado quando muda a conta, o perfil ativo ou a seleção externa. A seleção interna também possui geração própria; detalhes e subpainéis só ficam disponíveis quando o resultado pertence à geração atual. Listas e detalhes têm contadores independentes, impedindo que uma consulta anterior substitua uma recarga mais recente. A resposta tardia da lista não apaga um erro de leitura do detalhe.

As leituras e ações próprias do painel obtêm uma sessão atual antes da chamada e verificam novamente o contexto após a resposta. Confirmações de exclusão são consumidas uma vez; cancelar, trocar de contexto ou desmontar invalida a confirmação. A preparação de imagem verifica o contexto depois das etapas assíncronas, e um upload anterior não continua criando o campeonato após troca de conta. Operações locais em andamento impedem reentrada.

O botão de voltar também foi corrigido: a seleção externa era reaplicada ao alterar a seleção interna, reabrindo o campeonato. A seleção externa agora inicializa o conteúdo quando seu contexto muda, permitindo voltar e escolher outro campeonato normalmente.

**Limites:** uma chamada já enviada pode persistir no servidor mesmo que o usuário troque de contexto. Upload e criação de campeonato continuam separados; fase/exclusão e criação completa não ganharam recibos ou transação única neste lote. Os demais subpainéis mantêm seus próprios contratos e não receberam certificação integral por estes testes.

## Matriz de páginas e subáreas

`audit-layout-pages.mjs` verificava apenas a relação de nomes de rotas e a existência de 16 arquivos. Seu resultado não demonstrava layout novo, renderização das subáreas ou arquitetura aprovada.

O script agora registra as **43 rotas e 16 subáreas**, com **326 fontes alcançáveis por imports estáticos/literais**, layouts ancestrais, CSS importado, referências declaradas de testes e hashes. Resultados antigos de navegador aparecem identificados como históricos e sem vínculo com os hashes atuais. Imports dinâmicos não literais, pacotes, CSS condicional e todos os estados renderizados não são certificados por essa análise.

Cada entrada declara explicitamente que navegador atual, contraste, zoom, teclado, modais, branches condicionais, arquitetura e conformidade visual ainda não foram certificados. A presença de uma família compartilhada no grafo indica uma importação disponível; não demonstra que ela foi montada naquele estado da página.

[Matriz atual](E:/dropzone-cadastros/relatorios-testes/painel-matriz-2026-10-12/layout-matrix.json). Não houve nova navegação web nem nova medição visual neste lote.

## Validação local

- 32 cenários com o componente React real do painel principal, em 390 e 1280 px, com Auth, HTTP, galeria e primitivas React Native adaptados. Os componentes filhos foram substituídos nesses testes focados no pai.
- 36 cenários anteriores de grupos/premiações repetidos após a ampliação do adaptador.
- Dois contratos estáticos mobile, tipos do app, 43 suítes de segurança, tipos/lint/build web/backend e exportação JavaScript Android.

O primeiro teste revelou o problema de retorno à lista; a evidência inicial foi preservada. As verificações de ausência de conteúdo antigo foram ajustadas para incluir o sufixo de revisão da fixture. A primeira execução dos contratos estáticos foi interrompida por `spawn EPERM`; a execução final fora dessa restrição passou. Esses testes não equivalem a dispositivo físico, staging ou renderização nativa.

O fechamento também encontrou metadados inválidos do canvas, com bytes zero. A cópia foi abortada antes de alterar o destino; o arquivo inválido foi preservado, os metadados foram regenerados, os tipos conferidos novamente e a cópia final validada por hashes. A causa dos bytes zero não foi determinada. O canvas passou na verificação de tipos; sua renderização não foi certificada.

Nenhuma dependência ou SQL candidato foi alterado; os 18 SQLs e o pacote/lock mobile anteriores foram conferidos por hash. Nenhum novo audit, ensaio de banco, SQL/MCP ao projeto, alteração remota, commit, push, PR ou deploy. Audit online da raiz permanece não verificado por escolha do usuário. Os resultados anteriores de dependências não foram repetidos; mobile continua com 23 pacotes altos reportados no último audit online. Leituras externas do build normal não tiveram o tráfego instrumentado.

[Verificação](E:/dropzone-cadastros/relatorios-testes/painel-matriz-2026-10-12/final-verification.json) · [Hashes](E:/dropzone-cadastros/relatorios-testes/painel-matriz-2026-10-12/final-artifacts.json) · [Pendências](E:/dropzone-cadastros/docs/PENDENCIAS_FECHAMENTO_2026-10-12.md).

Os 26 achados originais continuam com 20 corrigidos e seis parciais. Staging/ativação, writers já identificados, dependências/dispositivos e matriz integral de estados/layout/acessibilidade continuam pendentes; contagens não representam prontidão.
