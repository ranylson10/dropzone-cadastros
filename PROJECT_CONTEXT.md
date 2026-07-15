# CONTEXTO CENTRAL — DROPZONE

> Este é o primeiro arquivo que deve ser lido antes de alterar o projeto.
> Atualize-o ao fim de cada rodada relevante.

**Última atualização:** 15 de julho de 2026  
**Estado:** painel do manager multi-contexto (vendas/campeonatos/equipes/jogador); permissões de vendedor por campeonato.

## 1. Objetivo do sistema

O DropZone é uma plataforma para produtoras, campeonatos, equipes, jogadores e managers de Free Fire. O sistema deve oferecer páginas públicas, painéis administrativos, inscrições por link, organização de fases/grupos/jogos, escalações e substituições.

Princípios obrigatórios:

- componentes reutilizáveis, sem formulários duplicados;
- páginas pequenas e fáceis de localizar;
- regras de negócio no backend;
- carregamento somente dos dados necessários;
- segurança aplicada no servidor e no banco;
- nenhuma consulta administrativa deve retornar dados de outros usuários sem autorização;
- cada rodada deve manter o projeto compilável.

## 2. Estrutura oficial

```text
dropzone/
├── backend/        regras de negócio, permissões e acesso ao banco
├── web/            aplicação Next.js
├── app/            reservado para aplicativo móvel futuro
├── database/       SQL, migrations, views, policies e funções
├── docs/           documentação detalhada
└── PROJECT_CONTEXT.md
```

### Atenção aos dois nomes `app`

- `/app`: aplicativo móvel futuro; atualmente contém somente documentação.
- `/web/app`: App Router do Next.js; contém rotas do site e endpoints HTTP.

## 3. Organização da aplicação web

```text
web/
├── app/            rotas, layouts e route handlers
├── components/     UI global e formulários reutilizáveis
├── features/       recursos específicos por domínio
├── hooks/          hooks compartilhados
├── lib/            utilitários exclusivos do frontend
├── providers/      providers globais
├── services/       cliente HTTP compartilhado
├── styles/         estilos compartilhados
├── types/          tipos compartilhados do frontend
└── public/         imagens e arquivos públicos
```

### Formulários reutilizáveis definidos

- Campeonato: `web/components/forms/campeonato/`
- Equipe: `web/components/forms/equipe/`

Eles serão usados em qualquer página que precise criar ou editar esses registros. Não devem acessar Supabase diretamente.

### Estrutura de campeonato definida

```text
web/features/campeonatos/
├── fases/
├── grupos/
├── jogos/
└── components/
```

Slots não terão formulário próprio. Ao criar um grupo, o backend deverá criar automaticamente a quantidade de slots informada, em uma operação transacional.

## 4. Estado atual da migração

Concluído nesta rodada:

- Next.js movido da raiz para `web/`;
- código de servidor inicial movido para `backend/src/`;
- SQL movido para `database/supabase/`;
- pasta `app/` criada para o aplicativo futuro;
- árvores de componentes e recursos criadas;
- aliases ajustados para permitir imports do backend no Next.js;
- documentação central criada;
- `npm run typecheck` aprovado após a migração;
- `npm run build` aprovado após a migração.

Ainda provisório:

- as rotas HTTP continuam em `web/app/api` porque são route handlers do Next.js;
- a rota grande `web/app/api/dropzone/route.ts` ainda precisa ser dividida;
- `web/features/dropzone` ainda contém o painel legado e será migrado por domínio;
- os formulários de campeonato e equipe ainda precisam ser extraídos do painel legado;
- as páginas públicas e painéis específicos ainda precisam ser criados na nova árvore.

## 5. Modelo de páginas aprovado

Páginas públicas:

```text
/produtoras
/produtoras/[id]
/equipes
/equipes/[id]
/jogadores
/jogadores/[id]
/managers
/managers/[id]
/campeonatos
/campeonatos/[id]
```

Painéis administrativos:

```text
/painel/produtora/[id]
/painel/equipe/[id]
/painel/jogador/[id]
/painel/manager/[id]
```

A página pública e o painel administrativo não devem ser o mesmo componente com dezenas de condicionais.

## 6. Banco conhecido

Tabelas informadas pelo usuário:

```text
campeonato_equipes
campeonato_fases
campeonato_grupo_slots
campeonato_grupos
campeonato_jogadores
campeonato_jogos
campeonato_jogos_grupos
campeonato_links
campeonato_links_inscricao
campeonato_regras
campeonato_regras_escalacao
campeonato_slots
campeonato_substituicoes
campeonatos
convites_tokens
equipe_jogadores
equipes
equipes_perfis
inscricoes_jogadores
inscricoes_substituicoes
jogadores
jogadores_equipes
manager_equipe
manager_jogador
manager_produtora
managers
produtoras
tokens
```

O uso definitivo de tabelas com nomes parecidos ainda não foi confirmado. Não substituir tabelas por suposição. Antes, consultar colunas, chaves estrangeiras, índices, constraints e políticas RLS.

Consulte `docs/BANCO_DE_DADOS.md`.

## 7. Riscos já identificados

- A API genérica atual pode buscar registros demais usando `service_role` e filtrar tarde demais.
- O painel legado carrega entidades demais em uma única requisição.
- Consumo de token e criação de inscrição não são totalmente transacionais.
- Limites de vagas podem sofrer condição de corrida.
- Managers ainda não utilizam plenamente `manager_produtora`, `manager_equipe` e `manager_jogador` nas permissões.
- Existem possíveis tabelas antigas e novas para a mesma finalidade.

Esses pontos devem ser corrigidos antes de ampliar funcionalidades críticas.

## 8. Estratégia de desempenho

- carregar somente dados da página ou aba ativa;
- paginar listas grandes;
- usar Server Components no carregamento inicial;
- usar Client Components apenas em áreas interativas;
- não executar `fetch('/api/dropzone')` para carregar o sistema inteiro;
- atualizar listas localmente ou invalidar somente o recurso alterado;
- evitar consultas N+1;
- criar índices após confirmar os filtros reais.

## 9. Comandos do projeto

Na raiz:

```bash
npm install
npm run dev
npm run typecheck
npm run build
```

Os scripts da raiz encaminham os comandos ao workspace `web`.

## 10. Regra para futuras conversas

Ao iniciar uma nova conversa:

1. enviar o ZIP mais recente;
2. informar que existe `PROJECT_CONTEXT.md`;
3. pedir para ler `PROJECT_CONTEXT.md` e `docs/` antes de alterar arquivos;
4. revisar `docs/CHANGELOG.md` para saber a última rodada concluída;
5. não reconstruir a arquitetura com base apenas na conversa nova.

## 11. Próxima etapa planejada

1. criar o formulário reutilizável de campeonato;
2. criar o formulário reutilizável de equipe;
3. extrair fases, grupos e jogos do painel legado;
4. implementar criação automática e transacional de slots;
5. dividir a API genérica por recurso e corrigir isolamento de dados.
