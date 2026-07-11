# Autenticação por código de e-mail

## Fluxo de criação de conta

1. O usuário preenche cadastro, senha e confirmação de senha.
2. O sistema envia um código numérico de 6 dígitos ao e-mail informado.
3. O código expira em 15 minutos e possui limite de 5 tentativas.
4. A conta somente é criada após código, senha e confirmação serem validados.

## Recuperação de senha

1. O usuário informa login ou ID público.
2. O backend encontra o e-mail de contato do perfil sem expô-lo integralmente.
3. Um código de 6 dígitos é enviado.
4. O usuário informa código, nova senha e confirmação.
5. O backend altera a senha do usuário no Supabase Auth.

## Configuração necessária no `.env.local`

```env
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxx
AUTH_EMAIL_FROM=DropZone <acesso@seudominio.com>
AUTH_CODE_SECRET=troque-por-uma-chave-longa-e-aleatoria
```

O domínio do endereço configurado em `AUTH_EMAIL_FROM` precisa estar autorizado no provedor de e-mail.

## Banco

Execute antes de testar:

```text
database/migrations/20260710_codigos_verificacao_email.sql
```

A tabela de códigos possui RLS ativado e não concede acesso direto a `anon` nem `authenticated`. Somente as rotas de servidor com service role manipulam os códigos.
