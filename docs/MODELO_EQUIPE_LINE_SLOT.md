# Modelo canônico: Equipe → Line → Campeonato → Fase → Grupo → Slot

**Atualizado:** 15 de julho de 2026  
**Migration:** `database/migrations/20260715_modelo_unico_slot_e_limite_vagas.sql`

## Visão rápida

```text
equipes (pasta / organização)
  └── equipe_lines (unidade competitiva: nome, tag, logo)
         │
         │ 1 line ativa por campeonato
         ▼
campeonato_equipes  (participação)
  chave: campeonato_id + line_id + slot_id
         │
         ▼
campeonato_slots    (ÚNICA vaga física: letra A/B/C no grupo)

campeonato_configuracoes.numero_vagas
  = LIMITE / meta comercial (não cria rows)
  null = sem teto
```

Hierarquia de pastas do evento:

```text
campeonato
  └── fase
        └── grupo
              └── slot (A, B, C…)   ← aqui nasce a “vaga”
                    └── line
```

## Papéis

| Conceito | Papel |
|---|---|
| **Equipe** | Pasta. Dono, login, N lines. Não joga sozinha. |
| **Line** | Quem joga e pontua. |
| **Participação** (`campeonato_equipes`) | Line + slot no evento. |
| **Slot** | Única vaga física. Criado ao montar o grupo. |
| **`numero_vagas`** | Teto/meta. Ex.: 96. Não materializa 96 rows. |
| **Lista de equipes** | View `vw_campeonato_slots_lines` (não tabela de vagas). |
| **Capacidade** | View `vw_campeonato_capacidade` (limite vs criados vs ocupados). |

## Contadores

| Métrica | Fonte |
|---|---|
| Meta (96) | `campeonato_configuracoes.numero_vagas` |
| Estrutura criada | `count(campeonato_slots)` |
| Preenchidas (20/96) | slots `ocupado` / com `line_id` |
| Livres / reservadas | status do slot + convite em `tokens.slot_id` |

Regra de banco: **não dá para criar mais slots de entrada do que `numero_vagas`** (trigger).  
Fases posteriores (classificados) **não** consomem esse limite — só a fase de menor `ordem` (+ slots sem fase).

## O que foi removido (legado)

| Removido | Motivo |
|---|---|
| `campeonato_vagas` | Segunda fonte de “vaga”; confusa e duplicada |
| `campeonato_equipes.vaga_id` | Participação aponta só para `slot_id` |
| `tokens.vaga_id` | Convite aponta só para `slot_id` |
| `campeonato_grupo_slots` | Paralelo antigo, se existia |

## Fluxos

| Fluxo | O que grava |
|---|---|
| Criar grupo com N slots | N rows em `campeonato_slots` (respeita limite) |
| Admin/vendedor: line no slot | `campeonato_equipes` + ocupa slot |
| Convite de slot | `tokens.slot_id` → status slot `reservado` |
| Link de grupo | líder escolhe letra livre → mesma escrita de participação |

## Status do slot

- `livre`
- `reservado` (convite ativo em `tokens`)
- `ocupado` (line inscrita)

## Arquivos

- Migration: `database/migrations/20260715_modelo_unico_slot_e_limite_vagas.sql`
- Sync app: `backend/src/campeonatos/participacao-sync.ts`
- View leitura: `vw_campeonato_slots_lines`
- View capacidade: `vw_campeonato_capacidade`
