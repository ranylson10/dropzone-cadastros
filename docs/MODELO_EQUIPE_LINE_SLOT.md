# Modelo: Equipe → Line → Campeonato → Fase → Grupo → Slot

## Visão rápida

```text
equipes (pasta / organização)
  └── equipe_lines (unidade competitiva: nome, tag, logo)
         │
         │ 1 line ativa por campeonato
         ▼
campeonato_equipes  (participação enxuta)
  chave: campeonato_id + line_id + slot_id
  (+ status, origem_entrada, nome_exibicao, denorms)
         │
         │ slot_id ──────────────┐
         ▼                       ▼
campeonato_slots    (lugar físico no grupo: letra A/B/C)

Leitura rica (não grava):
  vw_campeonato_slots_lines  → slot + part + line + equipe + fase/grupo

Hierarquia de pastas do evento:
campeonato
  └── fase
        └── grupo
              └── slot (A, B, C…)
                    └── line (ex.: ALOE ELITE)
```

## Papéis

| Conceito | Papel |
|---|---|
| **Equipe** | Pasta. Tem dono, login, várias lines. Não joga sozinha. |
| **Line** | Quem joga e pontua. Campos: `equipe_id`, `nome`, `tag`, `logo_url`. |
| **Participação** (`campeonato_equipes`) | Escrita fina: `line_id` + `slot_id` (+ denorms). |
| **Slot** | Lugar no grupo (letra). Espelho de `equipe_id` + `line_id`. |
| **View** `vw_campeonato_slots_lines` | Leitura line-first (join fase/grupo/line/equipe). |

## Regras

1. **1 line = 1 vaga ativa** no campeonato.
2. Mesma pasta (equipe) pode ter **várias vagas** se tiver **várias lines**.
3. Line nova **herda logo/tag da equipe**; o líder pode trocar depois.
4. Em todo lugar da UI competitiva, o nome visível é o da **line** (ex.: `ALOE ELITE`), não só o da pasta.
5. Pontuação agrega por `campeonato_equipe_id` (participação da line).

## Fluxos de entrada

| Fluxo | O que grava |
|---|---|
| Admin: buscar pasta → line livre / criar line → slot | `campeonato_equipes` + ocupa `campeonato_slots` |
| Link de grupo: líder escolhe letra + line | idem |
| Convite individual (`/convite/equipe/[token]`) | token com **`slot_id`** → aceita line → `campeonato_equipes` + ocupa **slot** |

### Convite por slot (unificado)

1. Admin no slot livre: **Criar convite** (referências internas).
2. Token grava `slot_id` + `grupo_id` (+ `fase_id` se houver).
3. Líder entra, escolhe/cria **line livre**, confirma.
4. Sistema grava participação com **`slot_id` + `line_id`** (helper `inserirParticipacaoNoSlot`) e marca o slot ocupado.

`campeonato_vagas` fica só como **legado** (tokens antigos com `vaga_id`).

## O que ainda é legado / dual

- `campeonato_vagas` = vaga comercial/convite (número), **paralela** aos slots estruturais.
- Nome da tabela `campeonato_equipes` é histórico: a row é da **line**.
- Colunas do pontuador ainda se chamam `equipe_nome` em views, mas a origem deve ser line-first.
- `grupo_id` / `slot_numero` em `campeonato_equipes` continuam como **denorm** (preenchidos pelo trigger a partir de `slot_id`).

## Migrations de suporte

- `20260715_regras_equipes_lines_slots.sql` — uniques, triggers de sync, line principal
- `20260715_campeonato_equipes_slot_unique_ativo.sql`
- `20260715_origem_entrada_link_vendedor.sql`
- `20260715_participacao_slot_id_e_view.sql` — coluna `slot_id`, unique ativo, triggers, **VIEW**

## Código de domínio

- `backend/src/campeonatos/participacao-sync.ts` — `inserirParticipacaoNoSlot`, `listSlotsLinesView`, resolve line, soft-remove
- `backend/src/campeonatos/line-display.ts` — nome/logo line-first
- APIs: `equipes` (GET view / POST slot), `convites/grupo`, `convites/equipe`

## Auditoria

```bash
node scripts/audit-db-logic.mjs
```
