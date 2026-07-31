# Rodada 77 — Regressão, concorrência e idempotência segura

## Correção aplicada

A rota `/api/me/perfil` não oferece leitura por `GET`; ela responde `405` porque
é destinada a atualização. O teste de sessão foi corrigido para usar `/api/me`,
que é a rota apropriada para validar a sessão autenticada.

## Cobertura

- leituras públicas concorrentes;
- leituras autenticadas concorrentes;
- ausência de respostas 5xx sob concorrência moderada;
- repetição simultânea de requisições inválidas;
- consistência dos códigos HTTP;
- saúde da API após as tentativas;
- confirmação da permanência da sessão autenticada.

## Execução

`npm run testar:tudo`

O total esperado permanece em 86 testes.
