# DropZone Mobile

Aplicativo mobile do DropZone. Ele usa o mesmo backend, banco, login e regras do sistema web, mas fica focado nas ações rápidas do dia a dia.

## Escopo da primeira versão

- Login Google com Supabase.
- Escolha do perfil ativo.
- Campeonatos com vagas.
- Compra de vaga.
- Carrinho e favoritos.
- Link de inscrição após pagamento.
- Meus campeonatos.
- Escalação de jogadores.
- Agenda.
- Convites e notificações.
- Carteira e comprovantes.
- Vendas do vendedor.
- Painel rápido da produtora.
- Rank.
- Lili como chat guiado.

## O que continua no site

- Criação avançada de campeonato.
- Fases, grupos e jogos avançados.
- Pontuador.
- Overlays e stream.
- Exportações.
- Financeiro avançado.
- Configuração completa de vendedores e produtora.

## Configuração obrigatória

Crie `app/.env` com:

```env
EXPO_PUBLIC_DROPZONE_API_URL=https://dropzone-cadastros.vercel.app
EXPO_PUBLIC_SUPABASE_URL=https://SEU-PROJETO.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=SUA_CHAVE_PUBLICA_ANON
EXPO_PUBLIC_AUTH_REDIRECT_URL=dropzone://auth/callback
```

No Supabase Dashboard, adicione em Authentication > URL Configuration > Redirect URLs:

```text
dropzone://auth/callback
```

Sem isso, o app pode compilar, mas o login Google real não fecha no celular.

Se o `.env.local` da raiz já tiver `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY`, você pode gerar o `app/.env` local com:

```bat
npm run mobile:env:sync
```

Esse comando copia apenas variáveis públicas e não imprime a chave no terminal.

## Validação rápida

Rode:

```bat
npm run mobile:typecheck
npm run mobile:env:sync
npm run mobile:ready
```

`mobile:ready` valida os pontos críticos para teste real: entrada do Expo, scheme, pacote Android/iOS, EAS, variáveis, PKCE, deep link, compra, carrinho, Lili e escalação.

## Rodar localmente

```bat
npm run mobile:start
```

## Android

Para desenvolvimento local:

```bat
npm run mobile:android
```

Para gerar APK interno com EAS, rode dentro da pasta `app`:

```bat
npx eas build -p android --profile preview
```

## Estrutura

- `src/config`: URLs e configuração do app.
- `src/lib`: API, autenticação, pagamento, carrinho e normalizadores.
- `src/navigation`: ações por perfil.
- `src/screens`: telas mobile.
- `src/theme`: tokens visuais.
- `src/types`: contratos usados pelo app.
