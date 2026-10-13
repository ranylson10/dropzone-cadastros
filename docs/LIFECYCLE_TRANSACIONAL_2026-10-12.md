# Encerramento e reabertura transacionais — 12/10/2026

O candidato SQL e o cliente web estão preparados e validados localmente. A regra confirmada pelo usuário foi implementada: ao reabrir a edição, **todas as etapas e divisões encerradas ficam ativas**, as canceladas são preservadas e as inscrições continuam fechadas. A funcionalidade permanece indisponível com a configuração padrão `LIFECYCLE_WRITE_MODE=legacy`. O cliente mobile continua bloqueado; não foi feita ativação no Supabase, GitHub ou Vercel nesta etapa.

Este relatório sucede o [diagnóstico de contenção](E:/dropzone-cadastros/docs/LIFECYCLE_SEGURANCA_2026-10-12.md), cujas evidências permanecem históricas. A preparação desta operação não conclui a auditoria integral: os 26 achados originais continuam em 20 corrigidos e seis parciais. O [registro de fechamento](E:/dropzone-cadastros/docs/PENDENCIAS_FECHAMENTO_2026-10-12.md) contém o trabalho restante, sem estimativa de rodadas.

## Correção preparada

O [candidato](E:/dropzone-cadastros/docs/sql/20261012_lifecycle_candidate.sql) cria três tabelas privadas de versões, publicações e recibos, cinco funções e 13 guards nas tabelas relacionadas. O principal `fn_lifecycle_atomico` aceita conferência e aplicação de encerramento/reabertura. Somente o serviço pode executar esse principal; os helpers e a escrita direta nas tabelas privadas não ficam disponíveis aos clientes. O ensaio verificou RLS, grants e corpos exatos em catálogo sintético, sem certificar os owners/permissões reais do serviço gerenciado. A restrição explícita de execução acompanha a orientação oficial sobre [funções de banco no Supabase](https://supabase.com/docs/guides/database/functions).

- **LC01 — gravação parcial:** edição, etapas, divisões, fechamento das inscrições, imagem de publicação e recibo são gravados na mesma transação. Pós-condições verificam o resultado completo. Falhas tardias, inclusive no audit/recibo, desfazem o conjunto.
- **LC02 — conferência separada da gravação:** o banco calcula ranking e valida quedas/resultados/relacionamentos. A conferência devolve uma revisão e um hash; a aplicação exige a mesma imagem e plano. Guards incrementam a revisão e coordenam DML nas 13 tabelas, impedindo publicar com o plano invalidado por nova queda ou alteração concorrente.
- **LC03 — repetição sem recibo:** ator, UUID e intenção identificam a operação. O replay autorizado devolve o recibo original, inclusive após reabertura, sem repetir a gravação. A reabertura depende da imagem privada correspondente à publicação.

Os locks são ordenados e cooperam com os guards anteriores de temporada/edição/progressão. Inversões entre locks de linhas e advisory locks ainda podem abortar por deadlock; há uma repetição limitada com a mesma intenção, e falhas incertas preservam a tentativa original. Não há promessa de ausência de deadlocks. O comportamento de locks e rollback foi ensaiado e deve ser revisado no catálogo real, conforme a documentação de [locks PostgreSQL](https://www.postgresql.org/docs/17/explicit-locking.html) e de [visibilidade de alterações em triggers](https://www.postgresql.org/docs/17/trigger-datachanges.html).

## Cliente e contrato

A rota dedicada autentica e verifica gestão antes de ler a intenção. O caminho canônico despacha as quatro ações para o transporte atômico somente com a flag explícita; o escritor antigo permanece removido e não há fallback para ele. Respostas usam `no-store` e validam campeonato, ator, ação, UUID, revisão e status.

A interface web primeiro confere a operação no banco, mostra o resumo e exige confirmação do plano recebido. UUID e corpo são persistidos antes de enviar a mutação. Resposta perdida, timeout, recarga, downgrade da flag e desmontagem permitem recuperar a tentativa original. Conta/campeonato/epoch isolam consultas e callbacks, incluindo a troca A–B–A. Uma operação confirmada permanece confirmada se a recarga de leitura falhar. Descartar uma tentativa remove o registro local; não desfaz uma operação eventualmente confirmada no servidor.

A reabertura limpa o resultado final, torna a edição ativa e deixa sua data final nula. Todos os estados encerrados de etapas/divisões ficam ativos, mesmo os que já estavam encerrados antes da publicação. Estados cancelados permanecem cancelados. Metadados personalizados são preservados segundo a imagem validada; inscrições permanecem fechadas. A integração mobile dessa operação ainda está pendente, apesar dos tipos e contratos atuais aprovados.

## Evidência local

Os [logs e a verificação](E:/dropzone-cadastros/relatorios-testes/lifecycle-transacao-2026-10-12/final-verification.json) registram:

- **51 testes nativos, zero falhas**, em PostgreSQL 17.6 sintético: rollback, recibos, replay, mudanças concorrentes, revisão ABA, permissões, estados cancelados, Liga, Point Rush e Booyah Ouro padrão. Cinco casos comparam campeão e métricas de ranking com o serviço JavaScript real. Foram conferidos cinco corpos exatos, 13 guards habilitados e três tabelas privadas.
- **54 verificações HTTP/cliente:** handlers e SDK reais com Auth, respostas e armazenamento fictícios; sem chamadas ao projeto. Incluem autorização antes do corpo, contrato, UUID original, resposta perdida, timeout, duplicação e ausência de fallback.
- **76 testes runtime:** 16 do lifecycle atômico e regressões de contenção16, edição16, Diário16 e progressão12, em viewports desktop/mobile com tráfego interceptado. Isso não representa teste do aplicativo nativo ou QA completo do painel.
- **16 contratos estáticos** e **gate com 39 suítes**, tipos web/mobile, lint web/backend e build aprovados. Audits npm de produção root/web retornaram zero vulnerabilidades; isso não certifica dependências de desenvolvimento ou todos os aplicativos.

As falhas iniciais foram preservadas nos logs: fixtures de ordem única/produtora/configuração autoexistente; precedência de operadores JSONB corrigida no SQL; resolução de módulos no harness; erro antigo da interface que ocultava uma nova falha de retry; e build interrompido por `spawn EPERM`, retomado com execução local autorizada. As expectativas não foram enfraquecidas. O arquivo final SQL, após qualificar `extensions.digest`, passou novamente pelos 51 testes e pela conferência de integridade.

O laboratório usou imagem em cache, rede desativada, sem portas publicadas ou montagem do host, com dados fictícios. O contêiner e volume próprios foram removidos; Docker foi restaurado ao estado parado. Os 16 hashes SQL anteriores foram preservados. Agora existem **17 arquivos SQL datados: 16 candidatos de alteração e um preflight**, nenhum aplicado remotamente nesta etapa. HEAD permanece `ef9416e15643e38f70024be6ba7bc91a909794a8`.

## Limites e condição para ativação

- A reabertura recusa publicações históricas sem a imagem privada desta operação. Migrar/reconciliar esses históricos exige uma decisão e ensaio próprios.
- Qualquer mudança posterior na imagem/revisão protegida recusa a reabertura até reconciliação. O guard protege a operação concorrente; não congela todas as gravações depois do commit nem cria uma publicação pública imutável/MVP histórico.
- Booyah Ouro com `booyah_ouro_queda_minima` definido ou desempate diferente de `maior_pontuacao` é recusado antes da publicação. O resumo JavaScript atual não aplica esses campos; não foi inventada uma nova regra. A confirmação e implementação dessas variantes permanecem pendentes.
- A proteção ensaiada cobre DML ordinário nas 13 tabelas e os relacionamentos explicitamente conferidos. `TRUNCATE`, alterações administrativas, triggers desabilitados, todos os demais escritores e mudanças concorrentes no modelo de permissões não estão certificados.
- Os limites de tamanho/quantidade e timeouts recusam planos grandes; carga e contenção reais precisam de staging. O catálogo reconstruído não substitui backup/restauração, conferência de owners/ACLs, migration revisada, compatibilidade de clientes e rollout/rollback.
- Criação completa do campeonato, estrutura/atribuições, demais escritores e os seis parciais originais continuam no registro de fechamento. Não foi certificada a matriz integral de subpáginas, acessibilidade ou dispositivos.

Não houve SQL/MCP ao projeto, DDL/DML remoto, mudanças Auth/env, commit, push, PR ou deploy nesta continuação. O build normal pode ler diretório público/cache externo; esse tráfego de leitura não foi instrumentado. A configuração real de lifecycle foi conferida sem expor segredos e continua ausente/padrão legacy ou explicitamente legacy. Ativar a flag antes de aplicar e ensaiar o candidato não é uma liberação válida.
