# R201 — Migração completa de controles de formulário

Objetivo: impedir que cada tela volte a criar `input`, `select` e `textarea` com arquitetura própria.

## Regra arquitetural

Todo controle HTML de formulário renderizado pelo código da aplicação passa por `web/components/ui/Field.tsx`:

- `Input`
- `Select`
- `Textarea`

Os wrappers preservam o elemento HTML real, propriedades, eventos, children e refs. Tipos especiais de `input` (`checkbox`, `radio`, `file`, `color`, `range`, `hidden`) continuam nativos e recebem apenas identificação/foco compartilhados, evitando transformar controles especiais em campos de texto.

## Escopo migrado

A rodada migra todos os usos diretos encontrados em `web/**/*.tsx`, incluindo campeonato, stream, painéis, autenticação, carrinho, vagas, agenda, Lili, broadcast, diretórios, produtoras e billing.

A auditoria falha se qualquer `<input>`, `<select>` ou `<textarea>` direto voltar a aparecer fora do primitive canônico.
