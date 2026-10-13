# Diálogos, planilha e recorte — iniciado em12/10, concluído em13/10/2026

O diálogo compartilhado agora mantém somente a janela superior ativa, bloqueia a interação com o fundo e devolve o foco ao controle de origem. A planilha de stream e o recorte de imagens foram integrados ao mesmo componente. São correções locais de teclado, composição e acessibilidade; a publicação permanece pendente.

## Falhas reproduzidas e correção

Três reproduções com os componentes anteriores confirmaram que o fundo podia receber foco durante um modal, Escape fechava as duas janelas sobrepostas e abrir a planilha não levava o foco para seu conteúdo. Os snapshots anteriores e o resultado da reprodução foram preservados.

`Dialog` utiliza uma lista compartilhada de janelas, ordenada pela posição dos portais no documento. Somente a janela superior trata Escape, Tab, Shift+Tab e fechamento pelo fundo. As demais janelas e elementos de fundo ficam `inert`. Elementos inseridos no fundo durante a abertura também são tratados; os valores anteriores de `inert` e overflow são restaurados no fechamento/desmontagem.

O foco inicial ignora controles ocultos e desativados, inclusive dentro de fieldsets. A sequência de Tab exclui índices negativos; se não houver controles disponíveis, o painel recebe o foco. A restauração verifica se o controle ainda existe e se uma nova janela tomou prioridade. A montagem/desmontagem repetida do StrictMode conserva a origem do foco.

Esses comportamentos seguem o [padrão de diálogo modal da W3C](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/): foco contido na janela, conteúdo de fundo inativo e retorno ao contexto de origem. Não representam uma certificação WCAG integral.

## Consumidores

A planilha de stream passou a usar `Dialog`, com um único título e controle de fechamento. A versão embutida passa a ser uma região, sem semântica de modal ou bloqueio de scroll. CSS específico conserva a largura e deixa a rolagem sob o diálogo compartilhado.

O recorte de imagens usava outro portal diretamente no body. Ele também foi migrado, pois o bloqueio correto do fundo impediria a interação com esse portal ao abri-lo sobre um formulário. Fechar o recorte agora preserva o formulário abaixo. O processamento, salvamento/upload, gestos e regras comerciais da imagem não foram certificados por esta revisão de teclado/cancelamento.

## Evidências

- 38 cenários de componentes React reais em 390 e 1280 px, com amostras adicionais de reflow em 320 px: foco inicial, Tab/Shift+Tab, Escape, sobreposição, fundo inativo, StrictMode, limpeza, planilha modal/embutida e recorte sobre formulário.
- 14 amostras de contraste/tipografia da planilha: título, orientação, rótulos de grupo, letras de coluna, abas, cabeçalhos e números de linha, em duas larguras. Os elementos amostrados têm pelo menos12px e contraste acima de4,5:1. Os rótulos amarelos e textos pequenos encontrados na inspeção visual foram corrigidos, incluindo a regra antiga que sobrescrevia o tamanho dos números de linha. O título apresentou aproximadamente 17,44:1 e a orientação 6,89:1 no ambiente de teste; ambos superaram 4,5:1. A orientação mediu 13,12 px. São amostras de cores computadas, não todas as células, temas, estados ou elementos. O critério de referência foi [contraste mínimo da W3C](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html).
- Botão de fechamento com alvo de pelo menos 44 px na amostra de reflow em 320 px. Reflow de viewport não equivale a zoom real de navegador, pinch zoom ou dispositivo físico.
- 19 checks estáticos do feedback e verificação da fundação UI; 43 suítes de segurança, tipos, lint e build pelo gate de código.

O navegador usou os CSSs locais declarados no layout raiz e os estilos de stream. Imports externos de fontes foram removidos somente na fixture; requisições externas/recursos foram interceptadas. Ícones e serviços de leitura de stream foram adaptados; o componente de recorte usou arquivo local e cancelamento, sem envio de upload. O barrel UI foi encaminhado para os controles reais usados no formulário, sem montar a aplicação inteira. Não houve navegação de todas as páginas Next, leitor de tela ou QA de aparelho.

Falhas intermediárias de harness foram preservadas: carregamento de fonte externa bloqueado; medição antes de terminar a animação; contagem de roles que incluía a janela com `inert`; remoção inicial incompleta da importação de fonte com ponto e vírgula no URL. A execução final preserva o restante do CSS e verifica explicitamente o fundo inativo. O teste final de tipografia foi bloqueado em12/10 pelo limite de uso da revisão automática; a ação não foi executada nem contornada. A retomada em13/10 encontrou e corrigiu o seletor antigo de números de linha com10px.

[Resultado runtime](E:/dropzone-cadastros/relatorios-testes/dialogos-2026-10-12/runtime.json) · [Verificação](E:/dropzone-cadastros/relatorios-testes/dialogos-2026-10-12/final-verification.json) · [Hashes](E:/dropzone-cadastros/relatorios-testes/dialogos-2026-10-12/final-artifacts.json).

A matriz de fontes foi regenerada: 43 rotas, 16 subáreas e 327 fontes. A cobertura de componentes deste lote não certifica cada página ou todos os seus estados. L03 e os demais cinco achados parciais continuam abertos; os totais originais permanecem 20 corrigidos e seis parciais.

Os 18 SQLs e as dependências móveis anteriores permanecem iguais por hash. Nenhum novo audit, ensaio de banco, SQL/MCP ao projeto, alteração remota, commit, push, PR ou deploy. O audit online da raiz continua excluído por escolha do usuário; o último audit móvel continua com 23 pacotes altos reportados. Leituras externas do build normal não tiveram seu tráfego instrumentado. Staging/ativação, demais writers, dispositivos e matriz integral de layout/acessibilidade permanecem em [pendências](E:/dropzone-cadastros/docs/PENDENCIAS_FECHAMENTO_2026-10-12.md).
