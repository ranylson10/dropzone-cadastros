# Correção do loop de login OAuth nos testes E2E

A captura de sessão agora usa `http://localhost:3000` por padrão.

O login iniciado em `127.0.0.1` pode retornar pelo callback em `localhost`, criando cookies/sessão em outro host e fazendo a aplicação voltar continuamente para `/login`.

Execute o sistema e a captura usando o mesmo host:

```bat
npm run dev
npm run test:e2e:auth:capture -- admin
```

No Supabase, a URL de redirecionamento local deve incluir:

```text
http://localhost:3000/auth/callback
```
