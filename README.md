# DropZone Cadastros

MVP em Next.js + Supabase para cadastro de campeonatos, equipes, managers e jogadores.

## Rodar localmente

```bash
npm run dev
```

Depois abra `http://localhost:3000`.

## Login

O usuario escolhe o tipo de perfil:

- produtora
- equipe
- jogador
- manager

Depois entra usando arroba e senha. Internamente o app converte isso para um email tecnico do Supabase Auth, por exemplo:

```txt
produtora.meuarroba@dropzone.local
```

## Banco

O reset da tabela fica em:

```txt
supabase/reset-dropzone.sql
```

Ele apaga e recria `public."DropZone"` com linhas tipadas para:

- contas
- campeonatos
- equipes
- grupos
- jogos
- tokens
- inscricoes de jogadores

O app usa a tabela unica `DropZone` e guarda os campos variaveis em `data jsonb`.
