# Rodada 13 — Manutenção da mesa Broadcast

A API `api/broadcast/sessions` agora permite manutenção segura da mesa do usuário autenticado.

- `PATCH`: renomeia a mesa, troca ou limpa o campeonato, limpa o overlay e regenera tokens do controlador/OBS.
- `DELETE`: encerra todas as mesas ativas do perfil e invalida os tokens antigos. Uma nova mesa é criada automaticamente no próximo acesso.
- Toda alteração é limitada ao `broadcast_id` do usuário autenticado.
- O scanner CRUD deixa de tratar famílias artificiais `api` e `api/broadcast` como recursos cadastráveis.
