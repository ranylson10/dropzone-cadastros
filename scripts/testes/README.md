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

## Auditoria ampliada — CSS, rotas e segurança do banco

A suíte também executa automaticamente:

- `14-css-cascata.mjs`: valida chaves CSS, excesso de `!important`, repetição pesada de seletores, risco de overflow horizontal e isolamento do CSS público do campeonato.
- `15-rotas-seguranca.mjs`: gera inventário de todas as APIs, métodos de escrita e evidências estáticas de autenticação/escopo. O scanner é conservador e deve ser lido junto da matriz Service Role.
- `16-banco-migrations-seguranca.mjs`: procura grants perigosos para `anon`, RLS desabilitado, funções `SECURITY DEFINER` sem `search_path` e resume a cobertura RLS versionada.

Para conferir o banco realmente publicado, execute também no Supabase SQL Editor:

`database/auditoria/rodada_4_seguranca_banco.sql`

O SQL é somente leitura. Ele lista tabelas sem RLS, tabelas com RLS sem policy, funções `SECURITY DEFINER` sem `search_path` fixo e privilégios de escrita concedidos a `anon`.
