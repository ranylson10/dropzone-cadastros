# Histórico de alterações

<!-- slot-batch-changelog-start -->
## 2026-10-11 — Sorteio/distribuição com reservas preservadas (preparado)

- Décimo candidato SQL/uma RPC e dispatcher local para shuffle/distribute, snapshot completo/locks/fase pai/replay; flags legacy.
- BATCH01/P1 reproduzido sinteticamente: broad clear destrói reservas; candidato preserva reservas, recusa estado alterado e reverte tudo em falha. Não aplicado no Supabase.
- 174 nativos, 68 fixtures, gate23/tipos/lint/build/npmprod0, auditor108OK/3avisos/0erros. Sem nova UI/browser/device. Consumidores batch órfãos não atualizados; demais inscrições/writers/contratos/staging pendentes.
- Laboratório/volume removidos/Docker parado. GitHub/Vercel não alterados. Evidências relatorios-testes/distribuicao-atomica-2026-10-11/.
<!-- slot-batch-changelog-end -->

## 2026-10-11 — Escolha de grupo e isolamento da estrutura

- Escolher/cancelar/restaurar equipe/admin em RPC opt-in; regras de propriedade/janela/bloqueio, histórico/notificação/recibo atômicos. Restauração da equipe respeita bloqueio e cancelamento exato; admin mantém janela excepcional. Flag legacy e nove SQLs não aplicados.
- Duas interfaces web usam intenção/UUID persistidos antes do envio, retomada após recarga, isolamento por conta e confirmação/descarte local explícitos.
- STR01/P1 corrigido localmente: exclusão de nove tabelas, criação/vínculos/franquia limitados ao campeonato/pais; normalização da ação não contorna escopo. Reparenting e demais writers continuam pendentes.
- 134 nativos, 125 fixtures, 24 browser, gate22/tipos/lint/build/npmprod0; auditor rápido108OK/3avisos/0erros. Realtime apenas fixture transacional, sem entrega real. Laboratório/volume removidos, Docker parado. Sem commit/push/PR/deploy. Evidências relatorios-testes/escolha-atomica-2026-10-11/.


## 2026-10-11 — Move/swap e permissões preparados, sem ativação

- Permissões JSON concedem somente booleano true; paginação e ordem conservam precedência, helper SQL ensaiado contra backend.
- Move/swap opt-in com uma RPC, ocupantes esperados e erro/DTO sanitizados; app ativo persiste intenção/chave e confirma resultado após recarga. SLOT_MOVEMENT_MODE legacy; demais escritores/contratos pendentes.
- 99 casos nativos (31+33+35), 85 fixtures (45+17+23), 24 browser (10 novos+14 regressões), gate19/tipos/lint/build/npm produção zero, mobile tipos/export JS Android. Auditor rápido108OK/3avisos/0erros; sem certificação nativa.
- Oito SQLs candidatos não aplicados, DBR01/P1 e DBR02/P2 publicados, seis parciais mantidos. Laboratório/volume removidos, Docker parado. Nota registra dois JSONs antigos substituídos pelo primeiro rerun; logs históricos preservados, pasta explícita corrigida. Sem commit/push/PR/deploy. Evidências relatorios-testes/movimento-rpc-2026-10-11/.


## 2026-10-11 — Movimentações de slots: revisão nativa e base transacional

- Escolha de grupo: datas/janela invertida bloqueiam; leitura/escrita compartilham regra, todas as respostas no-store e erros DB sanitizados. 36fixtures/16suites/gate tipos/lint/build/npmprod0.
- Cinco padrões legados reproduzidos com catálogo fictício nativo; writers atuais continuam pendentes. Candidato de plano owner-only sem HTTP/ativação, snapshot/locks/tuple detach, histórico/agenda/recibo em uma transação; 31cenários+35regressõesinscrição=66nativos finais.
- Inventário ampliado 294sources/178literalwrites/35files/7dynamic/13functions, inclui18tables e nome produtora_membros corrigido; não comparar diretamente com inventário anterior. Auditor rápido108OK/3avisos/0erros (doisCSS+build pulado no auditor; gate buildpass).
- SQL/staging/perms/contratos/locks/DBR01/02 e seisparciais continuam pendentes; defaultlegacy/sem SupabasewritesDDL/commitpushPRdeploy. Evidências relatorios-testes/movimentacoes-2026-10-11/.


## 2026-10-11 — Integração de inscrição preparada e desativada

- Backend opt-in atomic com ator autenticado, uma RPC, UUID/DTO validados e erros sanitizados; nenhuma fallback multi-write após erro. Default legacy, nenhum ambiente ativado.
- Web e app persistem digest/UUID antes do POST; mesma tentativa mantém chave em falha/recarga, sucesso confirmado retira. Lili encaminha a chave e oferece retry na mensagem mais recente; app serializa preparação e bloqueia clique duplo. Equipe selecionada enviada no convite e token percentual literal preservado.
- 15 suítes/gate, 72 cenários de fixtures da integração, 42 browser desktop/celular, tipos móveis e exportação JS Android. Primeiro teste da Lili revelou ação desabilitada após erro; corrigido/repetido. Geral 107 OK/2 avisos/0 erros, produção npm zero.
- Inventário estático: 144 gravações literais/30 arquivos, sete alvos dinâmicos, 12 funções no catálogo antigo. Staging/dump atual, movimentos administrativos/locks/rollback, DBR01/02, reservas/pagamentos, QA nativo e seis parciais continuam pendentes. Sem Supabase writes/DDL, commit/push/PR/deploy. Evidências relatorios-testes/rpc-inscricoes-2026-10-11/.

## 2026-10-11 — PostgreSQL de inscrições e fechamento/prazo

- Regra confirmada: convites equipe/grupo respeitam prazo e fechamento; GET acompanha, POST recusa, erro de leitura/prazo inválido não liberam inscrição. GET equipe confere No Ar.
- Cinco SQLs candidatos e harness PostgreSQL17.6: 118 tabelas/818 constraints/74 funções/76 gatilhos reconstruídos, sem equivalência a dump completo/atual. Transferência legítima corrigida no candidato.
- 35 casos nativos/concorrência real seis sessões/quota2 aceita2 de6, rollback, recibos, prazo durante espera e metadata552726bytes/301→302hist. Volume repetido após fixture corrigida. Preflight e rollback guardado validados; preservam rows.
- 12 suítes/gate tipos/lint/build/auditprod0; 28 browser (8novos policy+20regressões). 4 HEADs reais/zero writes; browser não respondeu para novo catálogo.
- DBR01/P1, DBR02/P2, dump/preflight staging atual e integração RPC/idempotência ainda pendentes; seis parciais originais preservados. Nenhuma DDL pública, commit, push, PR ou deploy. Evidências relatorios-testes/banco-inscricoes-2026-10-11/.

## 2026-10-11 — Convite de grupo e contador protegido

- Rota 1.232 → 43 linhas, quatro serviços backend, grade compartilhada sem repetição e POST sem rosters. GET sem heal, paginação completa/IN150, escopo e pai público, token literal/legado, erros sanitizados/no-store.
- Contador com versão/recibo/revisão, compensação que preserva alterações posteriores, histórico e fechamento CAS; permissões de staff/capacidade privada e line válida antes do consumo. Inscrição end-to-end ainda pendente.
- UI de permissões/carga/erro/clique duplo e cabeçalho; Lili não cobre a confirmação em seis medições 1440/390/320, contraste do título 16.18:1. Duas falhas mobile iniciais corrigidas.
- Doze suítes/gate, tipos/lint/build final, npm produção zero, auditoria 107 OK/2 avisos/0 erros e 40 casos de navegador. Fixture cap7/601 lines/301 slots/1.203 jogadores; seis pedidos simulados/duas vagas/duas aceitações. 4 GETs reais/zero gravações; nenhum convite existente na amostra.
- DBR01/P1, DBR02/P2, transação/concorrência/staging, componente de grupo grande e QA completo permanecem pendentes. Sem alteração permanente de banco, commit, push ou deploy. Evidências relatorios-testes/convite-grupo-2026-10-11/.


## 2026-10-11 — Permissões de convite e compensação de inscrição

- Convite de equipe extraído para leitura/disponibilidade/aceite backend; permissão de staff validada em equipe/grupo. Compensação confere participação esperada e condiciona espelho a escopo/ocupante; slot inválido e token revogado/expirado recusados.
- Paginação completa/IN150/erros explícitos; interface cancela cargas, oferece nova tentativa e bloqueia clique duplo. Cabeçalho visível, altura por conteúdo e Lili sem cobrir ações mobile, contraste de título 15.22:1 em seis medições.
- Onze suítes/gate, build/lint após CSS, produção npm zerada e auditoria 107 OK/2 avisos/0 erros. 30 casos ao final; um timeout de conexão em perfil foi repetido isoladamente. 13 GETs reais/zero gravações; sete cenários PostgreSQL temporário + rollback, sem alteração pública.
- Novas pendências: gatilho público DBR01/P1 e índice global de line DBR02/P2. SQL de gatilho preparado, não aplicado; staging de esquema completo e transação end-to-end pendentes. 20 corrigidos/seis parciais originais mantidos, mais duas pendências adicionais; sem commit/push/deploy. Evidências relatorios-testes/inscricoes-2026-10-11/.

## 2026-10-11 — Ranking publicado e desempenho completo

- Ranking e Garena respeitam visibilidade e publicação por queda; páginas completas, ordem estável, IN até 150 e erros propagados. Fórmula pura/leituras/perfis separados no backend.
- Perfis abaixo do Top 100 recebem score/totais do grafo completo; API preserva 100 por categoria, no-store e mensagem genérica. Cache versionado e ligado à tag de campeonatos.
- Dialog compartilhado com Escape/foco/rolagem, CSS Module local e fechar/link 44 px; contraste de título 12.18:1/rótulos 8.13:1 em 18 medições, com estatísticas expandidas.
- 301 campeonatos/participantes/jogadores, 1.204 quedas/1.203 resultados/cap sete; paridade completa do Top 100 publicado com a versão anterior. Dez suítes, tipos, lint, build, produção npm zerada; auditoria geral 107 OK/2 avisos/zero erros.
- 74 Playwright: 22 navegações, dois GET HTTP e 50 estáticos/modelos. Ranking oito capturas, perfis dez e estatísticas oito; 27+1 GETs reais, zero gravações.
- Demais agregados, custo sob carga/cache, relações repetidas, painéis/convites grandes, CSS/QA nativo/concorrência continuam parciais. Sem commit/push/deploy. Evidências em relatorios-testes/ranking-2026-10-11/.

## 2026-10-11 — Estatísticas completas e publicação pública

- Leituras/agrupamento de estatísticas separados das operações de pontuação. Equipes/MVP, Garena oficial, publicação, lines/importações, final/bônus/Booyah Ouro e súmula paginados; ordenação por resultado_id nas views, IN até 150.
- Perfil inicial respeita resultados publicados e conserva todos os participantes. Falhas propagadas; visibilidade pública compartilhada conferida antes das relações. Delay ausente/inválido usa cinco minutos, zero explícito mantém imediato.
- Rótulos dos filtros de Tabela/MVP legíveis no fundo azul em CSS Module local; contraste mínimo medido 6.26:1, sem certificação integral.
- Fixtures de 1.203 detalhes/301 participantes e cap sete; final aberta, Booyah Ouro na queda 301, bônus tardio e falhas em páginas posteriores verificados. Nove suítes, tipos, lint, build, produção npm zerada; R11 estático aprovado.
- 66 casos Playwright: 14 navegações reais, dois GET HTTP e 50 estáticos/modelos. Estatísticas: 12 medições/oito capturas, mais 30/dez nos perfis repetidos. Banco: 14+2 GETs, zero gravações; 10 equipes/40 jogadores publicados e views anônimas sem linhas na amostra. Auditoria geral 107 OK/2 avisos/zero erros.
- Agregados/ranking global, relações repetidas, módulos grandes, CSS, QA nativo e concorrência continuam parciais. Sem commit/push/deploy. Evidências em relatorios-testes/estatisticas-2026-10-11/.

## 2026-10-11 — Perfis públicos por ID e layout localizado

- Cinco perfis deixam de carregar o diretório inteiro para obter a base: consulta por ID no backend, visibilidade antes das relações, UUID normalizado e projeções públicas. Cache de 30 segundos preservado; identificador de autenticação interno fora do DTO.
- CSS Modules locais separam rótulo/valor nas médias, corrigem dois títulos sobre fundo escuro e afastam a Lili da barra de compra mobile.
- Oito suítes de segurança, tipos, lint, build e produção npm zerada; 12 casos de navegação real + 24 regressões estáticas/modelos, 30 medições responsivas e dez capturas. Auditoria geral 107 OK/2 avisos/zero erros.
- Fixtures: 1.203 pais por tipo, 601 lines e cap sete; cinco DTOs completos preservados na comparação com a versão anterior. 31 GETs reais/zero gravações. A01/A03/L03 parciais: agregados, ranking/estatísticas, módulos grandes e acessibilidade integral ainda pendentes. Nenhum commit/push/deploy. Evidências em relatorios-testes/perfis-2026-10-11/.

## 2026-10-11 — Conferência de publicação por leitura

- Vercel conferida por leitura: Root Directory web, Node 24.x; última produção listada Ready de 25/09. Main remota coincide com ef9416e1; GitHub Actions não retornou execuções recentes. Valores de ambiente não lidos; PayPal/assinatura de cotação precisam de configuração sandbox para preview. Sem alteração remota. Evidência: relatorios-testes/consumidores-2026-10-11/publication-preflight.json.

## 2026-10-11 — Consumidores móveis e catálogo público

- Busca global usa páginas de 20 por categoria; transferência de line e inscrição de campeonato usam páginas de 30 somente na área aberta. Continuação, nova tentativa e descarte/cancelamento por recurso e sessão compartilhados.
- Catálogo público de campeonatos extraído para backend; busca por nome/tipo/plataforma/servidor antes da página e relações limitadas aos IDs dela, em lotes de 150. Clientes antigos mantêm o contrato dos 500 mais recentes.
- Preço móvel ausente/inválido: Sob consulta; só zero explícito: Grátis. Prêmio ausente/zero: Sem premiação informada. Formatador compartilhado e regressões do DTO verificados nesta continuação.
- Timeout móvel continua funcionando com signal externo e durante o corpo JSON. Hubs antigos da Lili confirmados sem referências ativas, preservados para revisão.
- Passaram 14 testes de comportamento móvel com DOM adaptado, 16 regressões web, sete suítes de segurança, tipos, lint, build e produção npm zerada. Auditoria geral: 107 OK, dois avisos CSS, zero erros; typecheck e exportação JS Android aprovados.
- Fixture: 950 campeonatos públicos/32 páginas, cap 7 e relações sem truncamento; 49 GETs do serviço real e 11 GETs locais sem gravação. QA em dispositivo, listas agregadas/demais catálogos e atomicidade de inscrição seguem pendentes. A03 parcial; sem commit/push/deploy.

## 2026-10-11 — Buscas e seletores paginados

- Quatro rotas de busca delegam regras ao backend; paginação por nome/id, validação de cursor/limites e texto reservado citado. Autorização do campeonato ocorre antes das consultas; relações em lotes de até 150.
- Corrigida a consulta de jogadores que referenciava nick/foto_url/public_id inexistentes no esquema confirmado; DTO mantém os aliases de nome/avatar.
- Cinco seletores web usam páginas de 30 e continuação; seleção em lote preserva lines ao trocar a busca e aceita ID sem filtro local que esconda o resultado. Respostas antigas descartadas e falhas permitem repetição do cursor.
- Diretórios móveis de equipes/jogadores usam busca de servidor com páginas de 50; consulta privada de equipes geridas separada. Primeiro lote legado preservado para apps já instalados.
- Corrigido título do jogador no cabeçalho branco, com estilo local. Seleção em lote mobile mostra equipe e line em linhas separadas, sem rolagem lateral interna. Passaram 16 testes de navegador, casos de serviço com 1.093 equipes ativas e 601 lines, leitura real e 19 GETs locais sem gravação. Segurança, tipos, lint, build e produção npm zerada; typecheck móvel/exportação JS Android aprovados.
- A03 permanece parcial: listas agregadas/demais catálogos, busca global/lines móveis, consumidores da Lili e custo das áreas especializadas ainda precisam de continuidade. Sem commit, push ou deploy. Evidências em relatorios-testes/paginacao-2026-10-11 e relatório de correções atualizado.

## 2026-10-11 — Workspace da produtora: carregamento por área

- Carga inicial da produtora reduzida de 12 tipos de entidade para somente campeonatos; detalhes usam a área e o campeonato selecionados. Componentes com API própria não recebem o agregado redundante.
- Resumo e indicadores usam contagens HEAD com IDs autorizados, lotes de até 150 e falhas explícitas. A faixa da conta exibe campeonatos aprovados/em aprovação, em vez de contagens de dados que não foram carregados.
- Nove componentes especializados e mapas carregados sob demanda. Pagamentos/lifecycle não são consultados no resumo inicial; financeiro só é consultado na área correspondente.
- Controle de requisições vinculado à conta/área: respostas antigas descartadas, nova tentativa em erros e campeonato inicializado antes dos detalhes dos atalhos da Lili.
- Ajustes de legibilidade e faixa da conta isolados em `workspace.module.css`: título sobre fundo escuro, navegação inativa e nome sem sobrepor o botão de editar perfil. Oito capturas finais em 320/390/768/1440 px passaram, com botão mobile de 44 × 44 px; build repetido após o CSS.
- Oito testes Playwright desktop/celular passaram, incluindo troca rápida, falha/nova tentativa, atalhos e quatro larguras. Contagens reais do Supabase coincidiram com IDs paginados, sem gravação. Segurança, tipos, lint web/backend, build e auditoria online de produção passaram.
- Cursor nas listas, componentes grandes, CSS global e QA/dependências nativos continuam pendentes. Sem commit, push ou deploy; relatório em `CORRECOES_AUDITORIA_2026-10-11.md`.

## 2026-10-11 — Continuação: Lili, leituras privadas e legibilidade

- Atendimento da Lili extraído para serviços de backend: 88 comandos em 19 handlers, rota de 14 linhas, ferramentas e helpers separados. Passaram 356 comparações controladas com o comportamento anterior.
- Chamadas internas da Lili validam a origem configurada antes de repassar sessão, recusam redirects e limitam a espera. Testes incluem origem forjada e acesso sem autenticação.
- Escopo de leituras privadas aplicado antes da paginação; consultas isoladas por entidade, vínculos de staff paginados e filtros IN em lotes. A home solicita tipos por perfil e o seletor público não expõe UUID do dono de outra equipe.
- Normalizadas fontes abaixo de 12 px em 31 folhas, valores inline, avatar e rótulos administrativos. Chat com 148 regras em CSS Module, controles de 44 px e envio/foco corrigidos para 320 px.
- Validadas 86 aberturas públicas e 111 estados de abas dos cinco perfis: sem texto visível abaixo de 12 px, overflow ou erro JS nos cenários observados. Lint cobre web e backend; segurança, tipos, build e auditoria online de produção passaram.
- Permanecem seis achados parciais: painéis/convites grandes, cascata global, carregamento por aba/cursor e dependências/QA nativos. Sem commit, push ou deploy. Relatório e matriz atualizados em `CORRECOES_AUDITORIA_2026-10-11.md` e `VALIDACAO_ROTAS_2026-10-11.csv`.

## 2026-10-11 — Correções da auditoria completa (verificadas localmente)

- Restringidos grants de colunas privadas e tokens no Supabase; ativada a proteção contra senhas vazadas. Histórico local/remoto reconciliado: 28 migrations.
- PayPal valida preço, moeda, cotação, proprietário e referência na criação/captura/webhook; proxy de imagens bloqueia origens/redes privadas e limita DNS, redirects, tempo e bytes.
- Next.js atualizado para 16.3.8, produção web sem vulnerabilidades. Expo/Electron e transitivas compatíveis atualizados; ferramental e QA nativo ainda têm pendências.
- Catálogo padrão migrou para ChampionshipListRow; corrigidos categorias, preço desconhecido, CTA, busca, login, fluxos por token, isolamento OBS e main aninhado.
- API genérica extraída para serviços no backend; paginação elimina cortes silenciosos nas consultas corrigidas. Removidos resíduos do catálogo e cópias órfãs, com arquivo reversível nas evidências.
- Segurança, typecheck, lint, build e audit de produção passaram; 15 auditorias acumuladas, 18 verificações do catálogo e 44 testes Playwright aprovados. Repetidas 86 aberturas públicas e 111 estados autenticados.
- Adicionados gates de publicação e workflow de qualidade. Nenhum commit, push ou deploy nesta rodada; detalhes e seis achados parciais em `CORRECOES_AUDITORIA_2026-10-11.md`.

## 2026-10-06 — R206 — Limpeza estrutural

- Removido CSS morto das navegações anteriores de Produtora, Equipe, Jogador e Manager após a adoção do `WorkspaceShell`.
- Removido CSS dos cards de campeonato antigos (`championship-poster-card` e `directory-champ-*`), mantendo somente o grid do diretório e o `ChampionshipCard` canônico.
- Atualizado o baseline da auditoria de cascata para não proteger seletores legados já removidos.
- Criada `audit:structural-cleanup` para impedir o retorno desses resíduos.
- Criado teste controlado `rodada-206-structural-cleanup.spec.ts` para validar card global, workspace e overflow após a limpeza.

## 2026-07-29 — Ranking, convites e navegação rápida

- Navegação mobile da Lili abreviada para `Lili`, `Camp.`, `Equipes`, `Players` e `Rank`.
- Criado ranking global de equipes por pontos/BOOYAH/abates e de jogadores por abates/dano.
- Ranking disponível na Lili e na página `/rank` do site.
- Equipes podem buscar e convidar diretamente jogadores; jogadores podem buscar equipes e solicitar entrada.
- Convites e pedidos chegam ao correio, com aceite e recusa protegidos no backend.
- Solicitações duplicadas e aceite repetido são bloqueados.
- Fluxos estão disponíveis tanto na Lili quanto nos painéis de equipe e jogador do site.
- Alterações avançadas direcionam da Lili para a seção correspondente no painel completo.

## 2026-07-29 — Lili em modo de acompanhamento

- Participantes podem consultar fases, grupos, equipes, calendário e mapas sem receber permissão de edição.
- Campeonatos ativos e aprovados permitem a mesma leitura para usuários autenticados em modo espectador.
- A aba separada de jogos foi removida da Lili; datas, horários e mapas agora aparecem dentro do grupo selecionado.
- A data do grupo é derivada de `data_jogo` e `horario` dos jogos associados ao grupo.
- Controles de links e configuração continuam exclusivos para perfis com as permissões administrativas correspondentes.

## 2026-07-28 — Logout completo e troca de conta

- Retorno do login social agora reconhece `cadastro` para todos os cinco tipos de perfil; uma conta sem perfil abre diretamente o formulário solicitado.
- A consulta de perfis da conta possui limite de tempo e não deixa a seleção de acesso carregando indefinidamente.
- Logout passou a revogar globalmente a sessão Supabase.
- Perfis recentes, perfil ativo, snapshots de painel e estado OAuth são removidos ao sair.
- A limpeza é repetida após o evento de logout para impedir restauração por listeners.
- “Usar outra conta” e `?switch=1` usam o mesmo fluxo centralizado.
- Login Google mantém `prompt=select_account` para impedir reutilização silenciosa da conta anterior.
- Cartões “Quem vai entrar?” não aguardam mais `getSession()` indefinidamente; timeout segue para o login social.
- Logout global também possui timeout e sempre libera a interface após limpar o estado local.
- `npm run typecheck` e `npm run build`: aprovados.

## 2026-07-22 — Criação de perfis e uploads

- Corrigido upload de foto/logo antes da criação de perfil vinculado.
- Corrigido upload de logo/banner antes da criação de campeonato por produtora aprovada.
- Aplicada unicidade por `auth_user_id` em cada tabela de perfil: um login pode ter tipos diferentes, mas nunca dois perfis do mesmo tipo.
- Cadastro de equipe agora é revertido se a line principal não puder ser criada.
- Códigos de verificação passaram a ser consumidos atomicamente e vinculados ao tipo/username do cadastro.
- Adicionado limite de reenvio: um código por minuto e cinco por hora para e-mail/finalidade.
- Broadcast incluído no check de tipos aceitos pela tabela de códigos.
- Aprovação de produtora/campeonato passou a falhar fechada quando schema ou status estiver ausente.
- Migration `20260722_perfil_unico_por_tipo.sql` aplicada no Supabase.
- `npm run typecheck`, `npm run build`, auditoria de banco e 45 validações de fluxo aprovados.

## 2026-07-21 — Segurança financeira e uploads

- Webhook ASAAS agora exige `ASAAS_WEBHOOK_TOKEN` e confirma o pagamento diretamente na API ASAAS.
- Removido fallback que aceitava o payload do webhook quando a consulta externa falhava.
- Pagamento de inscrição passou a validar dono/staff da equipe ou organizador autorizado.
- Comissão não aceita mais IDs de vendedor enviados pelo navegador; origem é resolvida no backend.
- Criadas RPCs transacionais para crédito, solicitação de saque e mudança de status do saque.
- Saldo, lançamento e saque agora são confirmados ou revertidos na mesma transação.
- Estados finais de saque (`pago`, `rejeitado`, `cancelado`) ficaram imutáveis.
- Uploads de equipe e campeonato passaram a validar vínculos e permissões reais no backend.
- `npm run typecheck`: aprovado.

## 2026-07-16 — Fluxo de convites de equipes reorganizado

- Link de grupo: nome interno, limite = vagas livres, equipes esperadas opcionais (textarea).
- Convidado não escolhe referência da lista; match automático no backend.
- Auto-slot no aceite; steps de inscrição enxutos (login → equipe se preciso → line → confirmar).
- Token indisponível → acompanhamento público (slots + line/jogadores + CTA).
- Skip de “confirmar equipe” quando o login acontece dentro do fluxo.
- Soft-delete de links (`deleted_at` + `closed_reason: excluido`).
- Consumo atômico de vagas via RPC `fn_consumir_vaga_link_grupo` (migration `20260716_…`).
- Convite único (`/convite/equipe`) alinhado ao mesmo padrão de UX.
- Doc: `docs/FLUXO_CONVITES_EQUIPES.md`.
- UI admin: filtros por status e resumo de links.

## 10 de julho de 2026 — Fundação da nova arquitetura

### Alterado

- criado `backend/` para regras de servidor;
- movida aplicação Next.js para `web/`;
- criada pasta `app/` para aplicativo futuro;
- movidos scripts SQL para `database/supabase/`;
- criadas estruturas de formulários reutilizáveis;
- criadas estruturas de produtoras, equipes, jogadores, managers e campeonatos;
- criadas áreas de fases, grupos e jogos;
- ajustados aliases TypeScript;
- criados documentos permanentes do projeto.

### Mantido temporariamente

- painel legado em `web/features/dropzone`;
- API genérica em `web/app/api/dropzone/route.ts`;
- route handlers dentro do Next.js.

### Próximo

- validar build;
- extrair formulário de campeonato;
- extrair formulário de equipe;
- criar gerenciamento de fases/grupos/jogos;
- automatizar slots no backend.

## 2026-07-10 — Cabeçalho global e faixa visual dos painéis

- Criado `web/components/layout/AppHeader.tsx`.
- Criado `web/components/layout/PanelHero.tsx`.
- Adicionado menu superior com logo DropZone, navegação principal e perfil do usuário.
- Movida a ação de sair para o menu do perfil.
- Adicionada faixa visual com textura, título, descrição, imagem do perfil e ação de atualização.
- Aplicado o novo layout aos painéis de produtora, equipe, jogador e manager por meio do componente principal.
- Adicionado comportamento responsivo para telas menores.
- `npm run typecheck`: aprovado.
- `npm run build`: aprovado.

## 2026-07-10 — Configurações e administração de campeonatos

- criado formulário reutilizável `web/components/forms/campeonato/CampeonatoForm.tsx`;
- dados básicos obrigatórios: nome, logo e tipo;
- dados informativos e de controle passaram a usar `campeonato_configuracoes`;
- adicionados filtros por tipo: diário, copa, liga, xtreino e confronto;
- adicionada edição do campeonato e de suas configurações;
- adicionada exclusão lógica com `deleted_at` e status `excluido`;
- criação e edição exigem perfil de produtora e validação de propriedade no backend;
- a interface atualiza a lista local sem recarregar toda a página após criar, editar ou excluir.

## Modal global e correção do resumo de campeonato

- Criado `web/components/layout/SystemModal.tsx` como padrão reutilizável do sistema.
- Cadastro e edição de campeonato agora abrem sobre a página com fundo desfocado.
- Modal fecha ao clicar fora, no botão fechar ou ao pressionar `Esc`.
- A rolagem fica restrita ao formulário e a página de fundo permanece travada.
- Corrigido o grid dos indicadores de equipes, jogadores, fases, grupos e jogos.

## 2026-07-10 — Subaba Equipes por vagas

- A subaba Equipes foi extraída para `web/features/campeonatos/equipes`.
- Criada grade de vagas livres, reservadas e ocupadas.
- Adição manual permite escolher equipe e line ou criar uma nova line.
- Convites agora ficam vinculados a uma vaga e identificam equipe e line.
- Criadas ações para copiar mensagem, renovar e cancelar convite.
- Criada página pública `/convite/equipe/[token]`.
- Permissões são verificadas no backend para dono da produtora e managers autorizados.
- Uma mesma equipe pode ocupar várias vagas por meio de lines diferentes.

## 2026-07-10 — Lista compacta de vagas

- Subaba Equipes alterada de cards para lista compacta expansível.
- Adicionados filtros: Todas, Livres, Reservadas e Preenchidas.
- Resumo de vagas reduzido para indicadores discretos.
- Ações administrativas aparecem somente ao expandir uma vaga.
- Cabeçalho grande da subaba removido para melhorar o aproveitamento do espaço.

## 2026-07-10 — Lines e escalações por participação
- A aba Jogadores passou a consumir participações válidas (`campeonato_equipe_id` + `line_id` + `vaga_id`).
- A listagem agora é organizada por line, mostra vaga, equipe principal, quantidade de jogadores e situação da escalação.
- Lines sem jogadores permanecem válidas e aparecem como escalação pendente.
- A pesquisa de equipes informa quais lines já estão inscritas no campeonato e bloqueia sua seleção.
- A API de entrada manual valida novamente a duplicidade de line no backend.
- Adicionada migração para criar line principal nas equipes antigas e criar automaticamente a primeira line em novas equipes.

## 2026-07-11 — Convites com referências administrativas

- Removida a busca de equipe do fluxo de criação de convite.
- A reserva por token agora usa referências livres para equipe e line, sem exigir correspondência com os cadastros reais.
- A equipe e a line reais são definidas apenas quando o convite é aceito.
- A página pública permite escolher uma line disponível ou criar uma nova.
- Lines já inscritas no campeonato não podem ser usadas novamente.

## 2026-07-11 — Convite direcionado para equipe
- O convite de campeonato não passa mais pela seleção geral de tipos de perfil.
- Login e cadastro abertos pelo convite são forçados para o tipo equipe.
- Perfis de equipe vinculados ao mesmo login são detectados pelo convite mesmo quando outro perfil está ativo.
- Após login, cadastro ou criação de perfil vinculado, o usuário retorna automaticamente ao convite.
- A ação "Usar outra equipe" encerra a sessão atual e abre diretamente o login de equipe.

## 2026-07-11 — Formulário de campeonatos em duas etapas

- Adicionada seleção inicial por cards para Diário, Copa, Liga, X-Treino e Confronto.
- O formato é preenchido automaticamente conforme o tipo; X-Treino e Confronto mantêm opções próprias.
- Premiação e inscrição agora usam máscara em reais.
- Tipo de premiação virou seletor com Sem premiação, PIX, Dinheiro e Brinde.
- Brindes usam descrição própria; valores monetários são persistidos em campos numéricos.
## 2026-07-29 — Convites e criação de campeonatos na Lili

- Convites de equipe para campeonato agora aceitam também o formato histórico `team_invite` em validação, listagem, renovação e aceite.
- A Lili envia explicitamente o perfil ativo nas operações de campeonato.
- O formulário completo de criação de campeonato foi disponibilizado na Lili somente para o perfil ativo de produtora.
- A capacidade ignora slots excluídos, impedindo falsos bloqueios por limite após ajustes de estrutura.

<!-- participation-changelog-start -->
## 2026-10-11 — Participação, escopo de remoção e Liga (preparado)

- Remoção própria segue própria; grant real/manager atual e workspace autorizados. GET read-only/no-store/No Ar antes do roster; request/review com política e status/version CAS.
- Candidato11 request/add/approve/reject/remove em uma RPC, line/audit/receipt atômicos e quotas; PARTICIPATION_WRITE_MODE legacy. Clientes não atualizados/ativados.
- LG01: schema local antigo não suporta campos/origens Liga. Candidato12 guardado conserva oito origens e adiciona seis Liga/plan fields. Doze candidatos não aplicados ao Supabase.
- 233 nativos/83 fixtures/gate24/tipos/lint/build/npm produção0; auditor108OK/3avisos/0erros. Sem novo browser/device. Lab/volume removidos/Docker parado; sem GitHub/Vercel.
<!-- participation-changelog-end -->

<!-- participation-clients-changelog-start -->
### 2026-10-11 — integração local dos clientes de participação

Contrato puro compartilhado, DTO autorizado de versão, actor vinculado à leitura e persistência/recovery web/app. Equipes/Estrutura/Lili e painel nativo integram fluxos principais; revisão preserva versão da row exibida mesmo com consulta paralela mais nova. Lote web sequencial, origem Liga no app, reserva não selecionável. Metro passa a observar pasta compartilhada; export Android1066módulos/mobiletypes aprovados. 87 novas fixtures, gate26, browser30+2contratos32/32. SQLs anteriores não alterados/nativos233 não repetidos. Flags legacy, origens Liga web avançadas/season/outros writers/staging/layout/arquitetura/deviceQA pendentes. Sem publicação. [Evidências](E:/dropzone-cadastros/relatorios-testes/clientes-participacoes-2026-10-11/final-verification.json).
<!-- participation-clients-changelog-end -->

<!-- liga-web-changelog-start -->
### 2026-10-11 — origem da Liga e plano operacional privado

Estrutura/Lili recebem seletor compartilhado de origem, cotas do rascunho e recuperação exata. GET de estrutura autorizado traz plano projetado; Estrutura elimina leitura duplicada do roster e remove com a versão da mesma leitura. Validação de inteiros no plano/legacy antes dos writes. LG02 parcial: candidato 11 ainda aceita frações e exige correção/nativos. 54fixtures, gate27, browser 46/46, scanner108OK/3avisos/0erros. SQLs/233 nativos históricos não repetidos; flags legacy, 11 candidatos não aplicados e um preflight de leitura preparado. Layout integral/device/staging/outroswriters pendentes. Sem publicação. [Evidências](E:/dropzone-cadastros/relatorios-testes/liga-web-2026-10-11/final-verification.json).
<!-- liga-web-changelog-end -->

<!-- liga-sql-changelog-start -->
### 2026-10-11 — LG02 SQL preparado, validação nativa pendente

Cotas inteiras seguras/agrupamento único e origens completas no candidato de participação; arrays não viram quantidade válida na projeção.99fixtures/27suítes/tipos/lint local passaram.91cenários nativos preparados, nenhum executado: revisão automática bloqueou criação do laboratório por limite de uso. Docker iniciado antes do bloqueio; restauração parado pendente. LG02parcial, SQL não aplicado/flagslegacy/sem publicação. [Evidências](E:/dropzone-cadastros/relatorios-testes/liga-sql-2026-10-11/final-verification.json).
<!-- liga-sql-changelog-end -->

<!-- liga-native-changelog-start -->
### 2026-10-11 — 324 casos PostgreSQL da Liga e regressões verificados

LG02 corrigido/validado no candidato local. Execução manual:59 participação/91 Liga/40 batch/35 escolha/33 transferência/35 convite/31 plano, zero falhas. Baseline 1.5 aceitou 2; SQL corrigido recusa. Resumo do controlador falhou só após as suítes; original preservado, resultado reconciliado e soma corrigida/testada no Windows PowerShell 5.1/7.6.5. Contêiner/volume removidos/Docker encerrado. SQL não aplicado, flags legacy, produção/GitHub/Vercel inalterados. Staging/schema atual/outros writers/QA integral pendentes. [Evidências](E:/dropzone-cadastros/relatorios-testes/liga-sql-validada-2026-10-11/reconciled-run-result.json).
<!-- liga-native-changelog-end -->

<!-- lili-movement-changelog-start -->
### 2026-10-11 — Lili: movimento, leitura e recuperação preparados

Intenções originais/chaves por conta/campeonato e confirmação explícita no modo atomic; snapshots privados paginados recusam espelho bruto divergente. Lease web de inscrições/movimentos, retorno/cambio de conta e armazenamento com falha exercitados. Distribuição sai do ramo sem acesso para Grupos, só atomic; legacy shuffle recusa reservas/bloqueios. Gate com 28 suítes;95 clientes/25 leituras HTTP/72 regressões;72 cenários de navegador e 2 contratos estáticos. SQL 324 histórico/hash igual,11 candidatos+1 preflight não aplicados e flags legacy. Sem publicação; staging/outros writers/QA integral pendentes. [Evidências](E:/dropzone-cadastros/relatorios-testes/lili-movimentos-2026-10-11/final-verification.json).
<!-- lili-movement-changelog-end -->

<!-- mobile-concurrency-changelog-start -->
### 2026-10-12 — concorrência e confirmação dos clientes principais do app

Lease puro compartilhado com o web; pendências cruzadas, sessão atual/bearer renovado, modos atomic/legacy, DTO estrito e descarte apenas local. GET equipes recebe versão autorizada e espelho físico paginado separado da view; callbacks de conta/campeonato/unmount cancelados, token renovado conserva seleção. Gate com 29 suítes/138 fixtures/42 leituras HTTP,106 cenários de navegador +2 contratos estáticos e exportação Android de 1072 módulos aprovados. SQL 324 histórico/hash igual,11 candidatos+1preflight não aplicados; flags legacy e publicação pendente. Sem banco remoto/GitHub/Vercel. [Evidências](E:/dropzone-cadastros/relatorios-testes/mobile-concorrencia-2026-10-12/final-verification.json).
<!-- mobile-concurrency-changelog-end -->

<!-- atomic-routes-changelog-start -->
### 2026-10-12 — rotas atômicas obrigatórias e revisão dos writers

Clientes principais web/app usam URLs próprias para participação/movimento em atomic. Auth antes de guardas; desativação/erro de flag/endpoint/RPC conserva UUID/corpo, sem downgrade/reenvio à URL legacy. Compatibilidade canônica histórica preservada e permissão antes de JSON no PATCH legacy. Gate30/122 fixtures/114 runtime+2 estáticos aprovados. Inventário ampliado486 writes/90 arquivos/90 tabelas; season/progressão/reversão/estrutura continuam pendentes de transação/CAS/locks. SQL324 histórico/hash igual,flags legacy, banco/staging/seis parciais/publicação pendentes. [Evidências](E:/dropzone-cadastros/relatorios-testes/contrato-atomico-2026-10-12/final-verification.json).
<!-- atomic-routes-changelog-end -->

<!-- current-db-changelog-start -->
### 2026-10-12 — banco atual em leitura e prévia de progressão

Catálogo/owners/ACL/preflight coletados só em leitura, sem alterações remotas. DBR01/DBR02 e ausência do schema Liga LG01 confirmados; SQLs ainda não aplicados. Prévia movida para backend, paginada/escopada; capacidade zero alinhada ao gatilho, faixas/identidades validadas e erro privado ocultado. Gate31/57checks/8contratos estáticos aprovados. Aplicação/reversão e demais writers ainda pendentes de transação; staging/QA integral/publicação pendentes. [Evidências](E:/dropzone-cadastros/relatorios-testes/banco-atual-2026-10-12/final-verification.json).
<!-- current-db-changelog-end -->

<!-- structure-read-changelog-start -->
### Leitura da Estrutura Avançada — 12/10/2026

**STR02/P2 corrigido localmente.** Listas de grupos, slots, etapas e outros componentes da Estrutura Avançada eram lidas em uma só requisição. Um limite baixo da Data API podia esconder linhas, inclusive no histórico e nos itens de progressão. Três reproduções da função anterior, com dados fictícios e SDK/HTTP controlados, confirmaram o corte em uma linha, dez consultas simultâneas ao Auth para dez responsáveis e e-mail privado usado como rótulo quando não havia nome. São reproduções locais; não há incidente demonstrado com usuários reais.

O leitor foi extraído para [advanced-structure-read.ts](E:/dropzone-cadastros/backend/src/campeonatos/advanced-structure-read.ts). As coleções completas têm paginação, ordenação de apresentação com desempate por ID e filtros de campeonato/edição/etapa/execução. Filhos usam lotes de até 150 IDs, com ordem global reconstruída entre lotes. A resposta é conferida quanto a IDs, escopo e duplicatas. O histórico continua limitado às últimas 500 escolhas e 30 execuções, agora preenchidas por páginas mesmo sob um limite menor da API; todos os itens das execuções selecionadas são carregados. Não é histórico ilimitado. A busca dos nomes dos responsáveis é deduplicada e limita a oito chamadas simultâneas por carregamento; indisponibilidade do Auth usa o rótulo alternativo anterior. E-mail privado do Auth deixou de ser usado como nome; sem nome público, a resposta usa o identificador genérico. Os 72 campos consultados e a unicidade da edição foram conferidos no metadado atual já salvo, sem novas chamadas remotas.

**GET exige autenticação/permissão antes de carregar as listas**, usa no-store em sucesso e erro, e oculta diagnósticos privados. As quatro recargas de estrutura após gravação também usam o novo leitor. Não houve alteração da UI; o DTO permanece compatível, com campeonato_id nas quatro seleções que precisam conferir escopo. Essa extração reduz lógica da rota; não encerra a dívida de arquitetura.

**122 checks permanentes e três reproduções históricas passaram.** Cobertura de 16 coleções, cap de uma linha, falhas em páginas seguintes, IDs estrangeiros/duplicados, mais de 300 etapas com IN até 150, histórico de 501 escolhas/31 execuções recortado para 500/30 e 701 itens de uma execução, ordenação global, Auth com no máximo oito chamadas, rótulos alternativos, ausência do e-mail privado na resposta GET do caso sem nome, visitante/sessão inválida/permissão negada, no-store e privacidade dos erros. Gate completo com 32 suítes, tipos web, lint web/backend, build e npm de produção web/root zero aprovado. Dez contratos estáticos de progressão/histórico passaram, sem falha, retry, skip ou teste flaky. Não houve novo navegador runtime; testes usam código real com serviços adaptados, sem PostgREST remoto ou concorrência PostgreSQL. Mobile, exportação Android, npm mobile/desktop/full web e QA de aparelho/instalador não foram repetidos.

Histórico preservado: o primeiro gate passou as suítes, mas TypeScript apontou quatro chamadas ao nome antigo deixadas na extração. Todas foram corrigidas e o gate completo foi repetido. O primeiro teste avulso passou com dez diagnósticos esperados do SDK para a falha fictícia de rede Auth; a fixture passou a capturá-los e conferi-los nesse caso específico, restaurando console.error. O logging da aplicação não foi alterado. Depois, foi removido o uso do e-mail privado como nome e o gate completo e os contratos estáticos foram repetidos no código final.

**Leitura paginada não é snapshot transacional.** Consultas separadas podem observar alterações entre páginas. IDs repetidos são recusados, mas isso não detecta todos os estados mistos. Uma recarga pode falhar depois de uma gravação legada já persistida; erro não significa rollback e esta etapa não torna a repetição idempotente. Aplicar/reverter progressão, temporada, alterações/exclusões de estrutura e demais escritores continuam exigindo transação, locks/versões, recibos/reconciliação/outbox. Esta correção fecha o corte das listas do leitor, não o bloco inteiro de gravações.

Inventário atual: 313 fontes; no escopo focado, 176 writes literais/35 arquivos/18 tabelas, sete destinos dinâmicos e 13 funções do catálogo histórico. O escopo ampliado conserva 486 writes/90 arquivos/90 tabelas e 26 chamadas RPC. Linhas e hashes dos fluxos revisados foram atualizados; análise estática não prova todos os escritores ou a ordem de locks. Os 20 achados originais corrigidos e seis parciais permanecem. DBR01/DBR02 e LG01 confirmado, dump/backup/staging/aplicação revisada, rollout e QA integral ainda impedem considerar a publicação pronta. Doze hashes SQL iguais: 11 candidatos de alteração e um preflight não aplicados; 324 testes nativos históricos sem reexecução. Flags legacy, HEAD ef9416e1, whitespace zero, Docker parado e porta 43197 sem listener. Nesta etapa: zero chamadas ou gravações Supabase, alteração remota de ambiente/Auth, commit, push, PR ou deploy.

[Evidências](E:/dropzone-cadastros/relatorios-testes/estrutura-leitura-2026-10-12/final-verification.json) · [Gate](E:/dropzone-cadastros/relatorios-testes/estrutura-leitura-2026-10-12/check-release.log) · [Fixtures](E:/dropzone-cadastros/relatorios-testes/estrutura-leitura-2026-10-12/fixtures.log) · [Contratos estáticos](E:/dropzone-cadastros/relatorios-testes/estrutura-leitura-2026-10-12/static.json) · [Writers](E:/dropzone-cadastros/relatorios-testes/estrutura-leitura-2026-10-12/writers-expanded.json).
<!-- structure-read-changelog-end -->

<!-- progression-atomic-20261012 -->

### Progressão transacional — 12/10/2026

Candidato e cliente web preparados: ranking autoritativo, fence/UUID/recibo/imagens, reversão completa com proteção de alterações posteriores, guard de seis escritores e rota dedicada sem fallback. PR02 confirma consulta de coluna inexistente no validador salvo; correção exata com MD5 preparada no mesmo candidato. Validação local: 53 nativos, 47 HTTP/cliente, 12 runtime, dez estáticos e gate33/tipos/lint/build/npm produção zero. Contêiner/volume removidos e Docker parado. 12 candidatos + um preflight sem aplicação remota, flags legacy; temporada/demais estrutura, staging, integração/rollout e QA integral continuam pendentes. [Detalhes e limites](E:/dropzone-cadastros/docs/PROGRESSAO_TRANSACIONAL_2026-10-12.md) · [Fechamento](E:/dropzone-cadastros/docs/PENDENCIAS_FECHAMENTO_2026-10-12.md). Sem commit/push/PR/deploy.


<!-- season-atomic-20261012 -->

### Temporada da Liga: candidato e integração local — 12/10/2026

SE01/SE02: lote transacional e leitor privado/paginado preparados. Prévia revisada, UUID/recibo mestre e inclusões filhas na mesma transação; oito guards, pós-condições, cotas insuficientes recusadas, slots bloqueados/reservados protegidos. Cliente recupera intenção original e protege troca de conta/recurso/desmontagem. Código local recusa lote legado com 503; flag LEAGUE_SEASON_WRITE_MODE=legacy e serviço publicado inalterado. 35 nativos + conferência complementar de cinco corpos/oito guards/ACL/seleção mista, 25 leitor, 41 HTTP/cliente, 16 runtime de temporada +12 progressão repetidos, 18 estáticos e gate35/tipos/lint/build/npm produção zero. Falhas iniciais preservadas. 13 candidatos + um preflight sem aplicação remota; 13 hashes anteriores iguais. Docker/volume próprios removidos e Docker parado. Não fecha demais writers/estrutura/staging nem os seis parciais originais. [Relatório](E:/dropzone-cadastros/docs/SEASON_TRANSACIONAL_2026-10-12.md) · [Pendências](E:/dropzone-cadastros/docs/PENDENCIAS_FECHAMENTO_2026-10-12.md). Sem commit/push/PR/deploy.


<!-- daily-group-atomic-20261012 -->

### Diário: vínculo de horário/grupo — 12/10/2026

DJ01/DJ02: vínculo bidirecional preparado em transação, com limpeza dos dois endpoints deslocados, comparação do snapshot e recibo; leitor sem edição inclui grupos paginados e versões. UI exige confirmação, guarda UUID/corpo, recupera resposta perdida e protege conta/recurso/desmontagem. Legado local recusado com 503, DAILY_GROUP_WRITE_MODE=legacy; Supabase/GitHub/Vercel inalterados nesta etapa. 24 nativos em banco novo (inclui reprodução do legado), quatro corpos/dois guards/ACL, 38 HTTP/cliente, leitor125+3 históricos, 16 runtime Diário +12 progressão repetidos, 14 estáticos e gate36/tipos/lint/build/npm produção zero. 14 candidatos + um preflight não aplicados; 14 hashes anteriores iguais. Docker e volume próprios removidos, Docker parado. Não fecha demais gravações/writers/staging nem os seis parciais originais. [Relatório](E:/dropzone-cadastros/docs/DIARIO_VINCULO_TRANSACIONAL_2026-10-12.md) · [Pendências](E:/dropzone-cadastros/docs/PENDENCIAS_FECHAMENTO_2026-10-12.md). Sem commit/push/PR/deploy.


<!-- edition-atomic-20261012 -->

### Edição/franquia: salvamento transacional preparado — 12/10/2026

Regra confirmada pelo usuário: alterar nome/descrição/status compartilhados exige gerenciar todos os campeonatos da franquia; edição individual mantém sua permissão própria. ED01/ED02/ED03: franquia/origem/edição/recibo juntos, campos omitidos preservados, snapshots legados exatos, pós-condições e replay protegido. Editor extraído e helper de criação recuperam UUID/corpo originais. Criação básica/fases/lifecycle continuam em operações separadas, sem rollback completo certificado. Legado save_edition local recusado com503, EDITION_WRITE_MODE=legacy. 30 nativos em banco novo, quatro corpos/dois guards/ACL, 52 HTTP/cliente, 16 runtime edição +16 Diário/12 progressão repetidos, 18 estáticos e gate37/tipos/lint/build/npm produção zero. 15 candidatos + um preflight não aplicados; 15 hashes anteriores iguais. Dois laboratórios/volumes próprios removidos, Docker parado. Nenhum SQL/MCP ao projeto nesta etapa; leituras externas do build normal não foram instrumentadas. Sem commit/push/PR/deploy. 20 achados originais corrigidos/seis parciais mantidos; demais transações/writers/staging/QA integral pendentes. [Relatório](E:/dropzone-cadastros/docs/EDICAO_FRANQUIA_TRANSACIONAL_2026-10-12.md) · [Fechamento](E:/dropzone-cadastros/docs/PENDENCIAS_FECHAMENTO_2026-10-12.md).

<!-- lifecycle-safety-20261012 -->

### Encerramento/reabertura: diagnóstico e contenção — 12/10/2026

LC01/LC02/LC03 reproduzidos com handler antigo/SDK reais e dados fictícios: gravações parciais, publicação com queda nova pendente e repetição sem recibo. Ramos inseguros removidos; POST/PATCH/DELETE locais recusam503 após autenticação/gestão, antes das tabelas. GET informa unavailable; web/mobile exibem indisponibilidade e controles desativados. **Transação substituta ainda não preparada; pendência de lifecycle permanece aberta.** Web consulta com proteção de conta/recurso/epoch; demais callbacks mobile/painel não certificados. 41 checks (11 históricos/30 atuais),32 runtime finais (16 lifecycle/16 edição),16 estáticos; 38 suítes/tipos/lint passaram, build inicial interrompido por spawn EPERM e final retomado aprovado; tipos mobile e npm produção root/web zero. Falhas iniciais preservadas. Nenhum novo SQL/Docker/SQL-MCP ao projeto, alteração remota, commit/push/PR/deploy; build normal pode ler diretório/cache externo, tráfego não instrumentado. 16 hashes SQL iguais,15 candidatos+um preflight; nativos anteriores históricos. Originais20 corrigidos/seis parciais mantidos. [Relatório](E:/dropzone-cadastros/docs/LIFECYCLE_SEGURANCA_2026-10-12.md) · [Fechamento](E:/dropzone-cadastros/docs/PENDENCIAS_FECHAMENTO_2026-10-12.md).

<!-- lifecycle-atomic-20261012 -->

### Encerramento/reabertura: operação transacional preparada — 12/10/2026

Encerramento/reabertura: candidato SQL e cliente web preparados localmente. Regra confirmada: ativar todas as etapas/divisões encerradas na reabertura, preservar canceladas e manter inscrições fechadas. LC01/LC02/LC03 tratados por transação, ranking autoritativo, revisão/fence, guards, imagens e recibos. 51 nativos em PostgreSQL sintético,54 HTTP/cliente,76 runtime,16 estáticos e gate39/tipos/lint/build aprovados; npm produção root/web zero. LIFECYCLE_WRITE_MODE permanece legacy; mobile continua bloqueado. 17 SQLs (16 candidatos+um preflight),16 hashes anteriores preservados; nenhum SQL/MCP ao projeto nesta etapa. Docker/volume próprios removidos e Docker parado. Staging/ativação, mobile, históricos sem imagem, mudanças após publicação, Booyah com regras não padrão, demais writers e seis parciais originais pendentes. Sem commit/push/PR/deploy; tráfego externo de leitura do build normal não instrumentado.

[Relatório](E:/dropzone-cadastros/docs/LIFECYCLE_TRANSACIONAL_2026-10-12.md) · [Validação](E:/dropzone-cadastros/relatorios-testes/lifecycle-transacao-2026-10-12/final-verification.json) · [Pendências](E:/dropzone-cadastros/docs/PENDENCIAS_FECHAMENTO_2026-10-12.md).

<!-- parallel-batch-20261012 -->

### Duas frentes em paralelo — 12/10/2026

Lote com duas frentes paralelas concluído localmente: cliente mobile de encerramento/reabertura preparado, com 53 checks de transporte e 28 runtime React; convites de manager extraídos para backend (rota 243→39 linhas), cancelamento limitado a convite próprio pendente e 35 cenários (34 atuais/um histórico, incluindo 20 paridades). Gate conjunto 41/tipos/lint/build aprovado. Flags legacy e 17 SQLs inalterados; nenhum banco nativo repetido nesta etapa. QA real de dispositivo, staging/ativação e demais pendências permanecem; originais 20 corrigidos/seis parciais. Sem commit/push/PR/deploy.

[Relatório do lote](E:/dropzone-cadastros/docs/LOTE_PARALELO_2026-10-12.md).

<!-- structure-dependencies-20261012 -->

### Grupo e slots / dependências móveis — 12/10/2026

Grupo e slots: candidato SQL e cliente web preparados, writer legado individual contido com flag legacy; 44 verificações nativas (43 atuais/uma sequência histórica), 52 HTTP/cliente e 18 runtime React passaram. Permissão organizar_grupos preservada; quatro corpos/cinco guards/duas tabelas privadas verificados, gatilho de capacidade original intacto. Dependências móveis: audit online36→23 pacotes (13 moderados eliminados;23 altos permanecem), duas overrides compatíveis,19 checks de consumidores, Expo/tipos/export Android aprovados. Validação conjunta de código42/tipos/lint/build e seis contratos passou. Web produção onlinezero; raiz não verificada por escolha do usuário, guarda de release retorna2 sem consultar registro.18 SQLs datados (17 candidatos+um preflight),17 hashes anteriores iguais; laboratório/volume removidos e Docker parado. Sem SQL/MCP ao projeto, alteração remota, commit/push/PR/deploy. Originais20 corrigidos/seis parciais; staging/ativação, grupo mobile, demais writers, acessibilidade/layout integral e dispositivos pendentes.

[Relatório](E:/dropzone-cadastros/docs/GRUPOS_E_DEPENDENCIAS_2026-10-12.md) · [Verificação](E:/dropzone-cadastros/relatorios-testes/lote-estrutura-deps-2026-10-12/final-verification.json).

<!-- mobile-group-prizes-20261012 -->

### Grupos e premiações no mobile — 12/10/2026

Cliente mobile de criação individual de grupo/slots integrado ao contrato transacional, com sessão atualizada, chave/corpo originais recuperáveis e proteção contra troca de conta/campeonato. Leituras privadas, rascunhos e confirmações de premiação isolados por conta/campeonato/geração; premiações ainda sem certificação transacional ou recibos.27 checks de cliente e36 runtime (22 grupos/14 premiações) passaram; código43 suítes/tipos/lint/build, dois contratos mobile, tipos do app e export JS Android aprovados.18 SQLs anteriores e dependências móveis iguais por hash; sem novo banco/audit/SQL/MCP ao projeto ou publicação. Flags legacy; staging/ativação, dispositivos, demais writers e matriz integral de layout/acessibilidade pendentes. Audit anterior mobile23 altos; raiz online não verificada por escolha do usuário. Originais20 corrigidos/seis parciais.

[Relatório](E:/dropzone-cadastros/docs/MOBILE_GRUPOS_PREMIOS_2026-10-12.md) · [Verificação](E:/dropzone-cadastros/relatorios-testes/mobile-grupo-premios-2026-10-12/final-verification.json).

<!-- mobile-management-matrix-20261012 -->

### Painel mobile e matriz de fontes — 12/10/2026

Painel principal mobile protegido contra respostas, rascunhos e confirmações antigas após troca de conta/perfil/campeonato; chamadas próprias usam sessão atualizada. Retorno à lista corrigido e resposta tardia da lista não apaga erro do detalhe.32 cenários do pai e36 regressões grupos/premiações passaram; código43 suítes/tipos/lint/build, dois contratos mobile, tipos do app e export JS Android aprovados. Matriz atual de43 rotas/16 subáreas/326 fontes por imports e hashes; presença e histórico separados de conformidade visual/arquitetural, ainda sem nova navegação web.18 SQLs e dependências móveis anteriores iguais por hash, sem novo audit/banco/SQL/MCP ao projeto/publicação. Atomicidade dos writers, staging/ativação, dispositivos e matriz integral de estados/acessibilidade permanecem pendentes. Raiz online não verificada por escolha do usuário; mobile23 altos no último audit. Originais20 corrigidos/seis parciais.

[Relatório](E:/dropzone-cadastros/docs/PAINEL_MOBILE_E_MATRIZ_2026-10-12.md) · [Verificação](E:/dropzone-cadastros/relatorios-testes/painel-matriz-2026-10-12/final-verification.json).

<!-- dialog-accessibility-20261012 -->

### Diálogos e acessibilidade — 12/10/2026

Fechamento em13/10/2026. Diálogo compartilhado corrigido: somente a janela superior trata Escape/Tab, fundo inert com restauração, foco inicial visível e retorno preservado inclusive em StrictMode. Planilha de stream e recorte de imagens migrados; planilha embutida é região.3 falhas anteriores reproduzidas,38 cenários finais e 14 amostras de contraste passaram; título17,44:1/orientação6,89:1, rótulos/abas/cabeçalhos/números de linha com pelo menos12px; reflow320px com alvo de fechamento44px.19 checks feedback/fundação UI e código43 suítes/tipos/lint/build aprovados. Matriz atual43 rotas/16 subáreas/327 fontes. Testes de componentes/CSS locais com serviços e ícones adaptados, rede interceptada; sem todas as páginas/temas/estados, zoom real, leitor de tela ou dispositivo.18 SQLs/dependências anteriores iguais, sem novo audit/banco/SQL/MCP ao projeto ou publicação. Originais20 corrigidos/seis parciais; L03 permanece parcial, staging/demais writers/dispositivos pendentes. Raiz online não verificada por escolha do usuário.

[Relatório](E:/dropzone-cadastros/docs/DIALOGOS_ACESSIBILIDADE_2026-10-12.md) · [Verificação](E:/dropzone-cadastros/relatorios-testes/dialogos-2026-10-12/final-verification.json).

<!-- form-accessibility-20261013 -->

### Formulários e localidade — 13/10/2026

Formulários em 13/10/2026: Field associa nomes, dicas e erros aos controles compartilhados, preserva ARIA/IDs explícitos e sinaliza obrigatório sem impor validação nativa. Localidade aceita setas/Enter/Escape/Tab, mantém foco e separa Escape da lista e do diálogo. Checkbox causava largura327 em viewport320; CSS compartilhado corrigido e largura final320, sem elementos excedentes.38 cenários de formulários,38 regressões de diálogo/14 amostras e29 checks estáticos passaram; código43 suítes/tipos/lint/build aprovado após o CSS final. Matriz43 rotas/16 subáreas/327 fontes, sem certificação visual integral. Rede dos testes interceptada, IBGE fictício; cadastro real usado como componente, sem gravação/upload/aceite de convite. Leitor de tela, zoom real, dispositivos e todos os estados continuam pendentes.18 SQLs/dependências anteriores iguais; sem novo audit/banco/SQL-MCP ao projeto ou publicação. Originais20 corrigidos/seis parciais; L03 parcial. Falta de espaço impediu uma autorização automática; após aumento do espaço, execução retomada com revisão. Audit online da raiz não verificado por escolha do usuário.

[Relatório](E:/dropzone-cadastros/docs/FORMULARIOS_ACESSIBILIDADE_2026-10-13.md) · [Verificação](E:/dropzone-cadastros/relatorios-testes/formularios-2026-10-13/final-verification.json).

### 13/10/2026 — Carregamento e logo oficial

O carregamento dos diretórios mantém cabeçalho/menu e exibe linhas responsivas, substituindo as barras estreitas causadas pela cascata do grid antigo. Abertura geral usa indicador simples; movimento reduzido é respeitado. Menus, busca, cards e links de catálogo/home usam navegação do Next.

Cabeçalho, login, rodapé, admin, fluxos de convite e indicadores usam o símbolo oficial de `web/public/dropzone-icon.png`. O PNG original foi preservado e sua transparência aplica a cor da interface por CSS. Favicon e ícone Apple apontam para o original. Conferência em Next real:390/1440 px, seis linhas largas, sem overflow, busca/navegação sem recarga, logo amarela e favicon correto. Tipos, lint e build aprovados.
