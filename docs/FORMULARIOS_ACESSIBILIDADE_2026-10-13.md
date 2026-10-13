# Formulários compartilhados e localidade — 13/10/2026

O campo compartilhado agora associa rótulo, dica e erro aos componentes Input, Select e Textarea, inclusive quando estão dentro de um componente intermediário. A busca de localidade aceita seleção por teclado. Um checkbox que herdava largura de campo de texto foi corrigido: a amostra em viewport de 320 px passou de largura de documento 327 para 320 px, sem elementos excedentes. L03 continua parcial; esta etapa não certifica todas as subpáginas.

## Mudanças

Field usa IDs gerados por instância e contexto para nome e descrição acessíveis. Um único controle canônico direto recebe associação por htmlFor, permitindo foco ao clicar no rótulo. Controles aninhados recebem aria-labelledby; campos internos substituem o contexto externo. IDs e nomes ARIA definidos pelo consumidor são preservados. Descrições existentes são combinadas sem duplicar referências; erros atualizam aria-invalid e a descrição. O indicador obrigatório usa aria-required, preservando a validação de negócio existente, sem acrescentar required nativo. A associação segue as orientações de [rótulos de formulários do W3C](https://www.w3.org/WAI/tutorials/forms/labels/).

LocationSearch expõe combobox/listbox, opção ativa e estado aberto. Setas percorrem os resultados mantendo foco no campo; Enter escolhe a opção ativa, Escape fecha as sugestões e Tab segue para o próximo controle. Um primeiro Escape dentro do diálogo fecha a lista, e o seguinte fecha o diálogo. Alterar texto ou receber seleção externa limpa a opção ativa; composição de texto por IME não aciona esses atalhos. A seleção por ponteiro usa o mesmo caminho. O comportamento se baseia no [padrão combobox do W3C](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/). Fonte, cache e regras da consulta de localidades foram preservados.

CSS de checkbox/radio canônicos dentro de Field separa suas dimensões das regras de campos textuais. A reprodução e o reflow final incluem checkbox; radio compartilha a regra, sem certificação visual específica neste lote.

## Verificação

- 38 cenários de formulários em Chromium, nos viewports 390 e 1280 px, incluindo reflow em 320 px. Nomes acessíveis, foco pelo rótulo, dicas/erros, ARIA explícita, IDs, campo aninhado, controle fora de Field, checkbox, teclado, seleção externa e Escape no diálogo foram conferidos.
- PlayerRegistrationForm real foi incluído na fixture; Nick, ID, função e senha receberam nomes acessíveis. Cadastro, upload e salvamento não foram executados.
- 38 regressões de diálogo e 14 amostras de contraste/tipografia repetidas após o CSS final; 29 checks estáticos de fundação dos formulários passaram.
- Após o CSS final, check:code concluiu 43 suítes, tipos e lint web/backend. O build parou com spawn EPERM no ambiente restrito; apenas o build foi repetido com autorização e passou. O exit original 1 e a retomada estão preservados. Nenhuma consulta audit online da raiz foi executada.
- Matriz regenerada: 43 rotas, 16 subáreas, 327 fontes com hashes atuais. É inventário estático, sem certificar layout/arquitetura de todas as páginas.

Os testes usam React/componentes e CSSs locais reais. Ícones e o barrel da UI têm adaptadores; Field/Form reais são carregados. Todas as requisições da fixture são interceptadas; resposta de localidade fictícia. Fontes externas são excluídas. Não há página Next completa, aceite de convite, upload, gravação de perfil, leitor de tela, dispositivo físico, zoom real nem todos os temas/estados. Controles HTML brutos ou customizados que não consomem o contexto continuam precisando de associações explícitas. Grupos com vários controles precisam de revisão individual dos rótulos.

## Ocorrências da execução

A primeira fixture não carregava Form pelo adaptador e foi corrigida. Depois, um seletor de teste contava opções selecionadas de outros campos; foi limitado à lista de localidade. Os logs intermediários foram preservados. A execução seguinte encontrou overflow real do checkbox em 320 px, documentado na saída de diagnóstico e no HTML de falha; a medição final está em form-reflow.json. O arquivo de diagnóstico e a captura foram substituídos pelo resultado final; não se apresenta uma captura original selada como evidência.

A revisão automática impediu uma execução por falta de espaço no C:, antes de executar o comando; não foi rejeição por risco. A leitura inicial registrou cerca de 96 MB livres e a seguinte 2,4 GB. Após essa mudança, os testes foram retomados pela revisão normal. Nenhum arquivo pessoal foi removido pelo agente.

## Estado da auditoria

Os 26 achados originais mantêm 20 corrigidos e seis parciais. Os 18 SQLs datados e as dependências móveis mantêm os hashes da etapa anterior; não houve novo audit, acesso SQL/MCP ao projeto, alteração remota, commit, push, PR ou deploy neste lote. As 23 dependências móveis altas referem-se à consulta online anterior. Audit online da raiz continua não verificado por escolha do usuário. Leituras externas do build normal não tiveram tráfego instrumentado.

Staging, ativação dos candidatos, demais escritores já conhecidos, acessibilidade integral, arquitetura restante e QA físico continuam registrados nas [pendências](E:/dropzone-cadastros/docs/PENDENCIAS_FECHAMENTO_2026-10-12.md). GitHub e Vercel continuam etapa posterior.

Fontes: [runtime de formulário](E:/dropzone-cadastros/relatorios-testes/formularios-2026-10-13/runtime.json), [regressão de diálogo](E:/dropzone-cadastros/relatorios-testes/formularios-2026-10-13/dialog-regression-final.json), [matriz](E:/dropzone-cadastros/relatorios-testes/formularios-2026-10-13/layout-matrix.json), [verificação](E:/dropzone-cadastros/relatorios-testes/formularios-2026-10-13/final-verification.json) e [manifesto](E:/dropzone-cadastros/relatorios-testes/formularios-2026-10-13/final-artifacts.json).
