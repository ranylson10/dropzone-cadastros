# Captura de sessão Google para testes E2E

O Google pode bloquear o Chromium automatizado pelo Playwright com a mensagem “Este navegador ou app pode não ser seguro”.

O capturador agora abre o Google Chrome instalado normalmente e conecta o Playwright somente depois, pela porta local do Chrome DevTools. Cada perfil usa uma pasta isolada em `tests-e2e/.chrome-auth-profile/`.

Com o DropZone em execução, use:

```bat
npm run test:e2e:auth:capture -- admin
npm run test:e2e:auth:capture -- produtora
npm run test:e2e:auth:capture -- manager
npm run test:e2e:auth:capture -- equipe
npm run test:e2e:auth:capture -- jogador
```

As sessões finais continuam sendo gravadas em `tests-e2e/.auth/` e não devem ser enviadas ao Git.
