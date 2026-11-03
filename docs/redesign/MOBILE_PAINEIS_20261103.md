# Mobile: superfícies e seletor de painéis

O conteúdo mobile passa a ocupar diretamente o fundo do aplicativo. Cabeçalhos de diretórios, perfis, campeonatos, áreas operacionais e documentos deixam de formar cartões externos. Linhas alternadas, cartões dos itens, campos e ações mantêm suas superfícies. A compra de vaga fica em uma barra contínua acima da navegação inferior. Desktop mantém as molduras existentes.

O menu superior continua responsável pela navegação da plataforma. A quinta ação inferior agora é **Painéis**: abre um seletor com os perfis operacionais de equipe, produtora e jogador. Cada entrada mostra nome, avatar, tipo e indicação de vice-líder quando há delegação. O painel em uso é marcado; listas maiores oferecem busca e rolagem interna.

`WorkspacePanelSwitcher` consulta a sessão e a lista autorizada de `GET /api/me/contexts` a cada abertura. Não usa snapshots locais para conceder acesso. Falhas oferecem nova tentativa, visitantes recebem acesso ao login, e o logout descarta os contextos apresentados. Manager continua sendo vínculo de vice-liderança, sem uma nova categoria de painel. As APIs existentes mantêm as verificações de função.

No início autenticado, a seleção usa a transição de contexto existente. Em outras páginas, o endereço abre a raiz com `painel`, `perfil` e `perfil_id`. O retorno pelo botão Início também atualiza o estado do workspace quando a rota já é `/`.

A identidade continua centralizada em `dropzone-identity.css`. O ranking consome os novos tokens responsivos de cabeçalho para evitar que uma folha carregada depois restaure o fundo escuro no mobile. Texturas decorativas externas são removidas nessa largura; marcas e artes dos itens permanecem.

## Verificação

Os cenários Playwright em `mobile-panel-switcher.spec.ts` cobrem visitante, foco, separação dos menus, seleção de equipe/jogador/produtora, permissões de edição, retorno ao início, revogação entre aberturas, falha e nova tentativa, busca, rolagem em 320×568, molduras mobile e superfícies de desktop. Os fluxos autenticados usam respostas controladas e não alteram contas reais. A suíte de navegação, identidade e conta complementa esses testes.

Resultados e capturas de trabalho ficam em `relatorios-testes`, ignorado pelo Git. Não há mudança de dependências, API, SQL ou banco de produção nesta entrega.

Validação local aprovada em 03/11/2026: `npm run check:code` (segurança, tipos, lint e build completo), contratos R20–R24 e de identidade, 54 cenários Playwright de regressão. Após o último ajuste de textura, build completo e os 12 cenários do seletor/superfícies foram executados novamente e passaram. A inspeção visual cobriu 25 estados de páginas e diálogos em desktop/mobile, sem cores antigas, transbordamento ou falhas de contraste medidas; os oito estados de ranking/perfil foram repetidos após o ajuste final. Isso não substitui homologação com contas reais ou dispositivos físicos.
