# Web DropZone

Aplicação web em Next.js.

## Regras de organização

- `app/`: somente rotas, layouts e endpoints HTTP do Next.js.
- `components/`: componentes compartilhados e formulários reutilizáveis.
- `features/`: componentes, hooks e serviços específicos de um domínio.
- `lib/`: utilitários exclusivos do frontend.
- `services/`: cliente HTTP compartilhado.
- `providers/`: providers globais.
- `types/`: tipos compartilhados do frontend.

As páginas devem ser pequenas. Regras de negócio e consultas ao banco pertencem ao `backend/`.
