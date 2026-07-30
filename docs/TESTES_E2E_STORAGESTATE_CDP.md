# Rodada 38 — captura confiável do storageState via Chrome/CDP

Corrige casos em que `context.storageState()` confirma a sessão pela API, mas salva o arquivo sem a origem/localStorage do Supabase.

A captura agora grava explicitamente:

- cookies da origem testada;
- todas as entradas de `localStorage` da página confirmada;
- o `auth-token` do Supabase;
- somente após `/api/me` responder HTTP 200.

Não altera o sistema DropZone, apenas o robô E2E.
