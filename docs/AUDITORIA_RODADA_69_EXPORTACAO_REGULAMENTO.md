# Rodada 69 — Exportação e regulamento controlados

Esta rodada adiciona um cenário E2E temporário, executado em desktop e mobile pelo comando `npm run testar:tudo`.

Cobertura adicionada:

- criação de campeonato temporário com exportação e regulamento habilitados;
- bloqueio de exportação sem autenticação;
- exportação JSON autenticada pelo proprietário;
- gravação e leitura de overrides de exportação;
- bloqueio de alteração dos overrides por equipe sem vínculo;
- criação e leitura do rascunho do regulamento;
- garantia de que rascunho não fica público;
- bloqueio de edição do regulamento por perfil sem permissão;
- restauração do regulamento;
- limpeza automática do campeonato e dados dependentes.

Nenhum campeonato permanente é modificado. O cenário usa identificadores únicos e remove os dados temporários no bloco de limpeza mesmo quando uma validação falha.
