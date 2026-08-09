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

## Teste no Expo Go em celular físico

Durante a transição atual do Expo, o Expo Go disponível nas lojas usa o SDK 54 para testes em aparelho físico. Por isso este workspace mobile fica temporariamente alinhado ao SDK 54 enquanto validamos o app no celular.

Depois de substituir os arquivos desta rodada, a partir da raiz do projeto:

```bat
npm install
npm run mobile:typecheck
cd app
npx expo-doctor
cd ..
npm run mobile:go
```

No celular:

1. Instale/atualize o **Expo Go** pela loja.
2. Computador e celular devem estar na mesma rede Wi-Fi.
3. Abra o Expo Go e leia o QR Code exibido pelo terminal.
4. Se o modo LAN não localizar o computador, encerre o Metro e use:

```bat
npm run mobile:go:tunnel
```

A primeira meta desta rodada é o bundle abrir no Expo Go sem erro de versão do React Native/Expo. O login Google por deep link será validado na rodada seguinte, porque o callback de um development build (`dropzone://...`) e o callback temporário do Expo Go (`exp://...`) são ambientes diferentes.

Não use `npm run mobile:android` para este teste. Esse comando compila o projeto Android nativo; para Expo Go use `npm run mobile:go`.

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
