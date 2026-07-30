# Rodada 37 — correção das sessões autenticadas

A falha ocorria porque a captura salvava o localStorage de `localhost`, mas o Playwright executava os testes em `127.0.0.1`. Sessões, cookies e localStorage não são compartilhados entre essas origens.

A correção:

- padroniza todo o E2E local em `http://localhost:3000`;
- lê o token diretamente do arquivo `storageState`, sem disputa com redirecionamentos;
- confirma a sessão em `/api/me` antes de salvar;
- impede falso sucesso da captura;
- informa claramente quando o perfil foi redirecionado ao login.

As sessões já capturadas em localhost podem ser reutilizadas. Execute primeiro:

```bat
npm run test:e2e:auth
```

Recapture apenas um perfil que ainda falhar:

```bat
npm run test:e2e:auth:capture -- admin
```
