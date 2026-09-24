# Rodada 147 — Workspace e operação simplificados

## Objetivo

Transformar a administração da produtora e do campeonato em uma experiência orientada por tarefa. A estrutura relacional continua rica no banco, mas a interface deixa de expor fases, grupos, jogos, quedas e ferramentas comerciais como áreas principais independentes.

## Workspace da produtora

A navegação principal passa a ser:

- Visão geral
- Campeonatos
- Financeiro
- Equipe
- Configurações

A Visão geral concentra indicadores operacionais reais já disponíveis no cliente e um fluxo simples do campeonato até o resultado. Financeiro centraliza o acesso por campeonato e mantém Carteira separada. Equipe reúne membros do workspace e cadastros provisórios. Configurações concentra privacidade do workspace e a página pública do marketplace.

## Workspace do campeonato

A navegação principal passa a ser:

- Visão geral
- Participantes
- Operação
- Resultados
- Financeiro

As ferramentas existentes são preservadas. `Equipes`, `Jogadores` e `Inscrições` ficam em Participantes. `Estrutura`, `Jogos e quedas`, `Regras` e `Calls` ficam em Operação. `Classificação` fica em Resultados. `Resumo financeiro` e `Vendas` ficam em Financeiro.

## Permissões

A R147 reutiliza a autorização real criada na R146. Operação só aparece para quem pode operar ou pontuar. Financeiro só aparece para quem possui acesso financeiro ou comercial. As subtelas financeiras continuam separando permissões de financeiro e comercial.

## Banco

Nenhuma migration nova. A rodada é de arquitetura de interface e fluxo; não altera contratos do DPZ Live Engine nem o modelo relacional do campeonato.

## Referência operacional RW KINGS III

A simplificação segue a sequência operacional da planilha 6B - RW KINGS III: cadastrar participantes e estrutura, organizar grupos/slots e elencos, preparar jogos/quedas, revisar regras e então receber resultados. No DropZone essa lógica vira navegação por tarefa; as tabelas e chaves internas continuam escondidas do usuário.

O dado ao vivo não foi movido para a Web. HP, estados instantâneos e captura SPEC continuam responsabilidade do DPZ Live Engine e das overlays.

## Regressão

O teste controlado da R143 foi atualizado apenas nas expectativas de navegação que a R147 substituiu intencionalmente. Os contratos preservados pela R143 — criação guiada, nome/logo obrigatórios, Calls de xTreino, migration da R142 e ausência de ferramentas de transmissão na navegação competitiva — continuam cobertos.
