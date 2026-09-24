# DropZone Platform

Plataforma de produtoras, campeonatos, equipes, jogadores e managers.

## Comece por aqui

Leia [`PROJECT_CONTEXT.md`](./PROJECT_CONTEXT.md) antes de alterar o projeto.

## Estrutura

- `backend/`: regras de negócio e servidor;
- `web/`: aplicação Next.js;
- `app/`: aplicativo móvel futuro;
- `database/`: scripts e estrutura de banco;
- `docs/`: documentação detalhada.

## Comandos

```bash
npm install
npm run dev
npm run typecheck
npm run build
```

## Mudar a pasta do projeto

O projeto usa caminhos relativos e pode ficar fora da Área de Trabalho, inclusive
em outro disco. Abra o terminal na nova pasta antes de executar os comandos npm.
Preserve os arquivos locais `web/.env.local` e `app/.env`, que não ficam no Git.
O `deploy.bat` e o `TESTAR_DROPZONE.bat` usam a própria pasta como base.

Após mover, execute `npm install` para atualizar os vínculos do workspace e
`npm run build` para validar a aplicação web no novo local. Atualize também
eventuais atalhos ou terminais que ainda apontem para a pasta antiga.
