# Permissões de campeonato

Regras alinhadas em **banco**, **backend** e **frontend**.

## Papéis

| Papel | Como se define |
|---|---|
| **Admin / owner** | Dono da produtora (`produtoras.auth_user_id`) ou `campeonatos.criado_por` |
| **Manager staff** | Vínculo ativo em `manager_produtora` |
| **Vendedor (seller)** | Linha ativa em `campeonato_vendedores` (perfil manager) |
| **Equipe** | Aceita link e entra no slot |
| **Demais** | Leitura, sem botões de mutação |

## Matriz

| Ação | Admin | Manager (`pode_gerenciar`) | Vendedor padrão | Vendedor com flag | Equipe / outros |
|---|---|---|---|---|---|
| Criar campeonato | sim | não | não | não | não |
| Criar/editar/excluir jogos | sim | sim | não | não | não |
| Editar fases/grupos/slots | sim | sim | não | `organizar_grupos` | não |
| Adicionar line no slot | sim | sim | **não** | `adicionar_equipes` | via **link** |
| Remover line | sim | sim | **não** | `remover_proprias_equipes` (só as dele) | não |
| Gerar **link único** | sim | `pode_gerar_token` | **sim** (`gerar_convites_equipe`) | — | não |
| Criar **link de grupo** | sim | sim (gestão) | não | não | não |
| Pontuar tabela/súmula | sim | sim | não | `pontuar_tabela` | não |
| Ver estrutura / vagas | sim | `pode_ver` | sim (`ver_estrutura`) | — | público parcial |

## Links de entrada

Fluxo completo (UX, auto-slot, equipes esperadas, soft-delete): **`docs/FLUXO_CONVITES_EQUIPES.md`**.

### Link único (`tokens.tipo = convite_equipe_campeonato`)
- Gerado por **admin** ou **vendedor** autorizado.
- **Expira após o uso** (`usado = true`, `status = usado`).
- Também tem `expira_em` (app: 24h) como segurança.
- URL: `/convite/equipe/[token]`. Indisponível → acompanhamento público (não tela de erro).

### Link de grupo (`campeonato_links.tipo = inscricao_equipes_grupo`)
- Gerado pelo **admin**.
- Multi-uso até o **limite do link** ou slots do grupo acabarem.
- Fecha por: limite de usos, grupo cheio, pausa, `expira_em` ou soft-delete (`deleted_at` / `closed_reason: excluido`).
- URL: `/convite/grupo/[token]`.
- Consumo atômico: RPC `fn_consumir_vaga_link_grupo` (migration `20260716_links_soft_delete_e_consumo_atomico.sql`).

## Onde está implementado

| Camada | Arquivo / local |
|---|---|
| Banco (regras + RLS) | `database/migrations/20260715_seguranca_total_rls_e_permissoes.sql` **← rodar no Supabase** |
| Banco (regras leves) | `database/migrations/20260715_permissoes_campeonato_regras.sql` (subconjunto; preferir o SQL total) |
| Backend core | `backend/src/campeonatos/campeonato-permissions.ts` |
| APIs | `web/app/api/campeonatos/**`, `web/app/api/convites/**`, `web/app/api/dropzone/route.ts` |
| Frontend equipes | `CampeonatoEquipesTab` (botões por flag) |
| Frontend jogos | `CampeonatoJogosTab` (`canManageGames`) |
| Frontend vendedor | `ManagerCampeonatosView` (estrutura só leitura) |
| Frontend admin | `ProdutoraPanel` (checkboxes de permissão do vendedor) |

## Segurança total no banco (obrigatório em produção)

Rode **uma vez** no Supabase → SQL Editor:

`database/migrations/20260715_seguranca_total_rls_e_permissoes.sql`

Isso:
1. Liga **RLS + FORCE** nas tabelas de domínio
2. **Revoga** `SELECT/INSERT/UPDATE/DELETE` de `anon` e `authenticated` nessas tabelas
3. Mantém o **backend** (service_role) como único escritor de negócio
4. Fecha **link de grupo** quando o grupo enche (trigger)
5. Impede **reativar convite único** já usado
6. Defaults de vendedor: só convite, sem add/remove

Sem esse SQL, quem tiver a `anon key` + PostgREST ainda poderia tentar acessar tabelas se grants antigos existirem.

## Helpers backend

- `requireCampeonatoOwner` — só admin
- `requireCampeonatoTeamsWrite` / `requireCampeonatoTeamsRemove`
- `requireCampeonatoGamesWrite` — jogos/rodadas
- `requireCampeonatoStructureWrite` — fases/grupos
- `requireCampeonatoTokenPermission` — convites
- `requireCampeonatoScore` — pontuação
- `requireCampeonatoStructure` — leitura de estrutura

## Defaults do vendedor

```json
{
  "vendedor_vagas": true,
  "adicionar_equipes": false,
  "remover_proprias_equipes": false,
  "gerar_convites_equipe": true,
  "ver_estrutura": true,
  "organizar_grupos": false,
  "pontuar_tabela": false
}
```

Entrada de equipes no campeonato deve ser **por link**, não por botão direto do vendedor (salvo liberação explícita do admin).
