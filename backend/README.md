# Backend DropZone

Contém regras de negócio, autorização, validações e acesso ao banco.

As rotas HTTP do Next.js permanecem temporariamente em `web/app/api`. Elas devem ser pequenas e chamar serviços desta pasta.

## Organização

- `auth/`: autenticação e resolução de contas.
- `campeonatos/`: regras de campeonatos, fases, grupos, jogos e slots automáticos.
- `equipes/`: regras e vínculos de equipes.
- `jogadores/`: regras e dados de jogadores.
- `managers/`: vínculos e permissões de managers.
- `produtoras/`: regras de produtoras.
- `inscricoes/`: inscrições, escalações e substituições.
- `uploads/`: políticas e serviços de arquivos.
- `database/`: repositórios e utilitários de banco.
- `permissions/`: autorização compartilhada.
- `shared/`: utilitários internos do servidor.
- `types/`: contratos do backend.
