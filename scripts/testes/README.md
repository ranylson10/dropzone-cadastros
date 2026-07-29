# Robô de auditoria do DropZone

## Execução

- `TESTAR_DROPZONE.bat`: auditoria completa no Windows.
- `npm run audit:dropzone`: auditoria rápida, sem build.
- `npm run audit:dropzone:full`: auditoria completa.

## Arquivos produzidos

- `relatorios-testes/ultimo-relatorio.txt`
- `relatorios-testes/ultimo-relatorio.json`
- `relatorios-testes/falhas-encontradas.txt`

## Inventário do banco publicado

1. Execute `database/auditoria/rodada_2_inventario_banco.sql` no Supabase.
2. Salve somente o JSON retornado em `relatorios-testes/banco-publicado.json`.

## Integridade e ON CONFLICT

1. Execute `database/auditoria/rodada_3_integridade_banco.sql` no Supabase.
2. Salve somente o JSON retornado em `relatorios-testes/integridade-publicada.json`.
3. Rode novamente o robô.

O SQL da Rodada 3 é somente leitura: verifica tabelas, colunas, índices UNIQUE, duplicidades e constraints não validadas.
