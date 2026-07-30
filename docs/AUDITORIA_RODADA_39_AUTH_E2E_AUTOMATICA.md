# Rodada 39 — Sessões E2E automáticas

Esta rodada remove a dependência de login manual pelo Google Chrome para preparar os testes autenticados.

## Novo comando

```bat
npm run test:e2e:auth:prepare
```

O comando usa `SUPABASE_SERVICE_ROLE_KEY` apenas no computador do desenvolvedor para:

1. localizar um usuário vinculado a cada perfil;
2. gerar um magic link administrativo sem enviar e-mail;
3. trocar o token por uma sessão Supabase;
4. validar a sessão em `/api/me`;
5. salvar os cinco arquivos em `tests-e2e/.auth`.

Nenhuma chave é enviada ao navegador ou incluída nos arquivos de sessão.

## E-mails opcionais

Se o banco não tiver um usuário detectável para algum perfil, configure somente o e-mail correspondente em `web/.env.local`:

- `E2E_ADMIN_EMAIL`
- `E2E_PRODUTORA_EMAIL`
- `E2E_MANAGER_EMAIL`
- `E2E_EQUIPE_EMAIL`
- `E2E_JOGADOR_EMAIL`

Depois execute novamente o comando de preparação.
