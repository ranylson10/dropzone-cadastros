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

Com o projeto vinculado na CLI do Supabase, execute:

`node scripts/testes/atualizar-inventario-publicado.mjs`

O script consulta `database/auditoria/rodada_2_inventario_banco.sql` e salva somente o
objeto retornado em `relatorios-testes/banco-publicado.json`.

## Integridade e ON CONFLICT

Execute `node scripts/testes/atualizar-integridade-publicada.mjs` e rode novamente o
robô. O script consulta o banco vinculado e atualiza
`relatorios-testes/integridade-publicada.json` automaticamente.

O SQL da Rodada 3 é somente leitura: verifica tabelas, colunas, índices UNIQUE, duplicidades e constraints não validadas.

## Auditoria ampliada — CSS, rotas e segurança do banco

A suíte também executa automaticamente:

- `14-css-cascata.mjs`: valida chaves CSS, excesso de `!important`, repetição pesada de seletores, risco de overflow horizontal e isolamento do CSS público do campeonato.
- `15-rotas-seguranca.mjs`: gera inventário de todas as APIs, métodos de escrita e evidências estáticas de autenticação/escopo. O scanner é conservador e deve ser lido junto da matriz Service Role.
- `16-banco-migrations-seguranca.mjs`: procura grants perigosos para `anon`, RLS desabilitado, funções `SECURITY DEFINER` sem `search_path` e resume a cobertura RLS versionada.

Para conferir o banco realmente publicado, execute também no Supabase SQL Editor:

`database/auditoria/rodada_4_seguranca_banco.sql`

O SQL é somente leitura. Ele lista tabelas sem RLS, tabelas com RLS sem policy, funções `SECURITY DEFINER` sem `search_path` fixo e privilégios de escrita concedidos a `anon`.
