# DropZone Cadastros

MVP em Next.js + Supabase para cadastro e controle de produtoras, equipes, jogadores, managers e campeonatos.

## Rodar localmente

```bash
npm run dev
```

Depois abra `http://localhost:3000`.

## Fluxo de acesso

Ao acessar o sistema, o usuario sempre cai na tela inicial com quatro opcoes:

- produtora
- equipe
- jogador
- manager

Se existir um acesso recente salvo no navegador para um tipo de perfil, o card mostra a logo/foto e os dados daquele perfil. O usuario pode clicar e entrar de forma rapida se ainda houver sessao valida do Supabase. Caso contrario, ele pode criar conta ou fazer login.

Hoje o login tecnico do Supabase continua sendo gerado por tipo + usuario:

```txt
produtora.meuarroba@dropzone.local
```

O e-mail real fica salvo em `email_contato`. Para confirmacao e recuperacao por esse e-mail real, ainda e necessario plugar um fluxo de envio transacional ou mudar o modelo de Auth para usar o e-mail de contato como e-mail principal.

## Tabelas

O app usa tabelas normalizadas no schema `public`:

- `produtoras_perfis`: dados do perfil de produtora, usado para criar e gerenciar campeonatos.
- `equipes_perfis`: dados do perfil de acesso da equipe.
- `jogadores_perfis`: dados do perfil dos jogadores.
- `managers_perfis`: dados do perfil dos managers.
- `campeonatos`: dados dos campeonatos.
- `equipes`: cadastro das equipes controladas no painel.
- `jogadores_equipes`: vinculo permanente entre jogadores e equipes.
- `convites_tokens`: tokens unicos de convite para equipes, jogadores e managers.
- `campeonato_grupos`: grupos de cada campeonato.
- `campeonato_jogos`: jogos/rodadas de cada campeonato.
- `campeonato_equipes`: equipes inscritas no campeonato.
- `campeonato_jogadores`: jogadores inscritos/escalados no campeonato.

`inscricoes_jogadores` foi substituida por `campeonato_jogadores` para seguir o padrao das demais tabelas ligadas aos campeonatos.

## Painel por perfil

Produtora:

- lista seus campeonatos;
- entra no perfil de cada campeonato;
- cria grupos e jogos;
- adiciona equipes ou gera token unico para uma equipe entrar no campeonato.

Equipe:

- lista campeonatos em que esta inscrita;
- lista jogadores ligados a ela;
- gera token unico para cada jogador entrar/escalar no campeonato;
- cada token de jogador so pode ser usado uma vez.

Jogador:

- ve campeonatos em que esta inscrito;
- usa token recebido de uma equipe para participar de campeonato.

Manager:

- usa token especifico de manager, acompanhado de senha, para controlar produtoras, equipes ou jogadores;
- o painel deve se ajustar ao tipo de controle liberado pelo convite.

## Banco e seguranca

O schema local fica em:

```txt
supabase/reset-dropzone.sql
```

Esse arquivo cria o modelo normalizado, ativa RLS, adiciona indices, cria `jogadores_equipes`, renomeia `inscricoes_jogadores` para `campeonato_jogadores` quando necessario e concede acesso basico para a Data API.

As rotas server-side usam `service_role`, entao a protecao principal nelas precisa acontecer no codigo antes de qualquer insert/update/delete. A rota `/api/dropzone` valida:

- produtora so gerencia campeonatos criados por ela;
- equipe/manager so gera token de jogador para equipe que controla;
- token de jogador so funciona se a equipe estiver no campeonato;
- token consumido e marcado como usado.
