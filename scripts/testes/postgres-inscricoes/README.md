# Validação nativa de inscrições

Suíte opcional de PostgreSQL, separada de `test:security` e do gate web. Só aceita o contêiner `dropzone-audit-inscricoes-01a128`, imagem `postgres:17.6`, label `dropzone.audit=inscricoes-20261011`, estado running e rede `none`. Os nomes de banco também são restritos a fixtures. Não lê URL ou credencial de banco publicado.

Exige Docker Linux e o catálogo local `relatorios-testes/banco-publicado.json`, exportado na auditoria. Esse arquivo e os resultados ficam ignorados pelo Git. A reconstrução importa as 118 tabelas públicas, constraints, índices, funções, RLS e policies desse catálogo; máscaras de UPDATE e duas identities são recuperadas das migrations locais. Não reproduz views, infraestrutura Supabase, owner/ACL reais ou todas as propriedades de tipos. O teste **não substitui staging com dump completo e atualizado**.

No PowerShell, a partir da raiz, com Docker Desktop disponível:

```powershell
docker run -d --name dropzone-audit-inscricoes-01a128 --label dropzone.audit=inscricoes-20261011 --network none --memory 512m --cpus 2 -e POSTGRES_PASSWORD=synthetic_fixture_only -e POSTGRES_DB=dropzone_audit postgres:17.6
node scripts/testes/postgres-inscricoes/build-schema.mjs
node scripts/testes/postgres-inscricoes/fresh-validation.mjs dropzone_validation_run1
$env:DROPZONE_FIXTURE_DB='dropzone_validation_run1'
node scripts/testes/postgres-inscricoes/validate-native.mjs 40000
```

Use um banco **novo** em cada rodada; não repetir a suíte sobre resíduos anteriores. Ela modifica apenas registros fictícios, instala candidatos no laboratório e testa constraints/gatilhos reais, 35 cenários, sessões concorrentes, falhas injetadas, recibos, prazo/fechamento e metadados com mais de 500 KB. O PostgreSQL pode avançar sequences mesmo em rollback; o critério é ausência de rows órfãs e preservação dos dados, não ausência de gaps.

O preflight de leitura está em `docs/sql/20261011_enrollment_preflight_readonly.sql`. `prepare-rollback.mjs` gera o rollback com fingerprints exatos dos candidatos instalados **no laboratório**. `validate-rollbacks.mjs` exige um segundo banco limpo preparado por `fresh-validation.mjs` e recebe seu nome como argumento. Recibos e participações são preservados; histórico de reinscrição faz o rollback recusar a restauração do índice global. O rollback restaura o gatilho anterior, incluindo DBR01: preferir correção adiante após uso real.

Os candidatos em `docs/sql/` não são migrations automáticas. A integração local de backend/web/Lili/app está preparada, mas `INVITE_ENROLLMENT_MODE` continua legacy; não ativar atomic antes da validação/aplicação revisada. Conferir esquema atual, owners/grants, dados legados, escritores administrativos, ordenação dos locks, paridade HTTP/DTO real, deadlock/timeout e retenção/reconciliação de recibos. Clientes persistem a UUID antes do envio; apps antigos sem o novo header precisam atualização. No modo atomic, erro/ausência da RPC nunca recorre às gravações legadas. Testes de transporte/cliente do gate usam fixtures e não substituem este laboratório ou staging.

Depois de guardar as evidências, conferir nome/label do próprio contêiner e remover somente esse laboratório descartável. Não executar limpeza genérica de Docker ou volumes.

## Movimentações de slots — candidato separado

O [plano de slots](E:/dropzone-cadastros/docs/sql/20261011_slot_plan_candidate.sql) mantém proprietário como permissão padrão. A revisão acrescentou um helper de autorização e um wrapper move/swap de gestão, com transporte HTTP local opt-in e ainda desativado. Não ativar antes de revisar todos os escritores, escolha pela equipe, configurações/bloqueios/notificações, progresso/fases e contratos dos clientes. Cancelar no plano limpa a localização da participação ativa; não remove a inscrição nem devolve convite/pagamento/quota.

Com o mesmo laboratório isolado e a reconstrução emitida, execute:

```powershell
node scripts/testes/postgres-inscricoes/validate-slot-plan.mjs dropzone_validation_movements_run1 relatorios-testes/movimento-rpc-2026-10-11
```

O script cria dois bancos **novos**: um baseline com o catálogo antigo, sem candidatos, e outro com espelho revisado/plano. Reproduz cinco sequências problemáticas das rotas, incluindo reidratação de slot, troca interrompida, compensação sobre ocupante substituto, claim com zero rows e reserva duplicada da line na mesma fase. Executa 31 cenários do candidato, incluindo falhas de histórico/recibo/agenda, snapshots stale, escopo, ACL, origem/destino, cancelamento/restauração, concorrência real e replay. Seis sessões com a mesma chave têm PIDs distintos e espera por lock observada. Também testa uma corrida com a RPC de inscrição; não representa todos os escritores.

O retorno descartado seguido de replay testa recibo após commit, sem simular perda de rede/PostgREST real. Histórico e recibos são parte da mesma transação; a agenda é reconstruída pelos gatilhos existentes, com verificação de rollback em fixture com jogo. Não houve ensaio de carga com plano de mil linhas nem revisão exaustiva dos efeitos de todos os gatilhos. As primeiras execuções e falhas de preparação de fixtures ficam preservadas nos logs; usar bancos novos a cada rodada.

Evidências desta continuação: `relatorios-testes/movimentacoes-2026-10-11/`. Manter a integração de inscrições desativada enquanto os demais escritores/locks e o esquema de staging não forem validados. Nenhum script recebe URL/credencial do Supabase.

## Transporte move/swap e paridade de permissões

Criar outro banco novo para a matriz de transferência. O setup instala helper, plano e wrapper nessa ordem, simula defaults permissivos de tabela e confere que os recibos permanecem privados e sem INSERT/UPDATE/DELETE direto de service_role.

```powershell
node scripts/testes/postgres-inscricoes/fresh-validation.mjs dropzone_validation_transfer_run1 --slot-transfer
node scripts/testes/postgres-inscricoes/validate-slot-transfer.mjs dropzone_validation_transfer_run1
$env:DROPZONE_FIXTURE_DB='dropzone_validation_transfer_run1'
node scripts/testes/postgres-inscricoes/validate-native.mjs 340000
```

33 casos nativos de transferência passaram, incluindo 15 casos de paridade com o backend sobre rows nativas, booleanos JSON estritos, precedência dos perfis, replay antes de ler a origem vazia, snapshot alterado, ACL, rollback, concorrência e revogação do vínculo selecionado sob lock. O índice nativo impede dois perfis manager para a mesma conta e vendedores duplicados para o mesmo campeonato/manager; as fixtures de muitos perfis são apenas compatibilidade legada. Junto com 31 casos do plano revisado e 35 regressões de inscrição, são 99 casos finais nesta etapa. Novos vínculos/restrições concorrentes, permissões ausentes e escritores que não seguem os locks continuam pendentes.

`SLOT_MOVEMENT_MODE` continua legacy. Atomic permite apenas move/swap no PATCH de equipes; outros modos desse PATCH recusam, mas POST/DELETE, escolha-grupo, estrutura-avançada e outras rotas ainda escrevem fora da RPC. O app persiste UUID e intenção original antes de enviar, isolados por conta/campeonato, e oferece confirmação após resposta perdida. Os testes HTTP/storage/DOM do gate não certificam PostgREST/Auth real nem dispositivo nativo. Evidências atuais em `relatorios-testes/movimento-rpc-2026-10-11/`; SQLs candidatos não aplicados ao Supabase.

## Escolha de grupo por equipe e administração

O nono candidato, [group_choice](E:/dropzone-cadastros/docs/sql/20261011_group_choice_candidate.sql), usa o helper/plano revisados. Equipe precisa ser proprietária, respeitar a janela e permitir mudança; restauração também respeita bloqueio do destino. Administração conserva a escolha manual apesar da janela fechada. Participação, histórico, notificação e recibo pertencem à mesma transação; falha de notificação recusa tudo. Header/chave e intenção original precedem envio, com source_slot_id explícito e history_id exato para restaurar. Backend/duas interfaces web preparados; a flag continua legacy, SQL não aplicado.

```powershell
node scripts/testes/postgres-inscricoes/fresh-validation.mjs dropzone_validation_choice_run1 --group-choice
node scripts/testes/postgres-inscricoes/validate-group-choice.mjs dropzone_validation_choice_run1 relatorios-testes/escolha-atomica-2026-10-11
node scripts/testes/postgres-inscricoes/validate-slot-transfer.mjs dropzone_validation_choice_run1 relatorios-testes/escolha-atomica-2026-10-11
$env:DROPZONE_FIXTURE_DB='dropzone_validation_choice_run1'
node scripts/testes/postgres-inscricoes/validate-native.mjs 640000
```

35 casos de escolha, 31 de plano, 33 de movimentação e 35 de inscrição passaram: 134 nativos finais. Rodar transferência e inscrição sequencialmente no mesmo banco para evitar interferência das fixtures. O setup de escolha acrescenta um capturador fictício `realtime.send` em uma tabela do schema realtime: exercita a função/gatilho de notificação e registra rollback local; não certifica a infraestrutura ou entrega real do Supabase Realtime. A primeira execução não tinha esse schema, a segunda fixture violou equipes_auth_user_unique; falhas preservadas/corrigidas sem remover índices.

Bloqueios inseridos após a leitura, reparenting de estrutura e demais escritores ainda precisam de protocolo de locks/staging. POST/DELETE de inscrições, shuffle/distribuição/progressão, reserva/pagamento, ACL/dump atual e retenção/conciliação continuam pendentes antes de ativar. Esta fase usa evidências próprias; não reutilizar pastas históricas.

## Sorteio e distribuição administrativa

O décimo candidato, `20261011_slot_batch_candidate.sql`, recebe o conjunto completo de participações ocupantes com id/slot/equipe/line/updated_at. Não normalizar timestamps com Date.toISOString: a versão PostgreSQL pode ter microssegundos. Grupos/source/participações repetidos e conjunto alterado são recusados; locks de lines e participações antecedem a comparação. Fase pai precisa pertencer ao campeonato. Reservas não entram nos destinos e não são limpas; a distribuição equilibrada ranqueia apenas as posições utilizáveis de cada grupo. A UUID fixa a ordem pseudorrandômica e o recibo recupera o mesmo sorteio antes de ler o acompanhamento atual. Gestão revogada impede replay. Administração conserva intervenção com inscrições/escolha fechadas; convite/quota/pagamento não são alterados.

```powershell
node scripts/testes/postgres-inscricoes/fresh-validation.mjs dropzone_validation_batch_run1 --slot-batch --group-choice
node scripts/testes/postgres-inscricoes/validate-slot-batch.mjs dropzone_validation_batch_run1 relatorios-testes/distribuicao-atomica-2026-10-11
node scripts/testes/postgres-inscricoes/validate-group-choice.mjs dropzone_validation_batch_run1 relatorios-testes/distribuicao-atomica-2026-10-11
node scripts/testes/postgres-inscricoes/validate-slot-transfer.mjs dropzone_validation_batch_run1 relatorios-testes/distribuicao-atomica-2026-10-11
```

Usar nomes de banco novos e outra pasta de evidências em novas rodadas; os comandos acima descrevem esta rodada. Validadores sobre o mesmo banco devem rodar em sequência, pois as fixtures de permissão alteram rows compartilhadas. `validate-slot-batch` exige banco e pasta explícitos. 40 cenários passaram (39 candidato e uma reprodução da limpeza ampla do legado), incluindo seis sessões/um commit/cinco replays, duas distribuições concorrentes, reserva durante espera, snapshot/espelho/fase estrangeiros e rollback de histórico/recibo. Junto às 31 regressões de plano, 35 escolha, 33 transferência e 35 inscrição, são 174 casos finais. As cinco reproduções antigas do plano também foram repetidas separadamente. Falhas iniciais de capacidade e unicidade da line por fase foram corrigidas nas fixtures, sem remover constraints/gatilhos.

Dispatcher HTTP local preparado, 68 fixtures e gate23 aprovados; SLOT_MOVEMENT_MODE continua legacy, SQL não aplicado. Atomic aceita move/swap/shuffle/distribute, mas review_request ainda recusa e POST/DELETE/outras inscrições continuam legados. Únicos callers batch encontrados estão no hub Lili órfão, sem import ativo; não foram atualizados/ativados. Cliente ativo com snapshot completo/UUID persistida, contratos de Liga/divisões/progressão, todos escritores/locks, carga de mil participações e staging/HTTP real ainda precisam validação. Nenhuma UI/browser/device QA foi repetida nesta fase. Laboratório e volume próprios encerrados; Docker restaurado parado.

## Participação e compatibilidade de Liga

O candidato11 `20261011_participation_write_candidate.sql` prepara request/add/approve/reject/remove com auditoria/recibo privados, line/espelho/agenda na transação e snapshot exato de versão para alterações. Depende do helper de permissão, mirror e rejoin guard. O novo `PARTICIPATION_WRITE_MODE` continua legacy; clientes ativos ainda não enviam UUID persistida/corpo/snapshot e precisam de DTO de versão/retomada. Cotas diretas serializadas antes de equipes; revisão conserva o criador original e a regra anterior de não debitar a cota de adição direta do revisor. Política unificada de cotas continua pendente. Season/bulk não integrados.

O catálogo anterior não tem `liga_divisoes`, e o CHECK de origem recusa os seis `liga_*` emitidos pela UI. O candidato12 `20261011_liga_schema_candidate.sql` completa os quatro campos/arrays da migration local20260814 e compara a definição original de origem antes de conservar os oito valores antigos/acrescentar seis Liga. Alteração de schema guardada e testada somente no lab; não é constraint removida para ignorar fixture inválida. Reaplicação/definição desconhecida recusa. Fresh preflight/owners/ACL/staging e rollback revisado ainda necessários; não apagar dados Liga/auditoria/recibos para voltar.

```powershell
node scripts/testes/postgres-inscricoes/fresh-validation.mjs dropzone_validation_participation_run1 --participation --slot-batch --group-choice
node scripts/testes/postgres-inscricoes/validate-participation.mjs dropzone_validation_participation_run1 relatorios-testes/participacoes-atomicas-2026-10-11
```

Usar banco **novo** e pasta de evidência própria em cada rodada. `validate-participation` exige ambos explícitos. Ele primeiro verifica que a ausência de configuração Liga recusa; então aplica o candidato12 só no laboratório para testar quotas/origens/configuração/guard. 59 casos finais, incluindo cota entre equipes/grupos distintos, seis sessões/um commit/cinco replays, role de workspace readonly prevalecendo sobre seller liberado, reinserção após remoção, snapshots stale, ACL e dez combinações ação×falha audit/receipt. Gatilhos que fecham/despublicam/mudam a row ou encerram prazo são detectados depois do receipt, com rollback.

Regressões de inscrição precisam de **outro banco novo sem --participation**, pois reproduzem o índice global antes de aplicar o rejoin guard; rodar escolha/transferência/batch/inscrição sequencialmente nesse banco. Plano usa bancos próprios. 233 cenários finais =59participação +40batch +31plano +35escolha +33transferência +35convite; cinco reproduções anteriores do plano também repetidas separadamente. 83 fixtures HTTP/20permissões/gate24/tipos/lint/build/npmprodução0 aprovados. Sem nova UI/browser/device nesta fase. Logs de startup, adaptação de view/UUID, cache nulo, coluna e origem incompatíveis preservados; mudanças de código/schema separadas das fixtures.

Correções legacy locais: flags full/own de remoção separadas, autoria/origem exigidas para own; seller selecionado por ID com manager atual/ativo; workspace autorizado remove; GET read-only/no-store/pai No Ar antes das relações. Request usa política de fechamento/prazo e updates de rejeitada/review incluem status/versão. Reserva expirada ainda precisa de writer de limpeza autorizado; não se libera via GET. Todos os candidatos seguem não aplicados ao Supabase. DBR01/DBR02, esquema atual Liga, clientes e demais escritores/staging/QA continuam pendentes.

## Continuação LG02 — validação estrita das cotas da Liga

O candidato de participação foi alterado localmente para recusar frações, valores não finitos, tipos JSON incompatíveis, soma acima do inteiro seguro e agrupamentos ambíguos. Valida todas as entradas da divisão selecionada, mantendo soma por origem. Quantidade zero no plano legado não cria vaga; inclusão e aprovação exigem cota positiva. A projeção do plano não converte arrays em quantidades/tipos válidos. A autorização, locks, recibos e fronteiras de replay anteriores permanecem no candidato.

**A versão alterada ainda não foi compilada/testada em PostgreSQL.** A criação do laboratório foi bloqueada pela revisão automática por limite de uso, sem julgamento de risco. Não ativar nem aplicar; os resultados nativos anteriores são históricos e pertencem ao hash antigo. O Docker foi iniciado antes do bloqueio, mas o contêiner não foi criado.

O corpus `scripts/testes/liga-quota-cases.mjs` é compartilhado entre fixtures operacionais e a nova suíte `validate-liga-quotas.mjs`. Com o laboratório autorizado e isolado disponível, usar bancos novos:

```powershell
node scripts/testes/postgres-inscricoes/build-schema.mjs
node scripts/testes/postgres-inscricoes/fresh-validation.mjs dropzone_validation_liga_fixed_20261011 --participation --slot-batch --group-choice
node scripts/testes/postgres-inscricoes/validate-participation.mjs dropzone_validation_liga_fixed_20261011 relatorios-testes/liga-sql-2026-10-11
node scripts/testes/postgres-inscricoes/validate-liga-quotas.mjs dropzone_validation_liga_fixed_20261011 relatorios-testes/liga-sql-2026-10-11
```

A nova suíte testa inclusão/aprovação, rollback de line/participação/espelho/agenda/recibos, última cota disputada por duas sessões e replay após mudança do plano. Preparação e sintaxe JavaScript não são prova de execução SQL. Repetir também as regressões nativas anteriores em bancos adequados e conferir staging/schema atual/owners/ACL antes de publicar. Não reusar o banco baseline da reprodução para certificar a versão corrigida.

### Execução manual escolhida pelo usuário

O usuário optou por executar os comandos locais. Na raiz `E:\dropzone-cadastros`, o controlador prepara todo o laboratório e as regressões:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\testes\postgres-inscricoes\run-liga-validation.ps1
```

O controlador usa somente o contexto local `desktop-linux` com endpoint `npipe:////./pipe/dockerDesktopLinuxEngine`, imagem PostgreSQL17.6 em cache (`--pull never`), rede none e nenhuma porta publicada. Recusa reutilizar/remover um contêiner preexistente com o nome do laboratório. Registra ID e label exclusivos, verifica ambos antes da limpeza e remove somente seu próprio contêiner/volumes anônimos. Não usa `docker prune`; conserva o cache da imagem e mantém Docker aberto se houver outros contêineres em execução.

Cada execução gera `relatorios-testes/liga-sql-exec-<UTC>-<sufixo>/`, com logs e `run-result.json`. Bancos separados para reprodução antiga, candidato corrigido, regressões e plano. Prevê324casos =59participação +91Liga +40batch +35escolha +33transferência +35convite +31plano; as reproduções anteriores são registradas separadamente. Qualquer falha interrompe as etapas seguintes e tenta a limpeza no finally, conservando logs; erro de identidade impede remoção.

`-CheckOnly` verifica arquivos, hashes e nomes sem iniciar Docker ou executar SQL. Esse modo e o parser PowerShell foram verificados localmente; **a execução completa do controlador e os324casos ainda não ocorreram**. O resultado não é certificação de staging, schema atual, Auth/PostgREST/Realtime/rede reais ou dispositivo. Os candidatos permanecem sem aplicação no Supabase e as flags legacy.

<!-- liga-native-readme-start -->
### Resultado atual da execução manual

As 324 verificações passaram. A primeira execução do controlador falhou apenas ao consolidar hashtables por Measure-Object no Windows PowerShell, depois das sete suítes. Soma corrigida por foreach; instruções reais testadas em PowerShell 5.1 e 7.6.5. Não reexecutar SQL só para essa correção. O run-result.json original false/zero foi preservado; conferir [resultado reconciliado](E:/dropzone-cadastros/relatorios-testes/liga-sql-validada-2026-10-11/reconciled-run-result.json). Contêiner/volume removidos e Docker encerrado. LG02 validado no candidato local; produção/staging/owners/ACL/QA integral permanecem pendentes. Seções anteriores sobre preparação/bloqueio descrevem fases históricas.
<!-- liga-native-readme-end -->
