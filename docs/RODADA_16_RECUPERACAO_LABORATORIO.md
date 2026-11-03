# Rodada 16 — Recuperação segura do catálogo e geração offline do esquema

## Resultado reproduzido em 26/10/2026

A versão R15 não incluía `relatorios-testes/banco-publicado.json` por segurança; portanto, sem esse arquivo a ferramenta de laboratório não conseguia reconstruir o esquema. Foi localizado **no ZIP original fornecido**, dentro de `relatorios-testes\\banco-publicado.json`. A extração seletiva identificou **118 tabelas-base e 14 views**, com data de captura **2026-10-11T02:46:22Z** e SHA-256 `f6d97d7334166ee39da1b86e6b0a5e34ae7f9e0baf573774f6190c0a5cc3aeb2`.

**Esse catálogo é histórico**, não um retrato atualizado do Supabase de 26/10. Ele não inclui dados de jogadores nem um backup completo; também não permite homologar ACL/RLS ou concorrência de um ambiente de produção.

## Correções

- `scripts/release/importar-catalogo-original.mjs` extrai **somente** o JSON esperado do ZIP original (aceita `/` ou `\\` no nome). Verifica estrutura, tipo de compressão, limites de tamanho e CRC32. Não extrai `.auth`, não usa rede e não executa SQL. O arquivo gerado permanece em `relatorios-testes/`, excluído dos ZIPs e do Git.
- `scripts/testes/postgres-inscricoes/build-schema.mjs`: cria automaticamente a pasta de saída, corrigindo o erro **ENOENT** na primeira execução de `--emit-only`.
- `scripts/release/round15-lab-preflight.mjs`: valida que o catálogo possui arrays estruturais, número plausível de tabelas-base e data. Exibe a idade do retrato e distingue a ausência do Docker da ausência do catálogo.
- `IMPORTAR_CATALOGO_R16.bat`: permite arrastar o ZIP original sobre o BAT, importar o catálogo e gerar o SQL de reconstrução sem Docker.
- `npm run test:round16`: testes independentes de ZIP original, com fixtures locais e casos de corrupção, entrada duplicada, caminho inválido, CRC e JSON incompleto.

## Windows — passo a passo

1. Extraia `DROPZONE_RODADA_16_FONTE_COMPLETA.zip` em uma pasta limpa.
2. Localize **seu arquivo original** `dropzone-cadastros-ENVIO.zip` (o arquivo grande, anterior às rodadas). **Arraste o ZIP original** sobre `IMPORTAR_CATALOGO_R16.bat`. É necessário Node.js; não precisa instalar dependências nem abrir CMD. Você também pode chamar `npm run release:catalog:import -- "C:\\caminho\\dropzone-cadastros-ENVIO.zip"`.
3. O BAT cria `relatorios-testes/banco-publicado.json` e `relatorios-testes/banco-inscricoes-2026-10-11/schema-reconstruction.sql`. Ambos são arquivos locais **não distribuídos**.
4. O preflight avisará que o Docker não está preparado. Isso **não significa** que a importação falhou. Para a próxima etapa, instale Docker Desktop e siga exatamente `scripts/testes/postgres-inscricoes/README.md`, usando somente o contêiner isolado de identidade verificada.
5. Execute `npm run test:round16` para os testes offline. O restante do projeto continua exigindo `npm ci`, build Next.js, testes E2E e PostgreSQL real.

## Limites

O esquema sintético emitido (aprox. 405 KB nesta execução) **não foi executado em PostgreSQL**. Ele não substitui um backup completo e recente de staging, pois o catálogo de 11/10 tem lacunas documentadas de views, ACLs e propriedades do esquema. A versão distribuível **não contém** catálogo, SQL reconstruído, tokens ou sessões.

**Nenhuma migration foi aplicada, não houve deploy e os modos atômicos continuam desligados.** O gate de publicação permanece BLOQUEADO até o build integral e as provas externas.
