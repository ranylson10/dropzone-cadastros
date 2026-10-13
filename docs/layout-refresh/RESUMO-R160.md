# DropZone — Refresh de layout R155–R160

O refresh foi feito como camada incremental para preservar regras de negócio, APIs e fluxos já existentes. A prioridade foi transformar a navegação em algo reconhecível por usuários não técnicos: descobrir campeonato, comprar vaga, localizar equipe/jogador, acompanhar ranking e operar o painel do próprio perfil.

Nenhuma migration nova foi necessária nesta rodada. As texturas são arquivos SVG locais do projeto e CSS; não há imagem gerada por IA adicionada ao sistema.

Arquivos de maior impacto: `web/app/dropzone-refresh.css`, `web/components/layout/StorefrontHeader.tsx`, `web/components/layout/storefront-header.css`, `web/features/home/AuthenticatedHomeFeed.tsx`, `web/features/home/authenticated-home.css` e ajustes pontuais nas páginas comerciais/painéis.
