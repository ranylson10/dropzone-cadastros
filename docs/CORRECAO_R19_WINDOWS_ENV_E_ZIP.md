# Correção R19 — testes de Windows com `.env.local` e ZIP original

## Origem da correção

No Windows, `TESTAR_RODADA_19.bat` falhava na asserção `segredos de ambiente herdado nao passam ao build` quando havia um `.env.local` real. O sanitizador do build removia segredos herdados, mas adicionava **placeholders seguros** para sobrescrever variáveis que o Next.js carrega automaticamente de `.env.local`. O teste anterior esperava ausência das chaves nos dois cenários, confundindo a proteção correta com falha.

A verificação agora cobre os dois casos de forma isolada:
- Sem arquivo `.env`: segredos herdados são removidos do processo.
- Com `.env.local`: credenciais detectadas são substituídas por valores fictícios, e não pelos valores privados. Nenhuma configuração local do usuário é alterada.

O executor `HOMOLOGAR_POSTGRES_R19.bat` antes aceitava qualquer arquivo existente, inclusive o próprio `.bat`, e tentava lê-lo como ZIP. Agora valida **extensão, estrutura, CRC e catálogo esperado (100+ tabelas)** antes de pedir a criação do contêiner Docker. Caso inválido, termina sem executar SQL ou criar contêiner.

## Execução no Windows

1. Extraia o ZIP completo corrigido em uma **pasta nova**, sem misturar arquivos antigos. Não copie `.env.local` de produção para ela.
2. No Explorador, abra a pasta, digite `cmd` na barra de endereço e pressione Enter.
3. Para testes locais, execute `TESTAR_RODADA_19.bat`. Um resultado `PUBLICACAO AINDA BLOQUEADA` ao final indica que as evidências externas continuam faltando; não é necessariamente uma falha dos testes locais.
4. Para o build, execute `HOMOLOGAR_WEB_R19.bat`. Se não aparecer nenhuma saída, execute diretamente `node scripts\release\round19-web-check.mjs --execute` e compartilhe o relatório JSON em `relatorios-testes\r19-web-evidence.json`.
5. Para PostgreSQL, coloque **o ZIP original** `dropzone-cadastros-ENVIO.zip` na pasta do projeto (não o ZIP corrigido) ou arraste o original ao terminal quando for solicitado. Execute `HOMOLOGAR_POSTGRES_R19.bat` com Docker Desktop aberto. Ao pedido de caminho, informe o nome/caminho do **ZIP original**, nunca o nome do arquivo `.bat`.

O laboratório só cria um PostgreSQL descartável com dados sintéticos, depois de validar o ZIP original e a configuração local do Docker. Não executa migrations em produção.

## Verificações executadas nesta correção

- `npm run test:round19:buildfix` — 22 verificações aprovadas.
- `npm run test:round19` — 33 verificações aprovadas.
- `npm run test:rounds` — R01–R12 aprovadas com TypeScript global disponibilizado temporariamente para os testes.
- `npm run test:round13` a `npm run test:round18` — aprovados.
- Validação somente leitura do `dropzone-cadastros-ENVIO.zip` original — 118 tabelas-base reconhecidas.

**Ainda não executados aqui:** build integral Next.js, teste de concorrência PostgreSQL nativo e E2E autenticado. Não há liberação para produção.
