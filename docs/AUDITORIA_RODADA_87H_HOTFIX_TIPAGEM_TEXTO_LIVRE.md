# Rodada 87H — Hotfix de tipagem do texto livre

## Correção

O estilo inicial do texto livre agora preenche explicitamente os campos obrigatórios de `TextStyle`:

- `fontFamily`;
- `fontWeight`;
- `fontSize`;
- `color`.

Os valores opcionais existentes continuam preservados.

## Impacto

- corrige o erro TypeScript em `StreamOverlayEditor.tsx`;
- não altera banco, API ou regras do editor;
- mantém texto e imagem livres funcionando como definido na Rodada 87H.
