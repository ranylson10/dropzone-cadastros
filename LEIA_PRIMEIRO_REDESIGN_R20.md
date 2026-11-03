# DropZone — Redesign R20 (Arena UI)

**O ZIP completo usa o último projeto que você enviou, com R01–R19 preservadas.**

## O que já mudou
- Navegação global e mobile: Início, Campeonatos, Equipes, Jogadores, Menu. O catálogo público e os painéis autenticados seguem essa lógica.
- Botão flutuante de ações rápidas quando o usuário está autenticado no painel.
- Produtora: Início e Campeonatos visíveis; Financeiro, Equipe interna e Configurações em Gestão avançada (respeitando permissões).
- Equipe e jogador: foco nas 3 tarefas principais, as demais em Ferramentas.
- Manager: perfil comercial em menu secundário; áreas de trabalho mantidas.
- Campeonato já criado: atalhos de configuração para dados, fases/grupos, equipes e jogos; todas as áreas avançadas continuam acessíveis.
- Visual Arena UI com luz suave, detalhes violeta/ouro, transições curtas e acessibilidade de movimento reduzido.

**Esta rodada não altera banco, migrations, Supabase, permissões, pagamentos nem API.**

## No Windows
1. Extraia o ZIP completo R20 em pasta nova (não misture com uma versão antiga).
2. Na pasta do projeto, abra CMD e execute `npm ci`.
3. Execute `TESTAR_RODADA_20.bat` para testar navegação, regressões, TypeScript e lint.
4. Execute `HOMOLOGAR_WEB_R19.bat` para o build completo. Observe que o build e o E2E **não foram executados neste ambiente**.
5. Faça uma conferência visual, principalmente em 360 px, 390 px, 430 px e desktop. Teste todos os perfis com dados de homologação.

O patch R20 contém somente os arquivos novos/alterados desde seu último ZIP. Não apague a pasta antiga sem preservar configurações privadas.

## Próximas rodadas
Consulte `docs/redesign/PLANO_DROPZONE_R20_R24.md`. A R21 simplificará **criação de campeonato, equipe e jogador** sem prejudicar validações obrigatórias.
