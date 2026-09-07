# R01 — Mapeamento do contrato DropZone para o DPZ Live Engine

**Data da auditoria:** 06/09/2026

**Projeto auditado:** `C:\Users\Administrator\Desktop\dropzone-cadastros`

**Commit auditado:** `dc179cad` (`main`, alinhado a `origin/main`)

**Escopo:** somente leitura do contrato existente e criação deste relatório. Nenhuma API, tabela, migration, regra de pontuação ou comportamento foi alterado.

## 1. Conclusão executiva

O DropZone já possui o núcleo competitivo necessário para ser o banco oficial:

- campeonatos, fases, grupos, slots/vagas, jogos e quedas;
- participações de equipes por `campeonato_equipe_id`;
- participações de jogadores por `campeonato_jogador_id`;
- pontuador, súmula manual, MatchResult, vínculos e finalização/reabertura;
- classificação de equipes e MVP com filtros por fase, rodada, jogo, queda, mapa e grupo;
- MatchStats detalhado, armas e habilidades;
- autenticação desktop, descoberta de campeonatos autorizados, chave Stream e datasets históricos para o Editor.

Portanto, **não é necessário criar um pontuador, ranking, MVP, MatchResult ou armazenamento paralelo**.

O Site, porém, **ainda não oferece um contrato único e completo para o DPZ Live Engine**. Os dados existem, mas estão espalhados entre rotas de estrutura, pontuador, estatísticas, Stream e serviços internos. Três lacunas bloqueiam uma integração segura sem adaptação mínima:

1. não existe endpoint de baseline “acumulado até antes da queda X”;
2. não existe endpoint de ingestão idempotente do resultado final completo produzido pelo Engine, incluindo o payload detalhado já obtido da API;
3. alguns contratos externos escondem ou renomeiam os IDs competitivos, sobretudo o dataset do Editor e a API genérica legada.

**Decisão da R01:** não alterar o Site nesta rodada. Para R02–R11, recomenda-se uma camada mínima de contrato do Engine que apenas componha os serviços existentes, sem duplicar regras.

## 2. Identidade competitiva confirmada

| Conceito | Identidade canônica | Evidência | Observação |
|---|---|---|---|
| Campeonato | `campeonato_id` | `campeonatos.id` | UUID interno |
| Fase | `fase_id` | `campeonato_fases.id` | vinculada ao campeonato |
| Grupo | `grupo_id` | `campeonato_grupos.id` | vinculada à fase/campeonato |
| Jogo | `jogo_id` | `campeonato_jogos.id` | contém N quedas |
| Queda/partida | `partida_id` | `campeonato_partidas.id` | `numero_partida` é apenas ordem visual |
| Vaga física | `slot_id` | `campeonato_slots.id` | `slot_numero`/`slot_letra` não substituem o ID |
| Inscrição competitiva da equipe/line | `campeonato_equipe_id` | `campeonato_equipes.id` | chave usada nos resultados e rankings |
| Inscrição competitiva do jogador | `campeonato_jogador_id` | `campeonato_jogadores.id` | chave usada no MVP e nos resultados individuais |
| Equipe cadastral | `equipe_id` | `equipes.id` | não identifica isoladamente uma participação |
| Line cadastral | `line_id` | `equipe_lines.id` | unidade esportiva vinculada à vaga |
| Jogador cadastral | `jogador_id` | `jogadores.id` | pode ser nulo para jogador temporário |
| Jogador externo | `player_id` / `id_jogo` | MatchStats e cadastros | fonte de vínculo; não deve ser chave de agregação |
| Equipe externa | não há campo canônico confirmado | nome snapshot/raw no MatchResult/MatchStats | lacuna de mapeamento; não usar nome como identidade |
| Partida externa | `match_id` | `garena_matchstats_importacoes.match_id` | extraído do nome oficial `MatchResult_*` |

As agregações atuais de equipes usam `campeonato_equipe_id`; as de MVP usam `campeonato_jogador_id`. Isso atende à regra de que a mesma entidade cadastral em duas vagas/inscrições não deve ser mesclada.

## 3. Autenticação disponível

| Modo | Como funciona | Uso adequado |
|---|---|---|
| Bearer de usuário DropZone | `Authorization: Bearer <access_token>`; validado por `getBearerUser` e permissões do campeonato | seleção, estrutura, pontuador, escrita e estatísticas imediatas |
| Login desktop | `POST /api/desktop/auth/google/start` ou login normal já usado pelo desktop local | bootstrap de sessão do PC1 sem expor `service_role` |
| Chave Stream por campeonato | `X-DropZone-Stream-Key`; tabela `campeonato_stream_keys` | leitura imediata de catálogo/dados Stream e Editor |
| Público | sem autenticação | estrutura de campeonato ativo/aprovado e estatísticas consolidadas após atraso configurado |

O Engine **não deve receber a `service_role`**. O padrão já existente no desktop local usa uma sessão de usuário e é o caminho compatível com escrita. A chave Stream atual é somente por campeonato e atende leitura; ela não substitui autorização de pontuação.

## 4. Catálogo de endpoints existentes

### 4.1 Seleção e estrutura

| Endpoint | Método | Parâmetros | Autenticação | Resposta principal | IDs retornados | Serviço/fonte interna | Atende ao Engine? | Lacuna | Recomendação mínima |
|---|---|---|---|---|---|---|---|---|---|
| `/api/lili/campeonatos` | GET | nenhum; perfil pode ser indicado por `x-profile-type` | Bearer | `{ items: [{ id,nome,tipo,logo_url,banner_url,status,relationship,permission,registrations }] }` | `campeonato_id`; nas inscrições: participação, equipe, line e grupo | `listManagedChampionships`, `listUserRegistrations` | **Sim**, para listar campeonatos autorizados | nome “Lili” é de UI, não contrato dedicado ao Engine | reutilizar em R02; futuramente criar alias/DTO estável apenas se necessário |
| `/api/campeonatos/busca` | GET | `q`, `limit` | Bearer | `{ items }` | campeonato | `searchCampeonatos` | Parcial | busca geral, não representa necessariamente campeonatos operáveis | não usar como fonte principal da sessão do Engine |
| `/api/campeonatos/{id}/estrutura` | GET | path `id` | público se ativo/aprovado; Bearer amplia permissão | `{ campeonato,fases,grupos,slots,jogos,resumo,permission }` | campeonato, fase, grupo, slot, equipe, line; `participacao_id` nos slots; jogo | `loadStructure` no route handler | **Sim**, para fases/grupos/slots/jogos | `participacao_id` deveria ser explicitado como `campeonato_equipe_id`; não retorna `partida_id` de cada queda | preservar rota; adapter do Engine deve normalizar o nome do ID |
| `/api/campeonatos/{id}/jogos` | GET | `fase_id`, `rodada_id` | Bearer + permissão de estrutura | `{ jogos }`, com grupos e quedas hidratadas | fase, rodada, jogo, grupo, `partida_id` | `listarJogos` | **Sim**, para jogos/quedas reais | requer Bearer; contrato usa `select('*')` em partes | reutilizar com Bearer e congelar DTO no cliente do Engine |
| `/api/campeonatos/{id}/jogos/{jogoId}` | GET | path IDs | Bearer + permissão de estrutura | `{ quedas }` | `partida_id`, jogo, fase, grupo | `listarQuedasJogo` | **Sim** | duplicado funcional da rota `/quedas` | escolher uma única rota no adapter |
| `/api/campeonatos/{id}/jogos/{jogoId}/quedas` | GET | path IDs | Bearer + permissão de estrutura | `{ quedas }` | `partida_id`, `jogo_id`, `fase_id`, `grupo_id` | `listarQuedasJogo` | **Sim** | nenhuma lacuna funcional para seleção | usar como rota canônica de quedas |
| `/api/campeonatos/{id}/pontuador/jogos` | GET | `fase_id`, `rodada_id` | Bearer + `canScore` | `{ jogos }`, com fase, rodada, grupos e total de slots | campeonato, fase, rodada, jogo, grupo | `listarJogosPontuador` | **Sim** | restrita a operadores de pontuação, como esperado | boa fonte operacional do PC1 |
| `/api/campeonatos/{id}/pontuador/{jogoId}` | GET | path IDs | Bearer + `canScore` | contexto completo do pontuador | todos os IDs competitivos relevantes | `carregarPontuadorJogo` | **Sim, fortemente** | payload grande e não versionado | reutilizar como bootstrap e depois separar polling leve no Engine |
| `/api/campeonatos/{id}/pontuador/transmissao` | GET/PATCH | PATCH: `active_jogo_id`, `active_partida_id`, `expected_version` | Bearer + `canScore` | `{ transmissao: { active_jogo_id,active_partida_id,version,updated_at,updated_by } }` | jogo e partida | `carregarEstadoTransmissao`, `atualizarEstadoTransmissao` | **Sim** | estado é da transmissão do Site/Editor, não o live state local completo | reutilizar somente como ponteiro oficial de contexto |
| `/api/campeonatos/{id}/pontuador/{jogoId}/quedas/{quedaId}/atual` | POST | path IDs | Bearer + `canScore` | `{ ok, transmissao }` | jogo e partida | `atualizarEstadoTransmissao` | Sim | rota de compatibilidade | preferir PATCH `/pontuador/transmissao` |

Exemplo resumido do bootstrap já existente no pontuador:

```json
{
  "campeonato": { "id": "...", "nome": "..." },
  "fase": { "id": "...", "nome": "..." },
  "rodada": { "id": "...", "numero": 1 },
  "jogo": { "id": "...", "fase_id": "..." },
  "partidas": [{ "id": "...", "jogo_id": "...", "numero_partida": 4 }],
  "slots": [{ "campeonato_equipe_id": "...", "equipe_id": "...", "line_id": "..." }],
  "jogadores": [{ "campeonato_jogador_id": "...", "campeonato_equipe_id": "..." }],
  "classificacao_geral": [],
  "classificacao_jogo": [],
  "mvp_geral": [],
  "mvp_jogo": [],
  "vinculos_matchresult": [],
  "transmissao": {}
}
```

### 4.2 Equipes, vagas e jogadores por participação

| Endpoint | Método | Parâmetros | Autenticação | Resposta principal | IDs retornados | Serviço/fonte interna | Atende ao Engine? | Lacuna | Recomendação mínima |
|---|---|---|---|---|---|---|---|---|---|
| `/api/campeonatos/{id}/estrutura` | GET | campeonato | público/Bearer | slots enriquecidos com equipe, line e participação | `slot_id`, grupo, fase, equipe, line, `participacao_id` | tabelas `campeonato_slots`, `campeonato_equipes`, `equipes`, `equipe_lines` | Sim | nome do ID competitivo não é explícito | normalizar `participacao_id -> campeonato_equipe_id` no adapter |
| `/api/campeonatos/{id}/jogadores` | GET | campeonato | público para campeonato aprovado | `{ campeonato,limite_jogadores,participacoes }` | participação da equipe em `participacoes[].id`; jogadores em `jogadores[].id` | consultas a `campeonato_equipes`, `campeonato_jogadores` e `inscricoes_jogadores` | **Sim, com ressalva** | mistura duas fontes e os IDs competitivos aparecem como `id`; deduplicação pode usar ID externo como fallback | para o Engine, priorizar `campeonato_jogadores` do pontuador ou criar DTO explícito |
| `/api/dropzone?entity_type=championship_team&campeonato_id={id}` | GET | tipo e campeonato | Bearer + perfil ativo | `{ rows }` | `campeonato_equipe_id` em `data` | API genérica legada | Parcial | rota grande/legada | não adotar como contrato novo |
| `/api/dropzone?entity_type=player_registration&campeonato_id={id}` | GET | tipo e campeonato | Bearer + perfil ativo | `{ rows }` | `rows[].id` é a participação do jogador; `data` omite `campeonato_equipe_id` | API genérica legada | **Não**, para identidade segura | omite a ligação competitiva necessária | não usar no Engine; corrigir apenas se a rota continuar pública para novos consumidores |

### 4.3 Classificação, MVP e acumulados

| Endpoint | Método | Parâmetros | Autenticação | Resposta principal | IDs retornados | Serviço/fonte interna | Atende ao Engine? | Lacuna | Recomendação mínima |
|---|---|---|---|---|---|---|---|---|---|
| `/api/campeonatos/{id}/estatisticas/equipes` | GET | `fase_id`, `rodada_id`, `jogo_id`, `partida_id`, `mapa_codigo`, `grupo_id` | público com atraso; Bearer autorizado = imediato | `{ equipes,publicacao }` | `campeonato_equipe_id`, equipe, line, grupo | `listarEstatisticasEquipes`; view `campeonato_estatisticas_equipes_detalhe` | **Sim** para geral/jogo/queda | não aceita corte “até a queda X” | acrescentar composição interna por conjunto ordenado de `partida_id`, sem novo cálculo |
| `/api/campeonatos/{id}/estatisticas/mvp` | GET | mesmos filtros | público com atraso; Bearer autorizado = imediato | `{ jogadores,publicacao }` | `campeonato_jogador_id`, `campeonato_equipe_id`, jogador, line | `listarEstatisticasMvp`; view `campeonato_estatisticas_mvp_detalhe`; fallback MatchStats | **Sim** para geral/jogo/queda | mesma ausência de corte histórico | mesma composição de baseline |
| `/api/campeonatos/{id}/estatisticas/campeao` | GET | campeonato | público com atraso; Bearer autorizado = imediato | campeão/final/MVP da final | IDs competitivos na classificação subjacente | `carregarResumoCampeao` | Não é necessário para o loop ao vivo | nenhum bloqueio | manter para site/PC2 |
| `/api/desktop/campeonatos/{id}/estatisticas` | GET | filtros idênticos aos de estatísticas | Bearer + permissão de produção | `{ equipes,jogadores,permission }` | IDs competitivos preservados | `listarEstatisticasEquipes`, `listarEstatisticasMvp` | **Sim**, como contrato desktop já existente | não inclui contexto/roster e não oferece baseline até queda | reutilizar como leitura simples; não duplicar cálculo |
| `/api/campeonatos/{id}/stream/data` | GET/OPTIONS | `sheet`, `jogo_id`, `partida_id`, `fase_id`, `grupo_id`, `mapa_codigo`, `scope=all` | Bearer autorizado ou chave Stream | payload conforme sheet; inclui `context` | respostas brutas `equipes`/`jogadores` preservam IDs competitivos; `rows` usa IDs de apresentação | serviços de estatísticas e contexto Stream | **Sim** para dados consolidados/PC2 | não representa dados instantâneos do Player.log; não oferece corte até queda arbitrária | continuar como contrato histórico; não usar como live state do PC1 |

Filtros já confirmados:

- classificação geral: sem filtros;
- por fase: `fase_id`;
- por rodada: `rodada_id`;
- por jogo: `jogo_id`;
- por queda: `partida_id`;
- por mapa: `mapa_codigo`;
- por grupo: `grupo_id`.

**Acumulado até determinada queda:** o serviço interno aceita uma lista de `partidaIds`, mas nenhuma rota aceita um corte cronológico. O dataset do Editor calcula “anterior” removendo apenas a queda pontuada mais recentemente; isso serve ao movimento visual do ranking, não é um baseline formal para selecionar Q4 e somar Q1+Q2+Q3.

### 4.4 Pontuação, súmula, MatchResult e finalização

| Endpoint | Método | Parâmetros/corpo | Autenticação | Resposta principal | IDs retornados | Serviço/fonte interna | Atende ao Engine? | Lacuna | Recomendação mínima |
|---|---|---|---|---|---|---|---|---|---|
| `/api/campeonatos/{id}/sumula` | GET | `partida_id` opcional | Bearer + `canScore` | `{ partidas,equipes,jogadores }` | partida, equipe/line/participação e jogador/participação | `carregarSumula` | **Sim**, para carregar formulário/base | payload usa `select('*')` | normalizar DTO no Engine |
| `/api/campeonatos/{id}/sumula/manual` | POST | `partida_id`, `equipes[{campeonato_equipe_id,posicao,abates,punicao_*,jogadores[{campeonato_jogador_id,abates,dano,assistencias,revives}]}]` | Bearer + `canScore` | `{ ok,equipes,jogadores }` (contagens) | IDs entram no corpo; resposta não devolve snapshot | `salvarPontuacaoManual` | **Parcial** para envio final | não é idempotência de sessão/Engine; não recebe MatchStats completo; não finaliza a queda na mesma confirmação | reutilizar internamente numa rota fina de consolidação do Engine |
| `/api/campeonatos/{id}/sumula/matchresult/preview` | POST | `partida_id`, `conteudo_bruto` | Bearer + `canScore` | preview, equipes disponíveis/ausentes, vínculos | jogo, partida, `campeonato_equipe_id`, jogador cadastral/temporário | `previewMatchResult` | Sim quando o Engine possui MatchResult textual | depende do formato textual e de vínculo/revisão | manter como fluxo humano de fallback |
| `/api/campeonatos/{id}/sumula/matchresult/confirmar` | POST | `partida_id`, `conteudo_bruto`, `nome_arquivo`, overrides de equipes/jogadores | Bearer + `canScore` | `{ ok,importacao_id,garena,reconciliacao,equipes,jogadores }` | importação e IDs ligados | `confirmarMatchResult`, `salvarPontuacaoManual`, `sincronizarEstatisticasGarena` | **Sim, com ressalva** | reconsulta MatchStats pela API usando o filename; não aceita diretamente snapshot API já reconciliado pelo Engine | manter para pontuador; criar ingestão específica somente em R11 |
| `/api/campeonatos/{id}/sumula/matchresult/sincronizar` | POST | `importacao_id` ou `partida_id` | Bearer + `canScore` | `{ ok,status,jogadores,resultados_jogadores }` ou erro 422 | importação | `sincronizarEstatisticasGarenaDaImportacao` | Parcial | somente reconsulta a fonte externa | não usar para enviar payload já capturado pelo PC1 |
| `/api/campeonatos/{id}/pontuador/{jogoId}/vinculos` | POST/PUT/DELETE | vínculos por `nome_raw` e `campeonato_equipe_id` | Bearer + `canScore` | vínculos atualizados/removidos | vínculo, jogo, participação de equipe | serviço do pontuador + RPC `fn_registrar_vinculo_matchresult_equipe` | **Sim** | nome externo é fonte de mapeamento, não identidade | reutilizar |
| `/api/campeonatos/{id}/pontuador/{jogoId}/quedas/{quedaId}/falta` | POST | `campeonato_equipe_id`, `observacoes` | Bearer + `canScore` | `{ ok,presenca_id }` | participação de equipe/queda | RPC `fn_marcar_falta_equipe_queda` | Sim | nenhum bloqueio para pontuador | manter |
| `/api/campeonatos/{id}/quedas/{quedaId}/finalizar` | POST | path IDs | Bearer + `canScore` | `{ ok,queda }` | partida | update em `campeonato_partidas` | **Sim** | separado da gravação; retry do Engine precisa coordenar as duas etapas | no futuro, orquestrar salvar + finalizar com idempotência, preservando serviços |
| `/api/campeonatos/{id}/quedas/{quedaId}/reabrir` | POST | path IDs | Bearer + `canScore` | `{ ok,queda }` | partida/jogo | update controlado em `campeonato_partidas` | Sim, para operação humana | não pertence ao fluxo automático normal | manter no painel |

O cálculo de pontos **não é feito no Engine nem no corpo recebido**. `campeonato_resultados_equipes` recebe posição, abates e punição; triggers/funções/views usam `campeonato_configuracoes.pontos_colocacao`, `pontos_por_abate` e o sistema `garena|personalizado`. Essa arquitetura deve ser preservada.

### 4.5 MatchStats, armas, habilidades e datasets do Editor

| Endpoint/contrato | Método | Parâmetros | Autenticação | Resposta | IDs | Serviço/fonte | Atende? | Lacuna | Recomendação |
|---|---|---|---|---|---|---|---|---|---|
| `/api/stream/editor-data` | GET/OPTIONS | header de chave | `X-DropZone-Stream-Key` | `{ version,provider,syncedAt,campeonato,context,datasets }` | IDs públicos de equipe/line e `id_jogo`; IDs competitivos são deliberadamente ocultados nos rows | `loadEditorDatasets` | **Sim para datasets históricos do Editor/PC2** | não é contrato do live state do PC1 e não deve ser usado para identidade competitiva | preservar integralmente; adicionar futuros datasets ao mesmo sistema de binding |
| `/api/campeonatos/{id}/stream/catalog` | GET/OPTIONS | campeonato | Bearer ou chave Stream | schema e colunas dos sheets | campeonato | `STREAM_SHEETS` | Sim para descoberta de datasets | schema v1 não cobre datasets futuros ao vivo | versionar quando R06/R07 forem executadas |
| `/api/campeonatos/{id}/stream/data` | GET/OPTIONS | `sheet` + filtros | Bearer ou chave Stream | consolidados de equipes, MVP, mapas, partida atual e próxima queda | IDs competitivos nos arrays brutos; IDs de exibição nos rows | serviços Stream | Sim para histórico | sem eventos instantâneos, alive/knockdown/loadout ao vivo | não misturar com o PC1 até existir contrato R06 |
| MatchStats interno | sem endpoint de leitura dedicado | por importação/jogo/partida | service role no backend | jogadores detalhados, armas e habilidades | `match_id`, `player_id`, `campeonato_jogador_id`, `campeonato_equipe_id` | `garena-matchstats.service.ts` e tabelas privadas | **Dados existem** | não há endpoint bruto dedicado ao Engine | o Engine não precisa lê-los para baseline básico; quando necessário, expor DTO mínimo autorizado |

Campos MatchStats confirmados no código e schema:

- jogador: abates, assistências, dano, headshots, knockdowns, colocação da equipe, sobrevivência, distância movida, maior distância de abate, precisão, taxas de headshot, revives, membros revividos/resgatados, granadas, dano/abates de granada, gelos usados/destruídos, kits médicos, abates por veículo/óleo e mudança de posição;
- armas: `weapon_id`, nome, abates, dano, headshots e precisões;
- habilidades/loadout: tipo (`ativa`, `passiva`, `pet`, `loadout`), `skill_id`, personagem, habilidade, usos, informação, picks e pick rate;
- vínculo: `match_id`, `player_id`, `campeonato_jogador_id` e `campeonato_equipe_id`.

O dataset histórico do Editor já deriva arma principal, até quatro habilidades e pet. Ele não expõe listas completas de armas/loadout como datasets separados.

## 5. Serviços internos que devem ser reutilizados

| Serviço | Responsabilidade confirmada | Regra para integração |
|---|---|---|
| `jogos.service.ts` | jogos, quedas, mapas e rodadas | não recriar consultas de estrutura |
| `pontuador.service.ts` | bootstrap operacional, vínculos MatchResult e faltas | usar como fonte do contexto do PC1 |
| `estatisticas.service.ts` | classificação, MVP, filtros e súmula manual | única fonte de agregação histórica |
| `matchresult.service.ts` | parse, preview, vínculos, confirmação e reconciliação de substituição | preservar o fluxo existente |
| `garena-matchstats.service.ts` | consulta, normalização e persistência do MatchStats | não duplicar schema nem agregação |
| `publicacao.service.ts` | atraso de estatísticas públicas | PC1 autenticado/Stream continua imediato; PC2 público mantém atraso |
| `editor-datasets.service.ts` | datasets históricos do Editor | estender o sistema atual; não criar outro binding |
| `stream-context.ts` | jogo/queda ativos e contexto | reutilizar o ponteiro; não confundir com estado competitivo da partida |
| `transmission-state.service.ts` | estado de transmissão com versão otimista | usar para seleção sincronizada, não para armazenar todo live state |

## 6. Tabelas, views e RPCs relevantes

### Persistência canônica

- `campeonatos`
- `campeonato_configuracoes`
- `campeonato_fases`
- `campeonato_grupos`
- `campeonato_slots`
- `campeonato_rodadas`
- `campeonato_jogos`
- `campeonato_jogos_grupos`
- `campeonato_partidas`
- `campeonato_equipes`
- `campeonato_jogadores`
- `campeonato_resultados_equipes`
- `campeonato_resultados_jogadores`
- `campeonato_partidas_equipes_presenca`
- `matchresult_vinculos_equipes`
- `matchresult_importacoes`
- `matchresult_importacoes_equipes`
- `matchresult_importacoes_jogadores`
- `garena_matchstats_importacoes`
- `garena_matchstats_jogadores`
- `garena_matchstats_armas`
- `garena_matchstats_habilidades`
- `campeonato_stream_keys`
- `campeonato_stream_pack`

### Views/contratos de leitura observados

- `campeonato_partidas_com_mapa`
- `campeonato_pontuador_slots_jogo`
- `campeonato_pontuador_equipes_matriz`
- `campeonato_pontuador_jogadores_jogo`
- `campeonato_classificacao_equipes_pontuador`
- `campeonato_estatisticas_equipes_detalhe`
- `campeonato_estatisticas_mvp_detalhe`
- `campeonato_classificacao_lines`
- `campeonato_classificacao_mvp`
- `garena_matchstats_jogadores_geral`

### RPCs confirmadas no fluxo

- `fn_registrar_vinculo_matchresult_equipe`
- `fn_marcar_falta_equipe_queda`
- `fn_garantir_partidas_campeonato_jogo`
- `fn_obter_ou_criar_campeonato_jogador`

## 7. Matriz de atendimento da R01

| Requisito | Situação | Evidência/observação |
|---|---|---|
| Campeonatos | Atende | `/api/lili/campeonatos` |
| Fases | Atende | `/estrutura` |
| Grupos | Atende | `/estrutura` |
| Jogos | Atende | `/jogos` e `/pontuador/jogos` |
| Quedas/partidas | Atende | `/jogos/{jogoId}/quedas`, `campeonato_partidas` |
| Vagas/equipes | Atende | estrutura e pontuador; identidade é `campeonato_equipe_id` |
| Jogadores por participação | Atende com ressalva | pontuador preserva IDs; rota pública usa nomes genéricos `id` |
| Classificação geral | Atende | estatísticas de equipes sem filtros |
| Classificação por jogo | Atende | `jogo_id` |
| Classificação por queda | Atende | `partida_id` |
| MVP | Atende | `campeonato_jogador_id` |
| Estatísticas básicas | Atende | resultados oficiais de equipe/jogador |
| MatchStats detalhado | Atende internamente | tabelas e serviço privados |
| Armas | Atende internamente/histórico | MatchStats e dataset derivado |
| Habilidades/loadout | Atende internamente/histórico | MatchStats e dataset derivado |
| Vínculos MatchResult/API | Atende | vínculos por equipe e links por jogador externo |
| Acumulado até determinada queda | **Não atende externamente** | `partidaIds` existe somente no serviço interno |
| Envio consolidado e idempotente do Engine | **Não atende** | rotas atuais são voltadas ao pontuador/MatchResult humano |
| Live state Player.log + API | **Não existe no Site, por desenho** | responsabilidade futura do Engine |

## 8. Lacunas encontradas

### L1 — Baseline histórico com corte explícito

Não existe chamada equivalente a:

```text
campeonato + fase/jogo + antes_de_partida_id = Q1 + Q2 + Q3
```

Os filtros públicos selecionam uma queda exata ou todo o escopo. O serviço interno já sabe agregar um conjunto de partidas, portanto a solução mínima é resolver as partidas anteriores pela ordem oficial e reaproveitar `listarEstatisticasEquipes`/`listarEstatisticasMvp` com `partidaIds`.

### L2 — Ingestão final do Engine

`sumula/manual` salva o núcleo oficial, mas não oferece:

- chave de idempotência da sessão/resultado;
- snapshot final completo;
- ingestão do MatchStats já obtido pelo Engine;
- armas/habilidades/loadout;
- confirmação atômica ou retomável de salvar + finalizar;
- status de consolidação próprio para retry seguro.

A futura solução deve ser um orquestrador fino sobre o pontuador e MatchStats existentes, nunca um pontuador paralelo.

### L3 — DTO explícito de identidade

Algumas rotas usam `id` ou `participacao_id` onde o domínio exige `campeonato_jogador_id`/`campeonato_equipe_id`. O dataset do Editor usa IDs públicos de apresentação de propósito. O Engine precisa de um adapter/DTO que preserve sempre as chaves competitivas.

### L4 — `team_id` externo

O schema auditado confirma `player_id` e `match_id`, mas não um `team_id` externo normalizado. Equipes externas são ligadas por nome raw/normalizado e vínculo persistido ao `campeonato_equipe_id`. Caso o payload real da API contenha um ID de equipe confiável, ele deve ser confirmado com amostra real antes de qualquer campo novo.

### L5 — Exposição detalhada de armas e habilidades

Os dados existem em tabelas privadas e são achatados no dataset histórico, mas não há contrato bruto e autorizado por campeonato/jogo/queda. Isso não bloqueia R02/R03; torna-se relevante em R06/R11.

### L6 — Versionamento de contratos

O Editor Data informa `version: 1` e o catálogo Stream informa `schema_version: 1`, mas a maioria das rotas operacionais não possui versão/DTO formal e usa `select('*')`. O Engine deve encapsular esses contratos num único cliente para evitar dependência espalhada.

## 9. Alteração mínima necessária

**Para encerrar a R01: nenhuma alteração funcional é necessária.** O Site deve permanecer como está até a revisão deste relatório.

Para as rodadas futuras, a menor mudança recomendada é criar um contrato específico e autenticado do Engine com somente três operações, todas delegando aos serviços existentes:

1. **Bootstrap de sessão**: compor campeonato, fase, jogo, partida, slots, `campeonato_equipe_id` e `campeonato_jogador_id` em DTO versionado;
2. **Baseline antes da queda**: resolver `partidaIds` anteriores e chamar os agregadores atuais;
3. **Consolidação final idempotente**: validar IDs competitivos, persistir o snapshot detalhado usando as tabelas/serviços atuais, chamar o pontuador existente e confirmar finalização com retry seguro.

Não é recomendada nenhuma nova tabela para ranking, MVP, pontuação, MatchResult, MatchStats, armas ou habilidades. Uma tabela/fila de idempotência do Engine só deve ser considerada na R11 após definir o contrato e o modelo de retry.

## 10. Comportamento anterior e comportamento novo

### Antes desta rodada

O projeto já fornecia todas as rotas, serviços e estruturas descritos acima, mas não havia um documento único que avaliasse sua compatibilidade com o DPZ Live Engine.

### Depois desta rodada

Somente este relatório foi adicionado. APIs, banco, migrations, autenticação, pontuação, PC2, Stream, Editor, MatchResult e MatchStats continuam com o mesmo comportamento.

## 11. Arquivos alterados

- `docs/DPZ_INTEGRACAO_R01_MAPEAMENTO.md` — novo relatório de auditoria R01.

## 12. Testes e verificações

Verificações previstas para esta rodada documental:

- árvore Git limpa antes da auditoria;
- leitura de `README.md`, `PROJECT_CONTEXT.md`, `web/AGENTS.md` e `web/CLAUDE.md`;
- inspeção estática de route handlers, serviços, migrations, views, RPCs e testes existentes;
- `npm run test:garena-schema` para confirmar no ambiente configurado as tabelas privadas do MatchStats;
- `npm run typecheck` para confirmar que a adição documental não acompanha regressão de código;
- `git diff --check` e revisão do diff final.

## 13. Riscos e pendências

- A auditoria de contrato foi baseada no código/migrations e em testes disponíveis; endpoints autenticados não foram exercitados com uma sessão operacional real nesta rodada.
- Existem migrations em duas árvores (`database/migrations` e `supabase/migrations`). Antes de qualquer alteração de schema, deve-se confirmar qual fluxo é autoritativo e se todos os ambientes estão alinhados.
- Views e funções são referenciadas por migrations sucessivas; um ambiente parcialmente migrado pode ter contrato diferente do repositório.
- Rotas de estatísticas públicas aplicam atraso padrão de 300 segundos; o PC1 deve usar Bearer autorizado ou chave Stream, nunca o contrato público atrasado.
- O estado de transmissão (`active_jogo_id`/`active_partida_id`) é independente do status competitivo da queda; não usar um como substituto do outro.
- O dataset histórico do Editor oculta UUIDs competitivos de propósito; não reintroduzi-los em bindings visuais sem necessidade.
- A API genérica `/api/dropzone` permanece legada e não deve virar base do Engine.
- R02 não foi iniciada.
