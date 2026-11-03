# DropZone Arena UI — R21, criar primeiro e configurar depois

## Nova criação de campeonato

1. A produtora abre **Novo campeonato** e escolhe o tipo (Diário, Copa, Liga, X-Treino ou Confronto).
2. O fluxo **Criar rápido** é o padrão: nome e logo (exigências já existentes), vagas ou equipes por horário, inscrição gratuita/paga e valor se necessário. Confronto usa duas equipes fixas; os demais formatos conservam limites e planos próprios.
3. **Confirmar** resume os dados, exibe a **cotação existente** do pacote DropZone e mantém o botão **Criar campeonato**.
4. O campeonato **permanece pendente de liberação/pagamento** conforme o fluxo atual. O formulário não altera aprovação nem cobra automaticamente.
5. No modal de sucesso, **Configurar campeonato** abre o campeonato criado e mostra atalhos de dados, fases/grupos, equipes e jogos. Os fluxos de PIX, liberação manual e desistência continuam disponíveis.

**Assistente completo:** o seletor no formulário permite voltar ao caminho anterior, incluindo modelos, seasons, regras de grupo, premiação, horários, pontuação, jogos e edição. Ao alternar, o assistente volta ao início para não pular validações. Não foram alterados endpoints, pagamentos, tabelas, migrations ou permissões.

## Cadastro de equipe e jogador

- O cadastro inicial de uma conta vinculada continua com os campos obrigatórios da API: nome e @usuário; equipe exige tag; jogador exige ID de jogo.
- A função do jogador passou para **Personalizar perfil (opcional)**, junto com foto/logo e localização. Se já houver uma função padrão selecionada, ela continua sendo enviada à API.
- A edição posterior do perfil e as ferramentas de elenco, lines e campeonatos permanecem iguais.

## Verificações e pendências

`TESTAR_RODADA_21.bat` roda a suíte específica R21, a R20, as regressões anteriores, checagem de tipos e lint. O teste `scripts/testes/test-round21-quick-create.mjs` executa casos do guarda de criação rápida isolado e confere os vínculos com os fluxos existentes.

A confirmação visual de criação no navegador com conta produtora de homologação e a integração em banco continuam pendentes. Para validar o build integral em Windows, execute `HOMOLOGAR_WEB_R19.bat` no projeto R21 e teste os cinco formatos no celular e no desktop.
