# Modelo: Equipe → Line → Campeonato → Fase → Grupo → Slot

## Visão rápida

```text
equipes (pasta / organização)
  └── equipe_lines (unidade competitiva: nome, tag, logo)
         │
         │ 1 line ativa por campeonato
         ▼
campeonato_equipes  (participação da LINE no campeonato)
         │
         ├── grupo_id + slot_numero
         ▼
campeonato_slots    (lugar físico no grupo: letra A/B/C = avatar no jogo)

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
| **Participação** (`campeonato_equipes`) | Liga a **line** ao campeonato (e opcionalmente ao slot). |
| **Slot** | Lugar no grupo (letra). Guarda espelho de `equipe_id` + `line_id`. |

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
| Convite por vaga comercial (`campeonato_vagas`) | participação (+ vaga); ideal sincronizar com slot depois |

## O que ainda é legado / dual

- `campeonato_vagas` = vaga comercial/convite (número), **paralela** aos slots estruturais.
- Nome da tabela `campeonato_equipes` é histórico: a row é da **line**.
- Colunas do pontuador ainda se chamam `equipe_nome` em views, mas a origem deve ser line-first.

## Migrations de suporte

- `20260715_regras_equipes_lines_slots.sql` — uniques, triggers de sync, line principal
- `20260715_campeonato_equipes_slot_unique_ativo.sql`
- `20260715_origem_entrada_link_vendedor.sql`

## Código de domínio

- `backend/src/campeonatos/participacao-sync.ts` — resolve line, valida slot, soft-remove
- `backend/src/campeonatos/line-display.ts` — nome/logo line-first

## Auditoria

```bash
node scripts/audit-db-logic.mjs
```
