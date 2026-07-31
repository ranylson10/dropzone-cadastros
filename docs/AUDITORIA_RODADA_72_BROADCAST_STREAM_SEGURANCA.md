# Rodada 72 — Broadcast e Stream: segurança de acesso e tokens

## Cobertura adicionada

- bloqueio de `/api/broadcast/me` sem autenticação;
- bloqueio de `/api/broadcast/sessions` sem autenticação;
- bloqueio dos três escopos do catálogo Stream sem autenticação;
- leitura autenticada dos catálogos `mine`, `public` e `entitled`;
- rejeição de token curto do controlador;
- rejeição de token inexistente do controlador;
- rejeição de token curto do OBS;
- rejeição de token inexistente do OBS;
- bloqueio de escrita no controlador usando token inválido.

## Segurança

O teste é somente leitura para dados autenticados e usa apenas tokens fictícios
nas rotas públicas. Nenhuma sessão real, overlay, chave Stream ou campeonato é alterado.

## Execução

Use somente:

`npm run testar:tudo`

O total esperado passa de 68 para 70 testes, considerando desktop e mobile.
