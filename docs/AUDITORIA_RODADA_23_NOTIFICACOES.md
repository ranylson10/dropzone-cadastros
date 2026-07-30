# Rodada 23 — Arquivamento de notificações

- Adiciona `DELETE /api/notificacoes?id=<uuid>` para arquivar uma notificação do próprio usuário.
- Adiciona `DELETE /api/notificacoes?all_read=1` para arquivar todas as notificações já lidas.
- O histórico é preservado; nenhum registro é apagado fisicamente.
- A interface do sino de notificações ganhou ação **Arquivar**.
- Toda operação valida `destinatario_auth_user_id` contra o usuário autenticado.
