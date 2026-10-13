# Encerramento e reabertura: diagnóstico e contenção local

12/10/2026 · DropZone · HEAD ef9416e15643e38f70024be6ba7bc91a909794a8.

**O encerramento e a reabertura foram bloqueados no código local. A solução transacional ainda não está preparada.** O serviço publicado, o banco, GitHub e Vercel não foram atualizados nesta etapa. Essa contenção impede usar os escritores inseguros quando este código for publicado; ela reduz temporariamente a funcionalidade e não encerra a pendência de lifecycle.

## Falhas reproduzidas

O handler anterior foi preservado antes da edição em `relatorios-testes/lifecycle-2026-10-12/legacy-route.snapshot.ts`. As reproduções executam esse handler e o SDK Supabase reais, com HTTP, autenticação e tabelas fictícias. Nenhum incidente em usuários reais foi demonstrado e não houve ensaio PostgreSQL nesta etapa.

- **LC01/P2 — gravações parciais.** `publish_final` dispara quatro PATCH independentes para etapas, divisões, edição e inscrições. A falha em qualquer um dos quatro deixou os demais persistidos. `reopen_final` dispara três PATCH; a falha em qualquer um deles também deixou estado parcial. A recarga da estrutura pode ainda falhar depois das quatro gravações concluídas, devolvendo erro apesar do encerramento já persistido. O chamador não tem como interpretar esse erro como rollback.
- **LC02/P2 — validação separada da publicação.** A contagem de quedas finalizadas e a classificação são leituras anteriores às alterações. A fixture adicionou uma queda agendada após a validação, antes do primeiro PATCH: o handler publicou e encerrou a edição com a queda nova ainda pendente. É reprodução da janela entre requisições, sem prova de bloqueios nativos ou de todas as formas de concorrência.
- **LC03/P2 — repetição sem recibo.** Duas chamadas de publicação com o mesmo `Idempotency-Key` efetuaram oito gravações. Não havia conferência de corpo/UUID, imagem anterior ou recibo para recuperar uma resposta perdida. Repetir pode redefinir metadados e horários de publicação.

Uma reprodução adicional documentou a semântica anterior: a reabertura ativa etapas já encerradas antes da publicação, transforma divisão antes planejada em ativa e conserva os campos antigos de campeão/total, embora apague a data e o autor da publicação. As inscrições permanecem fechadas. **Não foi inventada uma nova regra de negócio para esses casos.** A futura reabertura precisa definir a restauração e a compatibilidade das edições encerradas sem imagem anterior.

## Correção de contenção

`lifecycle-safety.ts` recusa `publish_final` e `reopen_final` com 503/no-store. A rota autentica e exige gestão antes de ler o corpo; a recusa ocorre antes de consultar estrutura, calcular ranking ou escrever tabelas. POST, PATCH e DELETE passam pela mesma proteção. Os ramos antigos de encerramento/reabertura foram removidos. Não há flag que os reative e não foi criada uma RPC fictícia para anunciar um modo atomic ainda inexistente. GET continua disponível e informa `lifecycle_write_mode: unavailable`.

Na web, `EditionLifecycleStatus` substitui a confirmação e o POST antigo. O componente consulta o estado e mostra a indisponibilidade com os botões desativados, inclusive se um servidor antigo anunciar atomic. A leitura confere sessão antes/depois, actor do DTO, campeonato, status e formato de data; usa no-store, AbortController e limite de 15 segundos. A chave de conta/recurso/epoch impede mostrar resultados tardios de outra sessão, troca A-B-A ou componente desmontado. Isso cobre este componente, sem certificar todos os callbacks do painel da produtora.

No aplicativo, os handlers de publicar/reabrir foram removidos e os controles ficaram desativados com estado de acessibilidade e aviso. Consulta de classificação e administração de premiações continuam existentes; a inserção de premiação foi conferida no backend por fixture. Os demais callbacks/leitores mobile não foram reescritos, nem certificados contra troca de conta/dispositivo nesta etapa.

## Validação

- **41 checks HTTP/cliente**: 11 reproduções históricas e 30 checks da versão atual. Incluem auth/permissão antes do corpo, recusa dos três métodos sem requests às tabelas, GET disponível, premiação separada preservada, DTO estrangeiro e mudança de sessão/contexto.
- **32 cenários de navegador na execução final**, 16 do componente de lifecycle (oito desktop/oito viewport móvel) e 16 regressões de edição/franquia. Dados/HTTP/Auth são adaptados e o destino é uma fixture local, sem servidor remoto. Passaram sem falhas ou retries; o resultado fica em `runtime-final.log`. A execução inicial de 16 também passou e não foi somada duas vezes.
- **16 contratos estáticos** dos arquivos de encerramento e integrações relacionadas. Três referências de temporada, já extraída em etapa anterior, foram atualizadas para os módulos atuais; expectativas funcionais de origem, duplicidade e confirmação foram mantidas.
- Gate de segurança com **38 suítes**, tipos web, lint web/backend e tipos mobile. O primeiro comando de release parou no build com `spawn EPERM`, após esses checks; o build foi retomado com permissão para o worker local. Os logs finais de build, tipos, lint e auditorias npm constituem a conferência da versão final, sem atribuir exit zero ao comando inicial interrompido.

Os arquivos finais de evidência registram os exit codes, hashes e limites. O npm de produção não equivale à auditoria completa de dependências mobile/desktop/ferramental. O tráfego de leitura externa do build normal não foi instrumentado. Não houve SQL/MCP ao projeto, DDL/DML remoto, alteração de Auth/ambiente, commit, push, PR ou deploy. Docker não foi iniciado; os cenários nativos anteriores continuam históricos.

Histórico de falhas preservado: primeiro teste HTTP não carregou `next/server` por resolução ESM, corrigido para `next/server.js`; a primeira execução de navegador não iniciou o worker por `spawn EPERM` e passou após a retomada local autorizada. A execução estática ampla encontrou quatro expectativas antigas: três apontavam trechos removidos pela extração anterior de temporada, uma exigia aspas/espaçamento exatos do menu mobile. Os 16 contratos foram repetidos após ajustar essas referências. Nenhuma falha foi declarada como corrigida por alterar a aplicação de temporada.

## O que ainda falta neste fluxo

Preparar uma operação única com autorização no banco, ranking e quedas autoritativos, coordenação com os escritores de pontuação/jogos/edição/configuração, versões, pós-condições e recibo. A reabertura exige definir o estado a restaurar e tratar alterações posteriores e publicações históricas sem recibo. Depois, conferir ACLs, falhas e concorrência nativas, HTTP, clientes e staging antes de ativação revisada. Nenhum desses critérios foi satisfeito apenas pelo bloqueio local.

Os 26 achados originais continuam em 20 corrigidos e seis parciais. São 15 candidatos SQL de alteração e um preflight, sem novo SQL nesta etapa; seus hashes anteriores foram preservados. Criação completa do campeonato, demais writers, staging, layout/acessibilidade integrais e QA de aparelhos continuam no [registro de fechamento](E:/dropzone-cadastros/docs/PENDENCIAS_FECHAMENTO_2026-10-12.md).
