# Arquitetura do DropZone

## Camadas

### Web

Responsável pela apresentação, navegação, estados de interface e chamadas HTTP. Não deve conter credenciais administrativas nem regras de autorização.

### Backend

Responsável por autenticação, autorização, validação, regras de negócio e acesso ao banco. As rotas em `web/app/api` são adaptadores HTTP e devem delegar o trabalho ao backend.

### Database

Responsável por integridade, constraints, índices, RLS, funções transacionais e views.

### App

Aplicativo móvel futuro. Deve consumir o mesmo backend, sem duplicar regras de negócio.

## Regra de dependência

```text
web UI -> web service -> route handler -> backend service -> repository -> database
```

Não permitido:

```text
formulário -> supabaseAdmin
componente visual -> service_role
página -> regra de permissão improvisada
```

## Padrão de recurso do backend

```text
backend/src/campeonatos/
├── campeonatos.repository.ts
├── campeonatos.service.ts
├── campeonatos.permissions.ts
├── campeonatos.validation.ts
└── campeonatos.types.ts
```

- repository: consulta e gravação;
- service: regra de negócio;
- permissions: autorização;
- validation: validação de entrada;
- types: contratos internos.

## Padrão de recurso do frontend

```text
web/features/equipes/
├── components/
├── panels/
├── hooks/
├── services/
├── types/
└── index.ts
```

## Formulários

Formulários globais ficam em `web/components/forms`. Um mesmo formulário atende criação e edição por meio de propriedades como `mode`, `initialData` e `onSuccess`.
