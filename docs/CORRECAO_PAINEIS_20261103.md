# Faixa superior e painéis por perfil — 03/11/2026

> Registro histórico: a estrutura abaixo foi substituída pela moldura compartilhada de catálogo e painel. Consulte `PAINEL_E_CATALOGO_20261103.md`.

A navegação autenticada voltou à faixa superior do PC. A conversão antiga para sidebar foi removida, assim como a reserva lateral de 232 px. O botão com o nome do perfil operacional abre o mesmo seletor autorizado de painéis usado no mobile. A conta pessoal mantém suas ações próprias. O cabeçalho marca “Meu painel” durante a operação.

O seletor é conferido com a página rolada, fechamento por Escape e retorno do foco. A troca de perfil abre o novo painel no início da tela. O perfil operacional ativo é passado explicitamente ao cabeçalho, evitando confundi-lo com a identidade da conta.

O layout compartilhado dos painéis aproveita a largura disponível, com margem de 16 px no mobile. Foram retirados contadores repetidos do cabeçalho e o botão flutuante genérico nesses painéis. Indicadores usam faixas compactas, em duas colunas no celular; as ações do jogador aparecem antes das métricas. Cabeçalho de contexto, navegação, ferramentas e conteúdo mantêm um alinhamento comum.

As superfícies e textos dos componentes corrigidos usam a paleta canônica. Corrigidos também o contraste das listas de análise, os rótulos do cabeçalho e o foco por teclado da tabela horizontal. As regras de composição ficam no módulo compartilhado dos painéis; a navegação global continua no componente de cabeçalho.

Validação: build completo, tipos, lint, segurança, contratos de identidade/navegação e auditoria do shell. **14 cenários de experiência** e **42 cenários de regressão** aprovados, incluindo troca entre produtora, equipe e jogador, delegação e revogação. A inspeção final cobriu **24 combinações de perfil/largura**, em 320, 390, 768, 901, 1024, 1280, 1440 e 1920 px, sem alertas axe nas regras verificadas ou transbordamento. Os testes históricos que exigiam sidebar/roxo foram atualizados para a identidade atual. A suíte de experiência do CI agora inclui os cenários autenticados com dados controlados e credenciais fictícias.

As inspeções de navegador usam autenticação e APIs controladas, com GETs e nenhuma gravação em contas reais. Não houve alteração de banco, API de autorização ou permissões concedidas. Evidências locais em `relatorios-testes/workspace-layout`, `workspace-experience-verified.log`, `workspace-delegation-final.log`, `workspace-security.log`, `workspace-header-build-final.log` e `workspace-header-lint-final.log`.
