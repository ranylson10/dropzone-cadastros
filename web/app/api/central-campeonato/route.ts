import { NextRequest, NextResponse } from 'next/server'
import { getBearerUser } from '@backend/auth/server-auth'
import { getCampeonatoPermission, permissionPublicPayload } from '@backend/campeonatos/campeonato-permissions'
import { getCampeonatoCapacidade } from '@backend/campeonatos/capacidade'
import { supabaseAdmin } from '@backend/shared/supabase-admin'

function missingRelation(error: any) {
  return ['42P01', '42703', 'PGRST205', 'PGRST204'].includes(error?.code || '')
}

async function safeCount(table: string, campeonatoId: string, apply?: (query: any) => any, championshipColumn = 'campeonato_id') {
  let query: any = supabaseAdmin.from(table).select('id', { count: 'exact', head: true }).eq(championshipColumn, campeonatoId)
  if (apply) query = apply(query)
  const { count, error } = await query
  if (error && !missingRelation(error)) throw error
  return error ? 0 : Number(count || 0)
}


async function safeRows(table: string, select: string, campeonatoId: string, apply?: (query: any) => any, championshipColumn = 'campeonato_id') {
  let query: any = supabaseAdmin.from(table).select(select).eq(championshipColumn, campeonatoId)
  if (apply) query = apply(query)
  const { data, error } = await query
  if (error && !missingRelation(error)) throw error
  return error ? [] : (data || [])
}



type OperationalLog = {
  id: string
  category: 'championship' | 'structure' | 'team' | 'lineup' | 'game' | 'result' | 'payment' | 'rulebook' | 'security'
  action: string
  title: string
  detail: string
  occurred_at: string
  actor: string
  source: string
}

function logTime(value?: string | null) {
  if (!value) return null
  const time = new Date(value).getTime()
  return Number.isFinite(time) ? new Date(time).toISOString() : null
}

function makeLog(log: OperationalLog): OperationalLog {
  return log
}

type OperationalAlert = {
  id: string
  severity: 'critical' | 'warning' | 'info'
  title: string
  message: string
  context: string
  action: string
  href: string
}

function hoursUntil(value?: string | null) {
  if (!value) return null
  const time = new Date(value).getTime()
  if (!Number.isFinite(time)) return null
  return (time - Date.now()) / 3_600_000
}

function alertItem(campeonatoId: string, alert: Omit<OperationalAlert, 'href'> & { href?: string }): OperationalAlert {
  return {
    ...alert,
    href: alert.href || `/campeonatos/${encodeURIComponent(campeonatoId)}`,
  }
}

async function authorizedChampionships(userId: string) {
  const [championshipsResult, producersResult, managersResult] = await Promise.all([
    supabaseAdmin
      .from('campeonatos')
      .select('id,nome,tipo,status,aprovacao_status,logo_url,produtora_id,criado_por,created_at')
      .is('deleted_at', null)
      .order('created_at', { ascending: false }),
    supabaseAdmin.from('produtoras').select('id').eq('auth_user_id', userId),
    supabaseAdmin.from('managers').select('id').eq('auth_user_id', userId).eq('status', 'ativo'),
  ])
  if (championshipsResult.error) throw championshipsResult.error
  if (producersResult.error) throw producersResult.error
  if (managersResult.error) throw managersResult.error

  const producerIds = (producersResult.data || []).map((row) => String(row.id)).filter(Boolean)
  const managerIds = (managersResult.data || []).map((row) => String(row.id)).filter(Boolean)
  const candidateIds = new Set<string>()

  for (const campeonato of championshipsResult.data || []) {
    if (campeonato.criado_por === userId || producerIds.includes(String(campeonato.produtora_id || ''))) {
      candidateIds.add(String(campeonato.id))
    }
  }

  if (managerIds.length) {
    const [staffResult, sellersResult, tokensResult] = await Promise.all([
      supabaseAdmin
        .from('manager_produtora')
        .select('produtora_id,pode_ver,pode_gerenciar_campeonato,status')
        .in('manager_id', managerIds)
        .eq('status', 'ativo'),
      supabaseAdmin
        .from('campeonato_vendedores')
        .select('campeonato_id,status')
        .in('manager_id', managerIds)
        .eq('status', 'ativo'),
      supabaseAdmin
        .from('tokens')
        .select('campeonato_id,status')
        .eq('tipo', 'manager_invite')
        .in('manager_id', managerIds)
        .eq('status', 'ativo'),
    ])

    if (staffResult.error && !missingRelation(staffResult.error)) throw staffResult.error
    if (sellersResult.error && !missingRelation(sellersResult.error)) throw sellersResult.error
    if (tokensResult.error && !missingRelation(tokensResult.error)) throw tokensResult.error

    const staffProducerIds = new Set(
      (staffResult.data || [])
        .filter((row) => Boolean(row.pode_ver) || Boolean(row.pode_gerenciar_campeonato))
        .map((row) => String(row.produtora_id)),
    )
    for (const campeonato of championshipsResult.data || []) {
      if (staffProducerIds.has(String(campeonato.produtora_id || ''))) candidateIds.add(String(campeonato.id))
    }
    for (const row of sellersResult.data || []) candidateIds.add(String(row.campeonato_id))
    for (const row of tokensResult.data || []) candidateIds.add(String(row.campeonato_id))
  }

  const visible = []
  for (const campeonato of championshipsResult.data || []) {
    if (!candidateIds.has(String(campeonato.id))) continue
    const permission = await getCampeonatoPermission(userId, campeonato.id)
    if (permission.role === 'owner' || permission.role === 'manager' || permission.role === 'seller') {
      visible.push({
        id: campeonato.id,
        nome: campeonato.nome,
        tipo: campeonato.tipo,
        status: campeonato.status,
        aprovacao_status: campeonato.aprovacao_status,
        logo_url: campeonato.logo_url,
        produtora_id: campeonato.produtora_id,
        created_at: campeonato.created_at,
        permission: permissionPublicPayload(permission),
      })
    }
  }
  return visible
}


async function participantChampionships(userId: string) {
  let teamsResult = await supabaseAdmin
    .from('equipes')
    .select('id')
    .or(`auth_user_id.eq.${userId},dono_auth_user_id.eq.${userId}`)

  // Bancos antigos podem ainda não possuir dono_auth_user_id. Nesse caso,
  // mantém a Central funcional usando o vínculo principal da equipe.
  if (teamsResult.error && missingRelation(teamsResult.error)) {
    teamsResult = await supabaseAdmin
      .from('equipes')
      .select('id')
      .eq('auth_user_id', userId)
  }
  if (teamsResult.error) throw teamsResult.error
  const teamIds = (teamsResult.data || []).map((row) => String(row.id)).filter(Boolean)
  if (!teamIds.length) return []

  const { data: participations, error: participationsError } = await supabaseAdmin
    .from('campeonato_equipes')
    .select('campeonato_id')
    .eq('status', 'ativo')
    .in('equipe_id', teamIds)
  if (participationsError) throw participationsError

  const championshipIds = [...new Set((participations || []).map((row) => String(row.campeonato_id)).filter(Boolean))]
  if (!championshipIds.length) return []

  const { data: championships, error: championshipsError } = await supabaseAdmin
    .from('campeonatos')
    .select('id,nome,tipo,status,logo_url')
    .in('id', championshipIds)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
  if (championshipsError) throw championshipsError

  return (championships || []).map((row) => ({ ...row, access: 'participant' }))
}

async function championshipSummary(userId: string, campeonatoId: string) {
  const permission = await getCampeonatoPermission(userId, campeonatoId)
  if (!['owner', 'manager', 'seller'].includes(permission.role) || !permission.canView) {
    throw new Error('Você não tem vínculo autorizado com este campeonato.')
  }

  const { data: campeonato, error: campeonatoError } = await supabaseAdmin
    .from('campeonatos')
    .select('id,nome,tipo,status,aprovacao_status,logo_url,banner_url,produtora_id,created_at')
    .eq('id', campeonatoId)
    .is('deleted_at', null)
    .maybeSingle()
  if (campeonatoError) throw campeonatoError
  if (!campeonato) throw new Error('Campeonato não encontrado.')

  const [
    equipesRows,
    jogadoresRows,
    capacidade,
    grupos,
    jogosRows,
    quedas,
    resultados,
    pagamentosPendentes,
    pagamentosAprovados,
    rulebook,
    config,
    regrasRows,
    equipesLogRows,
    jogadoresLogRows,
    jogosLogRows,
    fasesLogRows,
    gruposLogRows,
    slotsLogRows,
    partidasLogRows,
    resultadosLogRows,
    pagamentosLogRows,
    auditoriaRows,
  ] = await Promise.all([
    safeRows('campeonato_equipes', 'id,equipe_id,status', campeonatoId, (q) => q.eq('status', 'ativo')),
    safeRows('campeonato_jogadores', 'id,campeonato_equipe_id,status', campeonatoId, (q) => q.neq('status', 'deletado')),
    getCampeonatoCapacidade(campeonatoId),
    safeCount('campeonato_grupos', campeonatoId),
    safeRows('campeonato_jogos', 'id,nome,data_jogo,horario,numero_partidas,mapas,status', campeonatoId, (q) => q.neq('status', 'excluido')),
    safeCount('campeonato_partidas', campeonatoId),
    safeCount('campeonato_resultados_equipes', campeonatoId),
    safeCount('sistema_pagamentos', campeonatoId, (q) => q.eq('referencia_tipo', 'campeonato_cobranca').in('status', ['pendente', 'aguardando', 'pending']), 'referencia_id'),
    safeCount('sistema_pagamentos', campeonatoId, (q) => q.eq('referencia_tipo', 'campeonato_cobranca').in('status', ['aprovado', 'pago', 'paid', 'confirmed']), 'referencia_id'),
    supabaseAdmin.from('campeonato_rulebooks').select('id,status,published_at,updated_at').eq('campeonato_id', campeonatoId).maybeSingle(),
    supabaseAdmin.from('campeonato_configuracoes').select('numero_vagas,jogadores_por_vaga,data_limite_inscricao,aceita_novas_inscricoes_equipes').eq('campeonato_id', campeonatoId).maybeSingle(),
    safeRows('campeonato_regras', 'id,grupo_id,vagas_por_equipe,encerra_em,status', campeonatoId, (q) => q.eq('status', 'ativo')),
    safeRows('campeonato_equipes', 'id,status,created_at,updated_at', campeonatoId),
    safeRows('campeonato_jogadores', 'id,status,created_at,updated_at', campeonatoId),
    safeRows('campeonato_jogos', 'id,nome,status,created_at,updated_at', campeonatoId),
    safeRows('campeonato_fases', 'id,nome,status,created_at,updated_at', campeonatoId),
    safeRows('campeonato_grupos', 'id,nome,status,created_at,updated_at', campeonatoId),
    safeRows('campeonato_slots', 'id,grupo_id,equipe_id,line_id,status,created_at,updated_at', campeonatoId),
    safeRows('campeonato_partidas', 'id,jogo_id,numero,status,created_at,updated_at', campeonatoId),
    safeRows('campeonato_resultados_equipes', 'id,partida_id,campeonato_equipe_id,created_at,updated_at', campeonatoId),
    safeRows('sistema_pagamentos', 'id,status,valor,created_at,updated_at,referencia_tipo', campeonatoId, undefined, 'referencia_id'),
    safeRows('sistema_auditoria', 'id,acao,alvo_tipo,alvo_id,detalhes,created_at', campeonatoId, undefined, 'alvo_id'),
  ])

  if (rulebook.error && !missingRelation(rulebook.error)) throw rulebook.error
  if (config.error && !missingRelation(config.error)) throw config.error

  const equipes = equipesRows.length
  const vagasTotais = Number(capacidade.limite_vagas || 0)
  const vagasOcupadas = Math.min(vagasTotais, capacidade.slots_ocupados)
  const vagasDisponiveis = Math.max(0, vagasTotais - vagasOcupadas)
  const jogos = jogosRows.length
  const jogosSemQuedas = Math.max(0, jogos - quedas)
  const resultadosPendentes = Math.max(0, quedas - resultados)
  const requiredPlayers = Math.max(1, Number(config.data?.jogadores_por_vaga || regrasRows[0]?.vagas_por_equipe || 4))
  const playersByTeam = new Map<string, number>()
  for (const player of jogadoresRows) {
    const teamId = String(player.campeonato_equipe_id || '')
    if (teamId) playersByTeam.set(teamId, (playersByTeam.get(teamId) || 0) + 1)
  }
  const lineupsIncomplete = equipesRows.filter((team: { id?: string | null }) => (playersByTeam.get(String(team.id || '')) || 0) < requiredPlayers).length
  const gamesWithoutDate = jogosRows.filter((game: { data_jogo?: string | null }) => !game.data_jogo).length
  const gamesWithoutTime = jogosRows.filter((game: { horario?: string | null }) => !game.horario).length
  const gamesWithoutMatches = jogosRows.filter((game: { numero_partidas?: number | string | null }) => Number(game.numero_partidas || 0) <= 0).length
  const nextGame = jogosRows
    .filter((game: { data_jogo?: string | null }) => game.data_jogo)
    .map((game: { data_jogo: string; horario?: string | null }) => ({ ...game, hours: hoursUntil(`${game.data_jogo}T${game.horario || '23:59:00'}`) }))
    .filter((game: { hours: number | null }) => game.hours != null && game.hours >= 0)
    .sort((a: { hours: number | null }, b: { hours: number | null }) => Number(a.hours) - Number(b.hours))[0]
  const registrationHours = hoursUntil(config.data?.data_limite_inscricao)
  const lineupDeadline = regrasRows.map((rule: { encerra_em?: string | null }) => rule.encerra_em).filter(Boolean).sort()[0] || null
  const lineupHours = hoursUntil(lineupDeadline)
  const alerts: OperationalAlert[] = []

  if (!vagasTotais) alerts.push(alertItem(campeonatoId, { id: 'vagas-sem-limite', severity: 'critical', title: 'Total oficial de vagas não configurado', message: 'O campeonato não possui numero_vagas válido em campeonato_configuracoes.', context: 'Sem esse valor, inscrições e capacidade comercial não podem ser controladas com segurança.', action: 'Configurar vagas oficiais' }))
  if (vagasTotais > 0 && capacidade.slots_criados < vagasTotais) alerts.push(alertItem(campeonatoId, { id: 'estrutura-incompleta', severity: 'warning', title: 'Estrutura inicial incompleta', message: `Existem ${capacidade.slots_criados} de ${vagasTotais} slots estruturados na fase de entrada.`, context: `Ainda faltam ${Math.max(0, vagasTotais - capacidade.slots_criados)} slot(s) para representar a capacidade oficial.`, action: 'Completar grupos e slots' }))
  if (vagasTotais > 0 && vagasDisponiveis === 0) alerts.push(alertItem(campeonatoId, { id: 'vagas-esgotadas', severity: 'info', title: 'Vagas oficiais esgotadas', message: 'Todas as vagas oficiais da fase de entrada estão ocupadas.', context: 'Confira pagamentos e inscrições antes de encerrar definitivamente as vendas.', action: 'Revisar equipes inscritas' }))
  else if (vagasTotais > 0 && vagasDisponiveis <= Math.max(2, Math.ceil(vagasTotais * .2))) alerts.push(alertItem(campeonatoId, { id: 'vagas-baixas', severity: 'warning', title: 'Poucas vagas disponíveis', message: `Restam apenas ${vagasDisponiveis} de ${vagasTotais} vagas oficiais.`, context: 'A capacidade está próxima de esgotar.', action: 'Revisar inscrições e vendas' }))
  if (!grupos) alerts.push(alertItem(campeonatoId, { id: 'sem-grupos', severity: 'critical', title: 'Nenhum grupo criado', message: 'O campeonato ainda não possui grupos para a fase de entrada.', context: 'As equipes não poderão ser distribuídas até que a estrutura seja criada.', action: 'Criar grupos' }))
  if (!jogos) alerts.push(alertItem(campeonatoId, { id: 'sem-jogos', severity: 'critical', title: 'Nenhum jogo programado', message: 'O campeonato ainda não possui jogos cadastrados.', context: 'Cadastre ao menos o primeiro jogo com data, horário e número de quedas.', action: 'Programar jogos' }))
  if (gamesWithoutDate || gamesWithoutTime || gamesWithoutMatches) alerts.push(alertItem(campeonatoId, { id: 'jogos-incompletos', severity: nextGame && Number(nextGame.hours) <= 72 ? 'critical' : 'warning', title: 'Jogos com configuração incompleta', message: `${gamesWithoutDate} sem data, ${gamesWithoutTime} sem horário e ${gamesWithoutMatches} sem quantidade de quedas.`, context: nextGame && Number(nextGame.hours) <= 72 ? 'Há jogo previsto nas próximas 72 horas.' : 'Complete os dados antes de divulgar a programação.', action: 'Completar programação' }))
  if (lineupsIncomplete > 0) alerts.push(alertItem(campeonatoId, { id: 'escalacoes-incompletas', severity: lineupHours != null && lineupHours <= 24 ? 'critical' : 'warning', title: 'Escalações incompletas', message: `${lineupsIncomplete} equipe(s) ainda não atingiram o mínimo de ${requiredPlayers} jogador(es).`, context: lineupHours == null ? 'Nenhum prazo geral de escalação foi localizado.' : lineupHours < 0 ? 'O prazo de escalação já venceu.' : `O prazo termina em aproximadamente ${Math.ceil(lineupHours)} hora(s).`, action: 'Revisar escalações' }))
  if (registrationHours != null && registrationHours < 0 && config.data?.aceita_novas_inscricoes_equipes) alerts.push(alertItem(campeonatoId, { id: 'inscricao-vencida-aberta', severity: 'critical', title: 'Inscrições abertas após o prazo', message: 'A data limite de inscrição já passou, mas novas inscrições continuam habilitadas.', context: 'Isso pode permitir entradas fora do prazo divulgado.', action: 'Encerrar inscrições' }))
  if (pagamentosPendentes > 0) alerts.push(alertItem(campeonatoId, { id: 'pagamentos-pendentes', severity: 'warning', title: 'Pagamentos aguardando conferência', message: `${pagamentosPendentes} pagamento(s) permanecem pendentes.`, context: 'Confirme ou rejeite os pagamentos antes de consolidar as vagas.', action: 'Revisar pagamentos' }))
  if (resultadosPendentes > 0) alerts.push(alertItem(campeonatoId, { id: 'resultados-pendentes', severity: 'warning', title: 'Resultados pendentes', message: `${resultadosPendentes} queda(s) ainda não possuem resultado completo.`, context: 'A classificação pode ficar desatualizada enquanto houver resultados faltando.', action: 'Abrir pontuador' }))
  if (!rulebook.data?.published_at) alerts.push(alertItem(campeonatoId, { id: 'regulamento-pendente', severity: 'critical', title: 'Regulamento não publicado', message: 'O regulamento ainda não está disponível para os participantes.', context: 'Publique a versão oficial antes do início das partidas.', action: 'Publicar regulamento', href: `/campeonatos/${encodeURIComponent(campeonatoId)}/regulamento` }))

  const severityOrder = { critical: 0, warning: 1, info: 2 }
  alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity] || a.title.localeCompare(b.title))

  const logs: OperationalLog[] = []
  const addLog = (log: OperationalLog) => {
    if (log.occurred_at) logs.push(makeLog(log))
  }

  addLog({
    id: `championship-created-${campeonato.id}`,
    category: 'championship',
    action: 'created',
    title: 'Campeonato criado',
    detail: `${campeonato.nome} entrou na operação.`,
    occurred_at: logTime(campeonato.created_at) || new Date(0).toISOString(),
    actor: 'Produtora',
    source: 'campeonatos',
  })

  for (const phase of fasesLogRows as Array<{ id?: string; nome?: string | null; created_at?: string | null; updated_at?: string | null }>) {
    addLog({ id: `phase-${phase.id}`, category: 'structure', action: 'phase_created', title: 'Fase criada', detail: String(phase.nome || 'Nova fase'), occurred_at: logTime(phase.created_at || phase.updated_at) || '', actor: 'Operação', source: 'campeonato_fases' })
  }
  for (const group of gruposLogRows as Array<{ id?: string; nome?: string | null; created_at?: string | null; updated_at?: string | null }>) {
    addLog({ id: `group-${group.id}`, category: 'structure', action: 'group_created', title: 'Grupo criado', detail: String(group.nome || 'Novo grupo'), occurred_at: logTime(group.created_at || group.updated_at) || '', actor: 'Operação', source: 'campeonato_grupos' })
  }
  for (const slot of slotsLogRows as Array<{ id?: string; equipe_id?: string | null; line_id?: string | null; status?: string | null; created_at?: string | null; updated_at?: string | null }>) {
    if (!slot.equipe_id && !slot.line_id) continue
    addLog({ id: `slot-${slot.id}`, category: 'team', action: 'slot_occupied', title: 'Vaga ocupada', detail: `Uma line foi vinculada à estrutura do campeonato${slot.status ? ` (${slot.status})` : ''}.`, occurred_at: logTime(slot.updated_at || slot.created_at) || '', actor: 'Operação', source: 'campeonato_slots' })
  }
  for (const team of equipesLogRows as Array<{ id?: string; status?: string | null; created_at?: string | null; updated_at?: string | null }>) {
    addLog({ id: `team-${team.id}`, category: 'team', action: 'team_registered', title: 'Equipe inscrita', detail: `Inscrição registrada${team.status ? ` com status ${team.status}` : ''}.`, occurred_at: logTime(team.created_at || team.updated_at) || '', actor: 'Equipe/Produtora', source: 'campeonato_equipes' })
  }
  for (const player of jogadoresLogRows as Array<{ id?: string; status?: string | null; created_at?: string | null; updated_at?: string | null }>) {
    addLog({ id: `player-${player.id}`, category: 'lineup', action: 'player_registered', title: 'Jogador escalado', detail: `Jogador incluído na escalação${player.status ? ` (${player.status})` : ''}.`, occurred_at: logTime(player.created_at || player.updated_at) || '', actor: 'Equipe', source: 'campeonato_jogadores' })
  }
  for (const game of jogosLogRows as Array<{ id?: string; nome?: string | null; status?: string | null; created_at?: string | null; updated_at?: string | null }>) {
    addLog({ id: `game-${game.id}`, category: 'game', action: 'game_created', title: 'Jogo programado', detail: `${game.nome || 'Jogo'}${game.status ? ` — ${game.status}` : ''}.`, occurred_at: logTime(game.created_at || game.updated_at) || '', actor: 'Operação', source: 'campeonato_jogos' })
  }
  for (const match of partidasLogRows as Array<{ id?: string; numero?: number | string | null; status?: string | null; created_at?: string | null; updated_at?: string | null }>) {
    addLog({ id: `match-${match.id}`, category: 'game', action: 'match_created', title: 'Queda criada', detail: `Queda ${match.numero || ''}${match.status ? ` — ${match.status}` : ''}`.trim(), occurred_at: logTime(match.created_at || match.updated_at) || '', actor: 'Operação', source: 'campeonato_partidas' })
  }
  for (const result of resultadosLogRows as Array<{ id?: string; partida_id?: string | null; created_at?: string | null; updated_at?: string | null }>) {
    addLog({ id: `result-${result.id}`, category: 'result', action: 'result_recorded', title: 'Resultado registrado', detail: `Resultado operacional lançado${result.partida_id ? ` para a queda ${String(result.partida_id).slice(0, 8)}` : ''}.`, occurred_at: logTime(result.updated_at || result.created_at) || '', actor: 'Pontuador', source: 'campeonato_resultados_equipes' })
  }
  for (const payment of pagamentosLogRows as Array<{ id?: string; status?: string | null; valor?: number | string | null; created_at?: string | null; updated_at?: string | null }>) {
    addLog({ id: `payment-${payment.id}`, category: 'payment', action: 'payment_updated', title: 'Pagamento atualizado', detail: `Status ${payment.status || 'registrado'}${payment.valor != null ? ` — valor ${payment.valor}` : ''}.`, occurred_at: logTime(payment.updated_at || payment.created_at) || '', actor: 'Financeiro', source: 'sistema_pagamentos' })
  }
  if (rulebook.data?.updated_at || rulebook.data?.published_at) {
    addLog({ id: `rulebook-${rulebook.data?.id || campeonatoId}`, category: 'rulebook', action: rulebook.data?.published_at ? 'published' : 'updated', title: rulebook.data?.published_at ? 'Regulamento publicado' : 'Regulamento atualizado', detail: `Status atual: ${rulebook.data?.status || 'rascunho'}.`, occurred_at: logTime(rulebook.data?.published_at || rulebook.data?.updated_at) || '', actor: 'Produtora', source: 'campeonato_rulebooks' })
  }
  for (const audit of auditoriaRows as Array<{ id?: string | number; acao?: string | null; alvo_tipo?: string | null; created_at?: string | null }>) {
    addLog({ id: `audit-${audit.id}`, category: 'security', action: String(audit.acao || 'audit'), title: 'Ação administrativa', detail: `${audit.acao || 'Ação registrada'}${audit.alvo_tipo ? ` em ${audit.alvo_tipo}` : ''}.`, occurred_at: logTime(audit.created_at) || '', actor: 'Administrador', source: 'sistema_auditoria' })
  }

  logs.sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime())
  const operationalLogs = logs.slice(0, 120)

  return {
    campeonato,
    permission: permissionPublicPayload(permission),
    cards: {
      vagas: { total: vagasTotais, ocupadas: vagasOcupadas, disponiveis: vagasDisponiveis, fonte: 'campeonato_configuracoes.numero_vagas', slots_estruturados: capacidade.slots_criados, slots_livres_estrutura: capacidade.slots_livres_estrutura, slots_ainda_necessarios: capacidade.slots_ainda_podem_ser_criados },
      equipes: { confirmadas: equipes },
      escalacoes: { incompletas: lineupsIncomplete, minimo_jogadores: requiredPlayers, prazo: lineupDeadline },
      grupos: { total: grupos, incompletos: capacidade.slots_criados < vagasTotais ? Math.max(0, vagasTotais - capacidade.slots_criados) : 0 },
      jogos: { total: jogos, sem_quedas: jogosSemQuedas, quedas },
      resultados: { registrados: resultados, pendentes: resultadosPendentes },
      pagamentos: { pendentes: pagamentosPendentes, aprovados: pagamentosAprovados },
      regulamento: { publicado: Boolean(rulebook.data?.published_at || String(rulebook.data?.status || '').toLowerCase() === 'publicado'), status: rulebook.data?.status || 'não publicado' },
    },
    alerts,
    alert_summary: {
      total: alerts.length,
      critical: alerts.filter((alert) => alert.severity === 'critical').length,
      warning: alerts.filter((alert) => alert.severity === 'warning').length,
      info: alerts.filter((alert) => alert.severity === 'info').length,
    },
    logs: operationalLogs,
    log_summary: {
      total: logs.length,
      visible: operationalLogs.length,
      latest_at: operationalLogs[0]?.occurred_at || null,
      categories: operationalLogs.reduce<Record<string, number>>((acc, log) => {
        acc[log.category] = (acc[log.category] || 0) + 1
        return acc
      }, {}),
    },
  }
}

export async function GET(req: NextRequest) {
  try {
    const user = await getBearerUser(req)
    const campeonatoId = String(req.nextUrl.searchParams.get('campeonato_id') || '').trim()
    if (!campeonatoId) {
      const adminItems = await authorizedChampionships(user.id)
      let participantItems: Awaited<ReturnType<typeof participantChampionships>> = []
      try {
        participantItems = await participantChampionships(user.id)
      } catch (participantError) {
        // A lista administrativa é o conteúdo principal desta rota. Uma falha
        // isolada na consulta de participações não deve derrubar toda a Central.
        console.error('[central-campeonato] Falha ao carregar participações:', participantError)
      }
      return NextResponse.json({
        items: adminItems.map((row) => ({ ...row, access: 'administration' })),
        participant_items: participantItems,
      })
    }
    return NextResponse.json(await championshipSummary(user.id, campeonatoId))
  } catch (error: any) {
    const message = error?.message || 'Erro ao carregar a Central do Campeonato.'
    const status = /Sessao/.test(message) ? 401 : /vínculo|permissão/.test(message) ? 403 : 400
    return NextResponse.json({ error: message }, { status })
  }
}
