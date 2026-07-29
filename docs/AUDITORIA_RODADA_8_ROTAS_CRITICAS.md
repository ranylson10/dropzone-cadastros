# Rodada 8 — Rotas críticas com Service Role

Rotas revisadas manualmente:

- `api/me/carteira/saque`: autenticada, carteira derivada da conta ativa e saque executado por RPC com usuário e carteira.
- `api/pagamentos/vaga`: agora valida a propriedade da compra em toda consulta por token, inclusive sem `context=1`.
- `api/reports`: autenticada e agora exige `target_id` em formato UUID.
- `api/stream/catalog/redeem`: autenticada e resgate atômico por RPC vinculado ao usuário.
- `api/upload` e `api/upload/signed`: autenticadas e protegidas por `requireUploadAccess`.

O scanner foi refinado para reconhecer esses helpers e RPCs como evidência de autorização e escopo.
