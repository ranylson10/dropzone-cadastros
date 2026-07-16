# Fluxo de convites — inscrição de equipes

Documento do fluxo reorganizado de convites para inscrição de **lines** em campeonatos. Prioridade: poucos cliques, sem etapas redundantes, acompanhamento público quando o link não aceita mais inscrições.

## 1. Tipos de link

| Tipo | Tabela | URL pública | Uso |
|---|---|---|---|
| **Link de grupo** (multi-uso) | `campeonato_links` (`inscricao_equipes_grupo`) | `/convite/grupo/[token]` | Admin define limite 1..vagas livres; várias equipes no mesmo link |
| **Link único** | `tokens` (`convite_equipe_campeonato`) | `/convite/equipe/[token]` | Um uso; slot fixo ou grupo com auto-slot |

Unidade competitiva: **line** (não “equipe genérica”). Uma pasta (equipe) pode ter várias lines; cada line entra no máximo uma vez por campeonato.

## 2. Admin — criar e gerir link de grupo

### Quem pode

- Dono da produtora / admin do campeonato.
- Managers com permissão de gestão de estrutura (criação de link de grupo).
- Vendedores: em geral geram **link único** de vaga (`gerar_convites_equipe`), não o multi-uso do grupo.

### Campos na criação

| Campo | Obrigatório | Regra |
|---|---|---|
| **Nome interno** | Recomendado | Identificação na lista do admin (`titulo`) |
| **Grupo** | Sim | Grupo do campeonato |
| **Máx. de equipes** | Sim | Entre **1** e **vagas livres** do grupo |
| **Equipes esperadas** | Não | Textarea: uma por linha ou separadas por vírgula; só controle interno |
| **Encerrar em** | Não | `expira_em` no futuro |

A lista de equipes esperadas **não interfere** na inscrição. O convidado **não escolhe** item da lista. O sistema tenta **match automático** (nome da equipe/line) e marca pendente → inscrita + line usada.

### Ações após criar

- Copiar mensagem curta / copiar só o link  
- Pausar / reativar  
- Reabrir esgotado (usos recalculados pelas entradas reais; histórico mantido)  
- Novo link (mesmo grupo)  
- **Excluir** = soft-delete (`deleted_at` + `closed_reason: excluido`); some da lista admin; URL ainda abre **acompanhamento**

### Status do link (UI)

| Status | Significado |
|---|---|
| `ativo` | Aceita inscrições |
| `pausado` | Admin desativou (`ativo = false`) |
| `esgotado` | `usos >= limite` do link |
| `grupo_cheio` | Sem slots livres no grupo |
| `expirado` | Passou `expira_em` |
| `excluido` | Soft-delete (não lista no admin) |

## 3. Convidado — abertura do link

### Regra inicial (uma checagem)

```
token utilizável?
  SIM  → fluxo de inscrição
  NÃO  → acompanhamento público (nunca tela de erro “morta” se o campeonato/grupo existir)
```

Indisponível = pausado, esgotado, grupo cheio, expirado, excluído ou (link único) já usado.

### Fluxo de inscrição (caminho feliz)

```
[Login] ──ou── [Só acompanhar]
   │
   ▼ (se login)
Tem perfil equipe? ──não──► Criar equipe ──retoma──┐
   │ sim                                           │
   ▼                                               │
Já estava logado ao abrir?                         │
  sim → Confirmar equipe / trocar conta            │
  não (login neste fluxo) → pula confirmação       │
   │                                               │
   └──────────────► Escolher ou criar line ◄───────┘
                           │
                           ▼
                    Confirmar inscrição
                    (revalida token, vagas, line, regras)
                           │
                           ▼
                    Sucesso + slot automático
```

**Removido do caminho feliz:** escolher letra do slot; escolher “referência da lista”; confirmar equipe logo após o login; hub multi-opção antes de concluir.

### Acompanhamento público

- Grade de slots (ocupados / livres).
- Clique em ocupado → line + jogadores escalados.
- Botão **“Escalar minha equipe”** (só se o link ainda aceitar inscrição): aí sim valida login / equipe / vagas.
- Se o link estiver fechado e o usuário já tiver line no grupo → hub (escalar elenco).

### Pós-sucesso

- Mensagem curta com line (e slot se houver).
- Opções: gerenciar inscrição (escalar / jogadores) ou ver grupo.

## 4. Validações no aceite (POST)

Sempre revalidar no servidor:

1. Token/link ativo e com vaga (limite e slots livres).
2. Usuário autenticado com perfil **equipe**.
3. Line livre no campeonato **ou** criação de line nova usada na hora.
4. Slot livre (fixo ou **primeiro livre** / auto-slot).
5. Consumo do uso do link **atômico** (RPC `fn_consumir_vaga_link_grupo` se a migration estiver aplicada).
6. Match best-effort da lista de equipes esperadas (não bloqueia se não casar).
7. Atualização de contadores, histórico `entradas`, grade pública e status pendente/inscrita.

## 5. Modelo de dados (resumo)

### `campeonato_links` (grupo)

- `token`, `titulo`, `ativo`, `expira_em`, `deleted_at`
- `metadata` / `descricao` com `__dz_meta__:`:
  - `limite_vagas`, `usos`, `entradas[]`, `expected_teams[]`
  - `closed_reason`, `closed_at`

### `tokens` (único)

- `tipo = convite_equipe_campeonato`
- `usado`, `status`, `expira_em`, `slot_id` / `grupo_id`

## 6. APIs e páginas

| Camada | Caminho |
|---|---|
| Público grupo | `GET/POST /api/convites/grupo/[token]` · `web/app/convite/grupo/[token]/page.tsx` |
| Público único | `GET/POST /api/convites/equipe/[token]` · `web/app/convite/equipe/[token]/page.tsx` |
| Admin CRUD links | `web/app/api/dropzone/route.ts` (`registration_link`) |
| Meta helpers | `backend/src/shared/campeonato-link-metadata.ts` |
| UI admin | `web/features/dropzone/panels/produtora/ProdutoraPanel.tsx` (aba Links) |
| Migration soft-delete + RPC | `database/migrations/20260716_links_soft_delete_e_consumo_atomico.sql` |

## 7. Migration obrigatória em produção

Rodar no Supabase → SQL Editor:

```text
database/migrations/20260716_links_soft_delete_e_consumo_atomico.sql
```

Isso habilita:

- coluna `deleted_at` (soft-delete);
- função `fn_consumir_vaga_link_grupo` (consumo atômico com `FOR UPDATE`).

Sem a migration o app ainda funciona com fallbacks (meta em `descricao`, CAS com retentativas, exclusão só por `closed_reason`).

## 8. Princípios de UX

1. Menor número de cliques no caminho feliz.  
2. Perguntas só quando o contexto exige (ex.: equipe só se a sessão já existia ao abrir o link).  
3. Link morto → acompanhar, não “erro genérico”.  
4. Lista de esperadas = ferramenta do organizador, invisível no fluxo do convidado.  
5. Slot é detalhe operacional: preferir auto-atribuição.  
6. Lines já inscritas nunca aparecem como opção.

## 9. Documentos relacionados

- `docs/PERMISSOES_CAMPEONATO.md` — quem gera cada tipo de link  
- `docs/MODELO_EQUIPE_LINE_SLOT.md` — line × slot  
- `docs/BANCO_DE_DADOS.md` — tabelas  
- `docs/TESTES_E_VALIDACOES.md` — rotas a exercitar  
