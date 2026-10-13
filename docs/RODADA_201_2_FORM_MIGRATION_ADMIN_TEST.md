# R201.2 — estabilização do teste Admin > Página inicial

Correção exclusiva do teste E2E da R201.1.

- remove criação/fechamento manual de BrowserContext;
- usa o `page` fixture do Playwright com `storageState` admin;
- navega com `waitUntil: commit` para não confundir compilação/recursos lentos com regressão;
- aumenta o orçamento apenas deste teste autenticado;
- intercepta somente o GET de `/api/site/home`, pois a rodada valida os primitives de formulário, não a disponibilidade do backend;
- continua exigindo que todos os inputs/selects/textareas renderizados tenham `data-dz-control`;
- continua verificando overflow horizontal.
