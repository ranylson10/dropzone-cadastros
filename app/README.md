# DropZone Mobile

Aplicativo mobile do DropZone. A ideia é ter um app único, enxuto e guiado por perfil, usando o mesmo backend/API do sistema web.

## Decisão de produto

- App = ações rápidas do dia a dia.
- Site web = gestão completa e avançada.
- Mesmo login, mesmas contas/perfis, mesmo banco e mesmas regras de negócio.
- Nada de copiar o painel inteiro do site para o celular.

## Primeira versão do app

1. Login e escolha de perfil.
2. Campeonatos com vagas.
3. Compra de vaga e entrada no grupo/slot.
4. Meus campeonatos.
5. Equipe, lines e elenco.
6. Escalação de jogadores.
7. Agenda.
8. Convites e notificações.
9. Carteira e comprovantes.
10. Vendas do vendedor.
11. Painel rápido da produtora.
12. Rank inicial.
13. Lili como assistente guiada.

## Login e perfil ativo

A base mobile possui:

- `AuthProvider` com Supabase.
- Sessão persistida em `expo-secure-store`, com fallback para AsyncStorage.
- Login Google via Supabase OAuth.
- Carregamento de contas pelo endpoint `/api/me`.
- Seletor de perfil ativo dentro da Home.
- Logout limpando sessão e perfis locais.

## Backend compartilhado

O app já consome endpoints reais do sistema web:

- `/api/vagas`
- `/api/pagamentos/vaga`
- `/api/agenda`
- `/api/equipe/escalacoes`
- `/api/me/carteira`
- `/api/me/carteira/comprovante/[id]`
- `/api/notificacoes`
- `/api/vendedores/[managerId]/vendas`
- `/api/produtora/vendedores`
- `/api/lili/chat`

## O que fica no site por enquanto

- Criação avançada de campeonato.
- Fases, grupos e jogos avançados.
- Pontuador.
- Overlays e stream.
- Exportações.
- Financeiro avançado.
- Configuração completa de vendedores/produtora.

## Estrutura

- `src/config`: URLs e configuração do app.
- `src/lib`: clientes de API/autenticação e normalizadores.
- `src/navigation`: mapa de navegação por perfil.
- `src/screens`: telas mobile.
- `src/theme`: tokens visuais.
- `src/types`: contratos usados pelo app.

## Stack

Expo + React Native + TypeScript.

## Configuração do login Google no app

Crie `app/.env` (ou forneça as mesmas variáveis no ambiente de build) com:

```env
EXPO_PUBLIC_DROPZONE_API_URL=https://dropzone-cadastros.vercel.app
EXPO_PUBLIC_SUPABASE_URL=https://SEU-PROJETO.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=SUA_CHAVE_PUBLICA_ANON
EXPO_PUBLIC_AUTH_REDIRECT_URL=dropzone://auth/callback
```

No Supabase Dashboard, em **Authentication > URL Configuration > Redirect URLs**, adicione exatamente:

```text
dropzone://auth/callback
```

O `scheme` do Expo já é `dropzone`, definido em `app/app.json`. O fluxo mobile usa PKCE, troca o `code` recebido no deep link por uma sessão Supabase, persiste a sessão em SecureStore e mantém o refresh automático ativo enquanto o app está em primeiro plano.

Para validar a configuração local antes de abrir o app:

```bat
npm run mobile:typecheck
```
