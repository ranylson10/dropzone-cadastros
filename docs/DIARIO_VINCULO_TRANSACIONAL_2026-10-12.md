# Diário: vínculo de horário e grupo

12/10/2026, America/Sao_Paulo. Preparação local do fluxo identificado no bloco de gravações de estrutura. O candidato não foi aplicado no Supabase; `DAILY_GROUP_WRITE_MODE=legacy`. GitHub/Vercel continuam para a etapa posterior. O quadro dos 26 achados originais permanece em 20 corrigidos e seis parciais.

## Falha concreta e correção preparada

**DJ01/P2 — vínculo parcial e deslocamento incompleto.** A rota anterior desvinculava o grupo antigo, atribuía o horário ao novo grupo e atualizava o horário em três requisições. Quando o destino já pertencia a outro horário, a última gravação podia ser recusada pela unicidade publicada, depois das anteriores persistirem. O ensaio nativo reproduziu esse estado parcial usando os mesmos passos em dados fictícios, com as duas constraints únicas originais preservadas. Não é demonstração de incidente com usuários reais.

O [candidato](E:/dropzone-cadastros/docs/sql/20261012_daily_group_candidate.sql) grava os dois lados na mesma transação e primeiro desvincula o grupo anteriormente escolhido pelo horário e o horário anteriormente associado ao grupo. O novo par fica ligado; os dois registros deslocados ficam sem vínculo. Não realiza uma troca automática entre os registros restantes. A interface informa esse resultado e exige confirmação.

**DJ02/P2 — grupos indisponíveis sem edição histórica.** O leitor retornava `groups=[]` quando não havia edição, embora ainda retornasse os horários do Diário. Agora carrega grupos paginados e filtrados pelo campeonato também nessa condição. Grupos incluem `updated_at` nos dois caminhos do leitor, necessário à conferência do estado apresentado. Foram adicionados checks de paginação, falha em página seguinte e resposta estrangeira sem edição. O leitor comum ainda usa consultas separadas; não é uma prévia transacional.

O código local recusa o vínculo legado com **HTTP 503** enquanto o modo atômico não estiver ativado. Publicar sem preparar o banco e a flag suspenderia essa vinculação. Criação e exclusão de horários, demais relações, edição/franquia, atribuição de equipes e demais writers conservam seus caminhos atuais e continuam no fechamento geral. Nada foi alterado no serviço publicado nesta continuação.

## Banco e autorização

A RPC exige o papel de backend e gerenciamento do campeonato, verifica que o tipo é Diário e que horário e grupo pertencem ao recurso. Compara todos os vínculos/versões de grupos e horários com o snapshot apresentado. Vínculos antigos inconsistentes são recusados para reconciliação explícita, sem tentar adivinhar o estado correto. Limites: 2.000 grupos, 2.000 horários e corpo de até 4 MiB. Excesso falha explicitamente.

O snapshot projeta somente IDs, campeonato, vínculos e versões. Timestamps equivalentes são normalizados pelo PostgreSQL sem perder os microssegundos; o checksum do armazenamento conserva o corpo original. Valores arbitrários de configuração e credenciais não entram no recibo. O recibo privado armazena snapshots anterior/posterior e a resposta, vinculado à conta, UUID, campeonato e conteúdo. Não há API de reversão neste candidato. Repetição consulta o recibo antes de recalcular o estado e não sobrescreve uma alteração posterior. A permissão é exigida novamente no replay.

Dois guards em grupos e horários coordenam DML por campeonato, incluindo OLD/NEW ao mover o recurso. Inserções comuns de grupo e horário foram observadas esperando locks advisory da RPC. Snapshot, desvinculações, novo par e recibo pertencem à mesma transação. Uma falha tardia, inclusive após desfazer o primeiro vínculo, mantém todas as linhas, versões e efeitos fictícios de Realtime iguais ao estado anterior.

Após o recibo, a RPC confere novamente os vínculos projetados e a permissão. O teste de alteração posterior ao recibo desfaz um dos lados do novo par e confirma rollback completo. Uma primeira fixture alterava somente o nome de outro grupo dentro da mesma transação; `updated_at=now()` permanece igual nessa situação, e nomes não fazem parte dessa pós-condição. A fixture foi corrigida para testar uma alteração estrutural. Não se afirma detecção de todo metadado modificado internamente nem revisão monotônica para todas as alterações A–B–A.

Deadlocks continuam possíveis na combinação com outros escritores/gatilhos; não foi reproduzido um deadlock específico. O timeout de lock é três segundos; o transporte repete somente `40P01` uma vez, com os mesmos argumentos. Co-instalação com os candidatos de temporada e progressão foi conferida, sem executar integralmente suas suítes nativas anteriores. Não certifica coordenação de todos os escritores, reparenting, permissões concorrentes ou infraestrutura real.

A tabela de recibos tem RLS e não permite acesso dos clientes. O backend pode ler recibos e executar a RPC principal; não faz DML direto nessa tabela nem chama os helpers. As quatro funções privilegiadas têm `search_path` fixo e EXECUTE explicitamente revogado de PUBLIC/anon/authenticated/service_role, com liberação somente da RPC principal ao backend. Dependência funcional: helper de permissões candidato revisado. Antes de ativar, revisar owners/ACL, advisors, schema cache e HTTP/PostgREST real em staging. Referências: [funções e privilégios](https://supabase.com/docs/guides/database/functions), [segurança da API](https://supabase.com/docs/guides/api/securing-your-api).

## Interface e recuperação

O [painel separado](E:/dropzone-cadastros/web/features/campeonatos/estrutura-avancada/DailyGroupPanel.tsx) mostra a seleção e confirma o snapshot apresentado. UUID e corpo são guardados antes do HTTP. Há verificação de sessão e revisão de conta/recurso/desmontagem antes do envio e depois da confirmação. Troca A–B–A invalida a confirmação antiga; dados da conta anterior são ocultados. A URL dedicada `/estrutura-avancada/horario-grupo-atomico` recusa flag desativada, corpo incompatível e RPC ausente, sem encaminhar ao legado. A URL canônica também usa o transporte atômico ou recusa o vínculo.

Resposta perdida, timeout, resposta inválida ou flag desativada conserva a tentativa original. Repetir usa a mesma URL, UUID e corpo, mesmo quando o GET volta a informar legacy. Falha de armazenamento impede o envio. Encerrar a tentativa local exige confirmação após conferir a estrutura e não desfaz o servidor. Edição/exclusão no painel de horários fica bloqueada enquanto sua tentativa está pendente. Isso não garante bloqueio recíproco por outros painéis, famílias, abas ou clientes antigos; a trava compartilhada cobre operações simultâneas neste runtime.

O transporte limita a RPC a 20 segundos e o cliente limita o HTTP a 30 segundos. Timeout não presume rollback. Confirmação conhecida continua confirmada se a recarga da estrutura falhar. SessionStorage pertence à conta/campeonato e à aba, contém snapshots sem credenciais; checksum não protege contra código malicioso na mesma origem. Fechar a aba ou limpar o armazenamento perde a recuperação local. Retenção, reconciliação e recuperação operacional dos recibos continuam pendentes.

## Evidências e cobertura

- 24 cenários nativos aprovados em PostgreSQL 17.6 reconstruído, com instalação final em banco novo: reprodução da falha antiga, vínculo novo, deslocamento dos dois pares, operação sem mudança, replay após nova alteração, UUID com outro conteúdo, versões obsoletas, recurso estrangeiro, autorização, reconciliação, falhas tardias, alteração estrutural após recibo, ACL e sessões concorrentes.
- Quatro corpos compilados iguais ao SQL final, dois guards habilitados e ACLs privadas conferidas. Os 14 hashes SQL anteriores permanecem iguais; novo total: 14 candidatos de alteração e um preflight, sem aplicação remota.
- 38 checks HTTP/cliente aprovados, com SDK Supabase e handlers Next reais em HTTP/armazenamento/Auth fictícios. Incluem erro privado, deadlock abortado repetido, resposta perdida, corrupção, falha de persistência/remoção, mudança de sessão/revisão, timeout e concorrência no runtime.
- Leitor: 125 checks permanentes e três reproduções históricas aprovados; três novos checks cobrem grupos sem edição. O catálogo salvo confirmou o campo `updated_at`; não houve consulta ao projeto remoto nesta continuação.
- 28 cenários de navegador aprovados: 16 do vínculo Diário e 12 de regressão de progressão, em desktop/viewport móvel. Componentes/hooks reais, Auth/HTTP/feedback/campo Select e serviço de recarga adaptados. Não é QA visual integral, dispositivo físico ou site publicado.
- 14 contratos estáticos aprovados: cinco do vínculo, cinco da temporada e quatro de progressão/histórico. Conferência de código não equivale a interação visual.
- Gate completo aprovado: 36 suítes de segurança/contratos, tipos web, lint web/backend, build e auditoria npm de produção com zero vulnerabilidades. Auditorias completas de desenvolvimento/mobile/desktop e QA físico não foram repetidos.

O catálogo público salvo contém 118 tabelas e 14 views; corpos históricos foram conferidos com os MD5 atuais salvos. Auth/JWT/Realtime são fictícios, e owners/ACL reais não foram clonados integralmente. Não é backup completo nem staging Supabase. Os 324 nativos anteriores, 53 de progressão e 35 de temporada permanecem históricos neste ensaio; não foram integralmente repetidos.

Falhas iniciais preservadas: ambiguidade entre variável e alias SQL, corrigida; expectativa de mensagem de armazenamento, ajustada após explicitar leitura da tentativa; fixture de pós-condição que alterava nome em vez de vínculo, substituída por alteração estrutural. Constraints e gatilhos publicados não foram relaxados. O laboratório e seu volume próprios foram removidos; Docker restaurado parado. Manifest anterior é histórico e não foi regravado para esconder alterações posteriores nos arquivos compartilhados.

[Evidências finais](E:/dropzone-cadastros/relatorios-testes/diario-vinculo-2026-10-12/final-verification.json) · [Pendências do projeto](E:/dropzone-cadastros/docs/PENDENCIAS_FECHAMENTO_2026-10-12.md). A preparação deste fluxo não encerra o bloco de gravações de estrutura, os seis parciais, staging ou QA integral.
