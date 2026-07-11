# Teste da autenticação por código

1. Execute a migration de códigos.
2. Configure `RESEND_API_KEY`, `AUTH_EMAIL_FROM` e `AUTH_CODE_SECRET`.
3. Reinicie `npm run dev` após alterar `.env.local`.
4. Em Criar conta, confirme que senha e confirmação diferentes são recusadas.
5. Envie o código e confirme o recebimento no e-mail.
6. Tente código incorreto e confirme a mensagem de erro.
7. Use o código correto e confirme que a conta é criada.
8. Saia, clique em Esqueci minha senha e envie novo código.
9. Confirme a nova senha e entre com ela.
10. Confirme que a senha antiga não funciona mais.

## SQL de conferência

```sql
select
  purpose,
  profile_type,
  email,
  attempts,
  expires_at,
  consumed_at,
  created_at
from public.auth_verification_codes
order by created_at desc
limit 20;
```
