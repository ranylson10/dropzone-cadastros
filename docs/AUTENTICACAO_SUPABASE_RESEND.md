# Autenticação: Supabase Auth + Resend SMTP

## Responsabilidades

- Supabase Auth: cria usuário, gera e valida OTP, controla expiração, sessões e recuperação.
- Resend: entrega os e-mails como SMTP configurado dentro do Supabase.
- A aplicação não chama mais a API do Resend diretamente.

## Configuração do SMTP no Supabase

No painel do Resend, gere uma API Key nova. Não use uma chave exposta em conversa ou commit.

No Supabase:

Authentication > SMTP Settings > Enable Custom SMTP

Preencha:

- Host: smtp.resend.com
- Port: 465
- Username: resend
- Password: a API Key nova do Resend
- Sender name: DropZone
- Sender email: onboarding@resend.dev durante testes

Quando houver domínio próprio verificado, substitua o remetente por algo como acesso@seudominio.com.

## Templates obrigatórios

No Supabase, abra Authentication > Email Templates.

### Confirm signup

O corpo precisa exibir o código com:

```html
<h2>Confirme sua conta DropZone</h2>
<p>Seu código é:</p>
<h1>{{ .Token }}</h1>
<p>Digite os 6 números no cadastro.</p>
```

### Reset password / Recovery

Use:

```html
<h2>Recuperação de senha DropZone</h2>
<p>Seu código é:</p>
<h1>{{ .Token }}</h1>
<p>Digite os 6 números e informe a nova senha.</p>
```

Não use apenas `{{ .ConfirmationURL }}`, porque o frontend espera um código de seis dígitos.

## URLs

Em Authentication > URL Configuration:

- Site URL: https://dropzone-cadastros.vercel.app
- Redirect URL permitida: https://dropzone-cadastros.vercel.app/**
- Também: https://dropzone-cadastros.vercel.app/login

## Provedores sociais (Google, Facebook, Discord)

A UI já chama os três (`SocialLogin`). Cada um precisa estar **Enabled** em  
**Supabase → Authentication → Providers**.

Redirect URI comum (cole em TODOS os painéis externos):

```text
https://uukivzxabiydnrvjvabt.supabase.co/auth/v1/callback
```

### Google

1. Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client
2. Authorized redirect URIs: o callback Supabase acima
3. Cole Client ID e Client Secret no provider Google do Supabase

### Discord

1. [Discord Developer Portal](https://discord.com/developers/applications) → New Application
2. OAuth2 → Redirects → add: `https://uukivzxabiydnrvjvabt.supabase.co/auth/v1/callback`
3. Copie **Client ID** e **Client Secret**
4. Supabase → Providers → Discord → Enable → cole as chaves
5. Scopes usados pelo app: `identify email`

### Facebook / Meta

1. [Meta for Developers](https://developers.facebook.com/) → Create App → tipo **Consumer** (ou com Facebook Login)
2. Add product **Facebook Login** → Settings
3. Valid OAuth Redirect URIs: `https://uukivzxabiydnrvjvabt.supabase.co/auth/v1/callback`
4. App Settings → Basic → App ID e App Secret
5. Supabase → Providers → Facebook → Enable → cole App ID / Secret
6. Em modo Development, só testers do app conseguem logar; para produção: App Review + Live mode
7. Scopes: `email,public_profile`

### Checklist rápido se o botão falhar

| Sintoma | Onde olhar |
|--------|------------|
| Provider not enabled / unsupported | Supabase → Providers (liga e salva) |
| redirect_uri_mismatch | Callback exato do Supabase no painel Google/Discord/Meta |
| Facebook “App not set up” | App em Live + domínios corretos |
| Discord volta sem e-mail | Scope `email` e e-mail verificado na conta Discord |

## Variáveis da aplicação

Continuam necessárias:

- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY
- NEXT_PUBLIC_APP_URL=https://dropzone-cadastros.vercel.app

Não são mais necessárias no código da aplicação:

- RESEND_API_KEY
- AUTH_EMAIL_FROM
- AUTH_CODE_SECRET

A API Key do Resend fica somente no SMTP do Supabase.

## Compatibilidade com contas antigas

As contas antigas usavam um e-mail técnico no Supabase Auth. Na primeira recuperação de senha, a rota atualiza o Auth para o `email_contato` real antes de pedir o código.

O login tenta primeiro o e-mail real e depois o endereço técnico antigo, mantendo compatibilidade durante a transição.

O novo cadastro exige e-mail único globalmente, porque o Supabase Auth usa um usuário por e-mail.
