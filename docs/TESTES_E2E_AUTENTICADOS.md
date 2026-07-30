# Testes E2E autenticados

A Rodada 34 adiciona sessões separadas para administrador, produtora, manager, equipe e jogador.

## 1. Inicie o projeto

```bat
npm run dev
```

## 2. Em outro CMD, capture cada sessão

```bat
npm run test:e2e:auth:capture -- admin
npm run test:e2e:auth:capture -- produtora
npm run test:e2e:auth:capture -- manager
npm run test:e2e:auth:capture -- equipe
npm run test:e2e:auth:capture -- jogador
```

O Chromium será aberto. Faça login com a conta correspondente. A sessão será salva em `tests-e2e/.auth/` e está protegida pelo `.gitignore`.

## 3. Execute os testes autenticados

```bat
npm run test:e2e:auth
```

Perfis ainda não capturados aparecem como `skipped`, sem causar falso erro. Para validar tudo, capture os cinco perfis.

Os testes confirmam que a sessão Supabase existe, `/api/me` reconhece o usuário, a rota principal abre sem erro 500 e não há tela de erro do Next.js.
