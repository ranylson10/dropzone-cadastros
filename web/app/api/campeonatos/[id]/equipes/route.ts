import { NextRequest, NextResponse } from 'next/server'
import { getAccountsForUser, getBearerUser } from '@backend/auth/server-auth'
import {
  getCampeonatoPermission,
  permissionPublicPayload,
  type CampeonatoPermission,
} from '@backend/campeonatos/campeonato-permissions'
import { mapParticipacaoDisplay } from '@backend/campeonatos/line-display'
import { getCampeonatoCapacidade } from '@backend/campeonatos/capacidade'
import {
  inserirParticipacaoNoSlot,
  listSlotsLinesView,
  resolveLineForInscricao,
  softRemoveParticipacao,
} from '@backend/campeonatos/participacao-sync'
import { supabaseAdmin } from '@backend/shared/supabase-admin'
import { listarEstatisticasEquipes } from '@backend/campeonatos/estatisticas/estatisticas.service'

function hasSellerPermission(seller: any, key: string, optIn = false) {
  const value = seller?.permissoes?.[key]
  if (optIn) return value === true
  return value !== false
}

function conviteAindaValido(row: { expira_em?: string | null; status?: string; usado?: boolean }, nowMs = Date.now()) {
  if (row.status && row.status !== 'ativo') return false
  if (row.usado) return false
  if (row.expira_em && new Date(row.expira_em).getTime() <= nowMs) return false
  return true
}

/**
 * Resumo de convite para a grade de vagas.
 * O valor bruto `token` só sai para quem pode gerar/gerir convites —
 * evita que anônimos ou leitores copiem o link secreto da listagem.
 */
function mapConviteResumo(
  convite: any,
  slotIdFallback?: string | null,
  options?: { includeToken?: boolean },
) {
  if (!convite) return null
  const includeToken = Boolean(options?.includeToken)
  return {
    id: convite.id,
    ...(includeToken && convite.token ? { token: convite.token } : {}),
    expira_em: convite.expira_em || null,
    status: convite.status || 'ativo',
    usado: Boolean(convite.usado),
    nome_equipe_reservada: convite.nome_equipe_reservada || null,
    nome_line_reservada: convite.nome_line_reservada || null,
    slot_id: convite.slot_id || slotIdFallback || null,
    grupo_id: convite.grupo_id || null,
    modo: convite.slot_id || slotIdFallback ? 'slot' : 'grupo',
    has_token: Boolean(convite.token),
  }
}

/** Marca convites de slot expirados e libera status do slot (não bloqueia listagem). */
async function liberarExpirados(campeonatoId: string) {
  try {
    const agora = new Date().toISOString()
    // Busca ativos e filtra no JS — evita filtro PostgREST com ISO (dois-pontos quebram .or())
    const { data: ativos } = await supabaseAdmin
      .from('tokens')
      .select('id,slot_id,expira_em')
      .eq('campeonato_id', campeonatoId)
      .in('tipo', ['convite_equipe_campeonato', 'team_invite'])
      .eq('status', 'ativo')
      .eq('usado', false)

    const nowMs = Date.now()
    const expirados = (ativos || []).filter(
      (item) => item.expira_em && new Date(item.expira_em).getTime() <= nowMs,
    )
    if (!expirados.length) return

    const ids = expirados.map((item) => item.id)
    await supabaseAdmin.from('tokens').update({ status: 'expirado' }).in('id', ids)

    const slotIds = [...new Set(expirados.map((t) => t.slot_id).filter(Boolean))]
    if (slotIds.length) {
      await supabaseAdmin
        .from('campeonato_slots')
        .update({ status: 'livre', updated_at: agora })
        .in('id', slotIds)
        .eq('status', 'reservado')
        .is('line_id', null)
    }
  } catch {
    // listagem não depende disso
  }
}


async function loadSolicitacoes(campeonatoId: string) {
  const { data: rows, error } = await supabaseAdmin
    .from('campeonato_equipes')
    .select('id,campeonato_id,equipe_id,line_id,status,nome_exibicao,origem_entrada,solicitado_em,revisado_em,revisado_por,motivo_rejeicao,created_at,updated_at')
    .eq('campeonato_id', campeonatoId)
    .in('status', ['pendente', 'rejeitado'])
    .order('solicitado_em', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
  if (error) {
    if (['42703', 'PGRST204'].includes(error.code || '')) return []
    throw error
  }

  const equipeIds = [...new Set((rows || []).map((row: any) => row.equipe_id).filter(Boolean))]
  const lineIds = [...new Set((rows || []).map((row: any) => row.line_id).filter(Boolean))]
  const [{ data: equipes }, { data: lines }] = await Promise.all([
    equipeIds.length ? supabaseAdmin.from('equipes').select('id,nome,tag,logo_url').in('id', equipeIds) : Promise.resolve({ data: [] as any[] }),
    lineIds.length ? supabaseAdmin.from('equipe_lines').select('id,nome,tag,logo_url').in('id', lineIds) : Promise.resolve({ data: [] as any[] }),
  ])
  const equipeMap = new Map((equipes || []).map((row: any) => [row.id, row]))
  const lineMap = new Map((lines || []).map((row: any) => [row.id, row]))
  return (rows || []).map((row: any) => ({
    ...row,
    equipe: equipeMap.get(row.equipe_id) || null,
    line: row.line_id ? lineMap.get(row.line_id) || null : null,
  }))
}


const LIGA_ENTRY_TYPES = new Set(['mantida', 'promovida', 'rebaixada', 'classificatoria_aberta', 'vaga_paga', 'convite_direto'])

async function loadLigaConfig(campeonatoId: string, canManage: boolean) {
  if (!canManage) return null
  const [{ data: campeonato, error: campeonatoError }, { data: config, error: configError }] = await Promise.all([
    supabaseAdmin.from('campeonatos').select('tipo').eq('id', campeonatoId).maybeSingle(),
    supabaseAdmin.from('campeonato_configuracoes').select('liga_nome_agrupamento,liga_divisoes').eq('campeonato_id', campeonatoId).maybeSingle(),
  ])
  if (campeonatoError) throw campeonatoError
  if (configError) throw configError
  if (!campeonato || String((campeonato as any).tipo || '') !== 'liga' || !config) return null
  return {
    nome_agrupamento: String((config as any).liga_nome_agrupamento || 'Agrupamentos'),
    divisoes: Array.isArray((config as any).liga_divisoes) ? (config as any).liga_divisoes : [],
  }
}

type LigaSeasonSuggestionCandidate = {
  equipe_id: string
  line_id: string
  nome: string
  tag: string | null
  logo_url: string | null
  colocacao: number
  grupo_origem_nome: string
}

type LigaSeasonSuggestion = {
  divisao_id: string
  divisao_nome: string
  tipo: 'mantida' | 'promovida' | 'rebaixada'
  origem_divisao_id: string
  origem_divisao_nome: string
  quantidade_planejada: number
  candidatos: LigaSeasonSuggestionCandidate[]
}

async function loadLigaSeasonSuggestions(campeonatoId: string, ligaConfig: any, canManage: boolean) {
  if (!canManage || !ligaConfig?.divisoes?.length) return null

  const { data: currentEdition, error: currentEditionError } = await supabaseAdmin
    .from('campeonato_edicoes')
    .select('id,franquia_id,numero_edicao,temporada')
    .eq('campeonato_id', campeonatoId)
    .maybeSingle()
  if (currentEditionError) throw currentEditionError
  if (!currentEdition?.franquia_id || Number(currentEdition.numero_edicao || 0) <= 1) return null

  const { data: previousEdition, error: previousEditionError } = await supabaseAdmin
    .from('campeonato_edicoes')
    .select('id,campeonato_id,numero_edicao,temporada,titulo_publico')
    .eq('franquia_id', currentEdition.franquia_id)
    .lt('numero_edicao', Number(currentEdition.numero_edicao))
    .order('numero_edicao', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (previousEditionError) throw previousEditionError
  if (!previousEdition?.campeonato_id) return null

  const previousChampionshipId = String(previousEdition.campeonato_id)
  const [{ data: previousConfig, error: previousConfigError }, { data: previousGroups, error: previousGroupsError }] = await Promise.all([
    supabaseAdmin.from('campeonato_configuracoes').select('liga_divisoes').eq('campeonato_id', previousChampionshipId).maybeSingle(),
    supabaseAdmin.from('campeonato_grupos').select('id,nome').eq('campeonato_id', previousChampionshipId),
  ])
  if (previousConfigError) throw previousConfigError
  if (previousGroupsError) throw previousGroupsError

  const previousDivisions = Array.isArray((previousConfig as any)?.liga_divisoes) ? (previousConfig as any).liga_divisoes : []
  const groupByDivisionId = new Map<string, any>()
  for (const division of previousDivisions) {
    const divisionName = String(division?.nome || '').trim().toLocaleLowerCase('pt-BR')
    const group = (previousGroups || []).find((row: any) => String(row?.nome || '').trim().toLocaleLowerCase('pt-BR') === divisionName)
    if (group) groupByDivisionId.set(String(division?.id || ''), group)
  }

  const sourceIds = new Set<string>()
  for (const division of ligaConfig.divisoes || []) {
    sourceIds.add(String(division?.id || ''))
    for (const entry of Array.isArray(division?.entradas) ? division.entradas : []) {
      if (['promovida', 'rebaixada'].includes(String(entry?.tipo || '')) && entry?.origem_agrupamento_id) {
        sourceIds.add(String(entry.origem_agrupamento_id))
      }
    }
  }

  const rankingByDivisionId = new Map<string, any[]>()
  for (const sourceId of sourceIds) {
    const group = groupByDivisionId.get(sourceId)
    if (!group?.id) continue
    const ranking = await listarEstatisticasEquipes(previousChampionshipId, { grupoId: String(group.id) })
    rankingByDivisionId.set(sourceId, ranking)
  }

  const promotedOut = new Map<string, number>()
  const relegatedOut = new Map<string, number>()
  for (const destination of ligaConfig.divisoes || []) {
    for (const entry of Array.isArray(destination?.entradas) ? destination.entradas : []) {
      const sourceId = String(entry?.origem_agrupamento_id || '')
      const qty = Math.max(0, Number(entry?.quantidade || 0))
      if (!sourceId || !qty) continue
      if (String(entry?.tipo || '') === 'promovida') promotedOut.set(sourceId, (promotedOut.get(sourceId) || 0) + qty)
      if (String(entry?.tipo || '') === 'rebaixada') relegatedOut.set(sourceId, (relegatedOut.get(sourceId) || 0) + qty)
    }
  }

  const promotedOffsets = new Map<string, number>()
  const relegatedOffsets = new Map<string, number>()
  const suggestions: LigaSeasonSuggestion[] = []

  const candidate = (row: any, groupName: string): LigaSeasonSuggestionCandidate | null => {
    const equipeId = String(row?.equipe_id || '')
    const lineId = String(row?.line_id || '')
    if (!equipeId || !lineId) return null
    return {
      equipe_id: equipeId,
      line_id: lineId,
      nome: String(row?.nome || 'Equipe'),
      tag: row?.tag ? String(row.tag) : null,
      logo_url: row?.logo_url ? String(row.logo_url) : null,
      colocacao: Number(row?.colocacao || 0),
      grupo_origem_nome: groupName,
    }
  }

  for (const destination of ligaConfig.divisoes || []) {
    const entries = Array.isArray(destination?.entradas) ? destination.entradas : []
    for (const entry of entries) {
      const tipo = String(entry?.tipo || '')
      if (!['mantida', 'promovida', 'rebaixada'].includes(tipo)) continue
      const quantity = Math.max(0, Number(entry?.quantidade || 0))
      if (!quantity) continue

      const sourceId = tipo === 'mantida'
        ? String(destination?.id || '')
        : String(entry?.origem_agrupamento_id || '')
      const sourceDivision = previousDivisions.find((item: any) => String(item?.id || '') === sourceId)
        || (ligaConfig.divisoes || []).find((item: any) => String(item?.id || '') === sourceId)
      const sourceName = String(sourceDivision?.nome || 'Agrupamento de origem')
      const ranking = rankingByDivisionId.get(sourceId) || []
      let selected: any[] = []

      if (tipo === 'promovida') {
        const offset = promotedOffsets.get(sourceId) || 0
        const ceiling = Math.max(0, ranking.length - (relegatedOut.get(sourceId) || 0))
        selected = ranking.slice(offset, Math.min(offset + quantity, ceiling))
        promotedOffsets.set(sourceId, offset + quantity)
      } else if (tipo === 'rebaixada') {
        const offset = relegatedOffsets.get(sourceId) || 0
        const floor = promotedOut.get(sourceId) || 0
        const end = Math.max(floor, ranking.length - offset)
        const start = Math.max(floor, end - quantity)
        selected = ranking.slice(start, end)
        relegatedOffsets.set(sourceId, offset + quantity)
      } else {
        const start = promotedOut.get(sourceId) || 0
        const end = Math.max(start, ranking.length - (relegatedOut.get(sourceId) || 0))
        selected = ranking.slice(start, end).slice(0, quantity)
      }

      suggestions.push({
        divisao_id: String(destination?.id || ''),
        divisao_nome: String(destination?.nome || ''),
        tipo: tipo as LigaSeasonSuggestion['tipo'],
        origem_divisao_id: sourceId,
        origem_divisao_nome: sourceName,
        quantidade_planejada: quantity,
        candidatos: selected.map((row) => candidate(row, sourceName)).filter(Boolean) as LigaSeasonSuggestionCandidate[],
      })
    }
  }

  return {
    previous_championship_id: previousChampionshipId,
    previous_edition_number: Number(previousEdition.numero_edicao || 0),
    previous_season: previousEdition.temporada ? String(previousEdition.temporada) : null,
    previous_title: previousEdition.titulo_publico ? String(previousEdition.titulo_publico) : null,
    current_edition_number: Number(currentEdition.numero_edicao || 0),
    current_season: currentEdition.temporada ? String(currentEdition.temporada) : null,
    suggestions,
  }
}

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    let permission: CampeonatoPermission = {
      canView: true,
      canManage: false,
      canRemove: false,
      canGenerateToken: false,
      canOrganizeGroups: false,
      canManageGames: false,
      canScore: false,
      role: 'none',
      produtoraId: null,
      sellerPermissions: null,
    }
    try {
      const user = await getBearerUser(req)
      permission = await getCampeonatoPermission(user.id, id)
    } catch {
    }

    const includeInviteToken = Boolean(permission.canGenerateToken)

    // liberarExpirados em paralelo com a leitura (não serializa a tela)
    const [, { data: campeonato, error: campError }, viewResult, convitesRes, capacidade, solicitacoes, liga] = await Promise.all([
      liberarExpirados(id),
      supabaseAdmin.from('campeonatos').select('id, nome, logo_url').eq('id', id).is('deleted_at', null).single(),
      listSlotsLinesView(id),
      supabaseAdmin
        .from('tokens')
        .select('id,token,slot_id,grupo_id,expira_em,status,usado,nome_equipe_reservada,nome_line_reservada,created_at')
        .eq('campeonato_id', id)
        .in('tipo', ['convite_equipe_campeonato', 'team_invite'])
        .eq('status', 'ativo')
        .eq('usado', false)
        .order('created_at', { ascending: false }),
      getCampeonatoCapacidade(id).catch(() => null),
      permission.canManage ? loadSolicitacoes(id) : Promise.resolve([]),
      loadLigaConfig(id, permission.canManage),
    ])
    if (campError) throw campError

    const ligaSeason = liga ? await loadLigaSeasonSuggestions(id, liga, permission.canManage) : null
    const nowMs = Date.now()
    // Filtra expiração no JS: PostgREST .or com ISO (dois-pontos) falhava e escondia convites válidos
    const convites = (convitesRes.error ? [] : convitesRes.data || []).filter((t) => conviteAindaValido(t, nowMs))
    const conviteBySlot = new Map<string, any>()
    const convitesGrupo: any[] = []
    for (const t of convites) {
      if (t.slot_id) {
        if (!conviteBySlot.has(t.slot_id)) conviteBySlot.set(t.slot_id, t)
      } else if (t.grupo_id) {
        convitesGrupo.push(t)
      }
    }

    // Caminho rápido: view enxuta (1 query joinada). Fallback se migration ainda não rodou.
    if (viewResult.source === 'view' && Array.isArray(viewResult.rows)) {
      const vagas = (viewResult.rows as any[]).map((row) => {
        const filled = Boolean(row.participacao_id || row.line_id)
        // Preferência: token da query (sempre fresco) → campos da view (convite_* já filtrados no SQL)
        const fromQuery = !filled ? conviteBySlot.get(row.slot_id) || null : null
        const fromView = !filled && row.convite_id
          ? {
              id: row.convite_id,
              token: row.convite_token,
              expira_em: row.convite_expira_em,
              status: 'ativo',
              usado: false,
              nome_equipe_reservada: row.nome_equipe_reservada,
              nome_line_reservada: row.nome_line_reservada,
              slot_id: row.slot_id,
              grupo_id: row.grupo_id,
            }
          : null
        const convite = fromQuery || fromView
        const status = filled
          ? 'ocupada'
          : convite || String(row.status_ui || '') === 'reservada' || row.slot_status === 'reservado'
            ? 'reservada'
            : 'livre'
        const line = row.line_id
          ? { id: row.line_id, nome: row.line_nome, tag: row.line_tag, logo_url: row.line_logo_url }
          : null
        const equipe = row.equipe_id
          ? { id: row.equipe_id, nome: row.equipe_nome, tag: row.equipe_tag, logo_url: row.equipe_logo_url }
          : null
        const campeonatoEquipe = row.participacao_id
          ? mapParticipacaoDisplay({
              id: row.participacao_id,
              equipe_id: row.equipe_id,
              line_id: row.line_id,
              nome_exibicao: row.nome_exibicao,
              origem_entrada: row.origem_entrada,
              grupo_id: row.grupo_id,
              slot_numero: row.slot_numero,
              equipe,
              line,
            })
          : (row.line_id || row.equipe_id)
            ? mapParticipacaoDisplay({
                id: String(row.slot_id),
                equipe_id: row.equipe_id,
                line_id: row.line_id,
                nome_exibicao: row.line_nome || null,
                origem_entrada: 'slot',
                grupo_id: row.grupo_id,
                slot_numero: row.slot_numero,
                equipe,
                line,
              })
            : null

        const fase = row.fase_id
          ? { id: row.fase_id, nome: row.fase_nome, ordem: row.fase_ordem }
          : null
        const grupo = row.grupo_id
          ? { id: row.grupo_id, nome: row.grupo_nome, fase_id: row.fase_id, fase }
          : null

        return {
          id: row.slot_id,
          numero_vaga: Number(row.slot_numero || 0),
          status,
          nome_equipe_reservada: convite?.nome_equipe_reservada || null,
          nome_line_reservada: convite?.nome_line_reservada || null,
          reserva_expira_em: convite?.expira_em || null,
          grupo_id: row.grupo_id,
          fase_id: row.fase_id,
          fase,
          grupo,
          slot_id: row.slot_id,
          slot_numero: row.slot_numero,
          slot_letra: row.slot_letra,
          equipe_id: row.equipe_id,
          line_id: row.line_id,
          line_nome: campeonatoEquipe?.line_nome || row.line_nome || null,
          line_logo_url: campeonatoEquipe?.line_logo_url || row.line_logo_url || null,
          line_tag: campeonatoEquipe?.line_tag || row.line_tag || null,
          equipe_nome: campeonatoEquipe?.equipe_nome || row.equipe_nome || null,
          campeonato_equipe: campeonatoEquipe,
          convite: mapConviteResumo(convite, row.slot_id, { includeToken: includeInviteToken }),
        }
      })

      return NextResponse.json({
        campeonato,
        permission: permissionPublicPayload(permission),
        capacidade,
        solicitacoes,
        liga: liga ? { ...liga, season: ligaSeason } : null,
        vagas,
        convites_grupo: convitesGrupo.map((item) => mapConviteResumo(item, null, { includeToken: includeInviteToken })),
        modelo: {
          unidade_competitiva: 'line',
          pasta: 'equipe',
          vaga_fisica: 'slot',
          hierarquia: ['campeonato', 'fase', 'grupo', 'slot', 'line'],
          leitura: 'vw_campeonato_slots_lines',
        },
      })
    }

    // Fallback: queries manuais se a view ainda não existir no Supabase.
    const { data: slots, error: slotsError } = await supabaseAdmin
      .from('campeonato_slots')
      .select('id,campeonato_id,fase_id,grupo_id,slot_numero,slot_letra,equipe_id,line_id,status,equipes:equipe_id(id,nome,tag,logo_url),equipe_lines:line_id(id,nome,tag,logo_url),grupos:grupo_id(id,nome)')
      .eq('campeonato_id', id)
      .order('slot_numero')
    if (slotsError) throw slotsError

    const { data: participacoes } = await supabaseAdmin.from('campeonato_equipes').select('*').eq('campeonato_id', id).eq('status', 'ativo')

    const equipeIds = [
      ...(slots || []).map((s) => s.equipe_id).filter(Boolean),
      ...(participacoes || []).map((p) => p.equipe_id).filter(Boolean),
    ]
    const lineIds = [
      ...(slots || []).map((s) => s.line_id).filter(Boolean),
      ...(participacoes || []).map((p) => p.line_id).filter(Boolean),
    ]

    const [{ data: equipes }, { data: lines }] = await Promise.all([
      equipeIds.length ? supabaseAdmin.from('equipes').select('id, nome, tag, logo_url').in('id', Array.from(new Set(equipeIds))) : Promise.resolve({ data: [] as any[] }),
      lineIds.length ? supabaseAdmin.from('equipe_lines').select('id, nome, tag, logo_url').in('id', Array.from(new Set(lineIds))) : Promise.resolve({ data: [] as any[] }),
    ])

    const equipesMap = new Map((equipes || []).map((e) => [e.id, e]))
    const linesMap = new Map((lines || []).map((l) => [l.id, l]))
    const partMap = new Map((participacoes || []).map((p) => {
      const equipe = equipesMap.get(p.equipe_id) || null
      const line = p.line_id ? linesMap.get(p.line_id) || null : null
      return [p.id, mapParticipacaoDisplay({ ...p, equipe, line })]
    }))

    const grupoIds = [...new Set((slots || []).map((s: any) => s.grupo_id).filter(Boolean))]
    const { data: gruposFull } = grupoIds.length
      ? await supabaseAdmin.from('campeonato_grupos').select('id,nome,fase_id,slots').in('id', grupoIds)
      : { data: [] as any[] }
    const faseIds = [...new Set((gruposFull || []).map((g) => g.fase_id).filter(Boolean))]
    const { data: fases } = faseIds.length
      ? await supabaseAdmin.from('campeonato_fases').select('id,nome,ordem').in('id', faseIds).order('ordem')
      : { data: [] as any[] }
    const faseMap = new Map((fases || []).map((f) => [f.id, f]))
    const grupoMap = new Map((gruposFull || []).map((g) => [g.id, { ...g, fase: g.fase_id ? faseMap.get(g.fase_id) || null : null }]))

    const usedParticipationIds = new Set<string>()
    const slotsWithParticipations = (slots || []).map((slot: any) => {
      const bySlotId = (participacoes || []).find((p: any) => p.slot_id === slot.id && !usedParticipationIds.has(p.id))
      const byLine = slot.line_id
        ? (participacoes || []).find((p: any) => p.line_id === slot.line_id && !usedParticipationIds.has(p.id))
        : null
      const byGrupoSlot = (participacoes || []).find((p: any) =>
        !usedParticipationIds.has(p.id)
        && p.grupo_id === slot.grupo_id
        && Number(p.slot_numero) === Number(slot.slot_numero)
      )
      const participation = bySlotId || byLine || byGrupoSlot || null
      if (participation?.id) usedParticipationIds.add(participation.id)

      const equipeId = slot.equipe_id || participation?.equipe_id || null
      const lineId = slot.line_id || participation?.line_id || null
      const filled = Boolean(participation || lineId)
      const convite = !filled ? conviteBySlot.get(slot.id) || null : null
      const status = filled
        ? 'ocupada'
        : convite || slot.status === 'reservado'
          ? 'reservada'
          : 'livre'
      const equipe = equipeId ? equipesMap.get(equipeId) || null : null
      const line = lineId ? linesMap.get(lineId) || null : null
      const campeonatoEquipe = participation
        ? partMap.get(participation.id) || null
        : (lineId || equipeId)
          ? mapParticipacaoDisplay({
              id: String(slot.id),
              equipe_id: equipeId,
              line_id: lineId,
              nome_exibicao: line?.nome || null,
              origem_entrada: 'slot',
              grupo_id: slot.grupo_id,
              slot_numero: slot.slot_numero,
              equipe,
              line,
            })
          : null

      const grupo = grupoMap.get(slot.grupo_id) || slot.grupos || null
      const display = campeonatoEquipe

      return {
        id: slot.id,
        numero_vaga: Number(slot.slot_numero || 0),
        status,
        nome_equipe_reservada: convite?.nome_equipe_reservada || null,
        nome_line_reservada: convite?.nome_line_reservada || null,
        reserva_expira_em: convite?.expira_em || null,
        grupo_id: slot.grupo_id,
        fase_id: slot.fase_id || grupo?.fase_id || null,
        fase: grupo?.fase || null,
        grupo,
        slot_id: slot.id,
        slot_numero: slot.slot_numero,
        slot_letra: slot.slot_letra,
        equipe_id: equipeId,
        line_id: lineId,
        line_nome: display?.line_nome || null,
        line_logo_url: display?.line_logo_url || null,
        line_tag: display?.line_tag || null,
        equipe_nome: display?.equipe_nome || null,
        campeonato_equipe: campeonatoEquipe,
        convite: mapConviteResumo(convite, slot.id, { includeToken: includeInviteToken }),
      }
    })

    const orphanParticipations = (participacoes || [])
      .filter((p: any) => !usedParticipationIds.has(p.id))
      .map((p: any, index: number) => {
        const display = partMap.get(p.id) || null
        return {
          id: p.id,
          numero_vaga: Number(p.slot_numero || 1000 + index),
          status: 'ocupada' as const,
          nome_equipe_reservada: null,
          nome_line_reservada: null,
          reserva_expira_em: null,
          grupo_id: p.grupo_id,
          fase_id: null,
          fase: null,
          grupo: p.grupo_id ? grupoMap.get(p.grupo_id) || null : null,
          slot_id: p.slot_id || null,
          slot_numero: p.slot_numero,
          slot_letra: null,
          equipe_id: p.equipe_id,
          line_id: p.line_id,
          line_nome: display?.line_nome || null,
          line_logo_url: display?.line_logo_url || null,
          line_tag: display?.line_tag || null,
          equipe_nome: display?.equipe_nome || null,
          campeonato_equipe: display,
          convite: null,
        }
      })

    return NextResponse.json({
      campeonato,
      permission: permissionPublicPayload(permission),
      capacidade,
      solicitacoes,
      liga: liga ? { ...liga, season: ligaSeason } : null,
      vagas: [...slotsWithParticipations, ...orphanParticipations],
      convites_grupo: convitesGrupo.map((item) => mapConviteResumo(item, null, { includeToken: includeInviteToken })),
      modelo: {
        unidade_competitiva: 'line',
        pasta: 'equipe',
        vaga_fisica: 'slot',
        hierarquia: ['campeonato', 'fase', 'grupo', 'slot', 'line'],
        leitura: 'fallback',
      },
    })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro ao carregar equipes.' }, { status: 400 })
  }
}

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const user = await getBearerUser(req)
    const body = await req.json().catch(() => ({}))

    if (body.mode === 'request') {
      const accounts = await getAccountsForUser(user)
      const equipeId = String(body.equipe_id || '')
      const lineId = String(body.line_id || '')
      if (!equipeId || !lineId) throw new Error('Selecione sua equipe e a line que será inscrita.')
      const equipeAccount = accounts.find((item: any) => item.profile_type === 'equipe' && String(item.id) === equipeId)
      if (!equipeAccount) throw new Error('A equipe informada não pertence ao seu perfil.')

      const { data: config } = await supabaseAdmin
        .from('campeonato_configuracoes')
        .select('aceita_novas_inscricoes_equipes,data_limite_inscricao')
        .eq('campeonato_id', id)
        .maybeSingle()
      if (config && config.aceita_novas_inscricoes_equipes === false) throw new Error('As inscrições de equipes estão fechadas.')
      if (config?.data_limite_inscricao && new Date(config.data_limite_inscricao).getTime() < Date.now()) throw new Error('O prazo de inscrição deste campeonato terminou.')

      const { data: line, error: lineError } = await supabaseAdmin
        .from('equipe_lines')
        .select('id,equipe_id,nome,status')
        .eq('id', lineId)
        .eq('equipe_id', equipeId)
        .maybeSingle()
      if (lineError) throw lineError
      if (!line || String(line.status || '').toLowerCase() === 'inativo') throw new Error('A line selecionada não está disponível para inscrição.')

      const { data: existing, error: existingError } = await supabaseAdmin
        .from('campeonato_equipes')
        .select('id,status')
        .eq('campeonato_id', id)
        .eq('line_id', lineId)
        .in('status', ['ativo', 'pendente'])
        .maybeSingle()
      if (existingError) throw existingError
      if (existing?.status === 'ativo') throw new Error('Esta line já está inscrita neste campeonato.')
      if (existing?.status === 'pendente') return NextResponse.json({ ok: true, solicitacao: existing, mensagem: 'Esta line já possui uma inscrição pendente.' })

      const now = new Date().toISOString()
      const { data: previousRejected } = await supabaseAdmin
        .from('campeonato_equipes')
        .select('id')
        .eq('campeonato_id', id)
        .eq('line_id', lineId)
        .eq('status', 'rejeitado')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      const requestPayload = {
        campeonato_id: id, equipe_id: equipeId, line_id: lineId, nome_exibicao: line.nome,
        origem_entrada: 'inscricao', status: 'pendente', criado_por: user.id, solicitado_em: now,
        revisado_em: null, revisado_por: null, motivo_rejeicao: null, slot_id: null, grupo_id: null, slot_numero: null, updated_at: now,
      }
      const requestQuery = previousRejected?.id
        ? supabaseAdmin.from('campeonato_equipes').update(requestPayload).eq('id', previousRejected.id)
        : supabaseAdmin.from('campeonato_equipes').insert(requestPayload)
      const { data: solicitacao, error: requestError } = await requestQuery.select('*').single()
      if (requestError) throw requestError
      return NextResponse.json({ ok: true, solicitacao, mensagem: 'Inscrição enviada para análise.' }, { status: previousRejected?.id ? 200 : 201 })
    }

    const permission = await getCampeonatoPermission(user.id, id)
    if (!permission.canManage) {
      throw new Error('Você não tem permissão para adicionar equipes. Use o link de convite gerado pelo admin/vendedor.')
    }

    if (body.mode === 'apply_league_season_suggestions') {
      const ligaConfig = await loadLigaConfig(id, true)
      if (!ligaConfig) throw new Error('Esta operação está disponível somente para Ligas.')
      const season = await loadLigaSeasonSuggestions(id, ligaConfig, true)
      if (!season?.suggestions?.length) throw new Error('Nenhuma sugestão de season disponível para aplicar.')

      const { count: occupiedCount, error: occupiedError } = await supabaseAdmin
        .from('campeonato_equipes')
        .select('id', { count: 'exact', head: true })
        .eq('campeonato_id', id)
        .eq('status', 'ativo')
      if (occupiedError) throw occupiedError
      if (Number(occupiedCount || 0) > 0) {
        throw new Error('A aplicação automática só pode ser usada antes de preencher manualmente os agrupamentos.')
      }

      const { data: groups, error: groupsError } = await supabaseAdmin
        .from('campeonato_grupos')
        .select('id,nome')
        .eq('campeonato_id', id)
      if (groupsError) throw groupsError
      const { data: slots, error: slotsError } = await supabaseAdmin
        .from('campeonato_slots')
        .select('id,grupo_id,slot_numero,slot_letra,equipe_id,line_id,status')
        .eq('campeonato_id', id)
        .order('slot_numero', { ascending: true })
      if (slotsError) throw slotsError
      if ((slots || []).some((slot: any) => String(slot.status || '') === 'reservado')) {
        throw new Error('Existem slots reservados por convite. Cancele ou confirme as reservas antes de aplicar as sugestões da season.')
      }

      const groupByDivision = new Map<string, any>()
      for (const division of ligaConfig.divisoes || []) {
        const target = String(division?.nome || '').trim().toLocaleLowerCase('pt-BR')
        const group = (groups || []).find((row: any) => String(row?.nome || '').trim().toLocaleLowerCase('pt-BR') === target)
        if (group) groupByDivision.set(String(division?.id || ''), group)
      }

      const pending: Array<{ slot: any; candidate: LigaSeasonSuggestionCandidate; origem: string }> = []
      const usedTeams = new Set<string>()
      for (const suggestion of season.suggestions as LigaSeasonSuggestion[]) {
        const group = groupByDivision.get(suggestion.divisao_id)
        if (!group) throw new Error(`Prepare o agrupamento "${suggestion.divisao_nome}" antes de aplicar as sugestões.`)
        const freeSlots = (slots || []).filter((slot: any) => slot.grupo_id === group.id && !slot.equipe_id && !slot.line_id)
        const alreadyReserved = pending.filter((item) => item.slot.grupo_id === group.id).length
        const available = freeSlots.slice(alreadyReserved)
        if (available.length < suggestion.candidatos.length) {
          throw new Error(`Não há slots livres suficientes em "${suggestion.divisao_nome}".`)
        }
        suggestion.candidatos.forEach((candidate, index) => {
          if (usedTeams.has(candidate.equipe_id)) throw new Error(`A equipe "${candidate.nome}" apareceu em mais de uma sugestão. Revise as cotas de acesso e rebaixamento.`)
          usedTeams.add(candidate.equipe_id)
          pending.push({ slot: available[index], candidate, origem: `liga_${suggestion.tipo}` })
        })
      }

      for (const item of pending) {
        await inserirParticipacaoNoSlot({
          campeonatoId: id,
          slotId: String(item.slot.id),
          lineId: item.candidate.line_id,
          equipeId: item.candidate.equipe_id,
          nomeExibicao: item.candidate.nome,
          origem: item.origem,
          criadoPor: user.id,
        })
      }

      return NextResponse.json({
        ok: true,
        aplicadas: pending.length,
        mensagem: `${pending.length} sugestão(ões) confirmada(s) na nova season.`,
      })
    }

    let sellerPermission: any = null
    if (permission.role === 'seller') {
      const { data: seller, error: sellerErr } = await supabaseAdmin
        .from('campeonato_vendedores')
        .select('id,limite_vagas,permissoes')
        .eq('campeonato_id', id)
        .eq('manager_auth_user_id', user.id)
        .eq('status', 'ativo')
        .maybeSingle()
      if (sellerErr) throw sellerErr
      sellerPermission = seller
      if (!sellerPermission) throw new Error('Permissão de vendedor não encontrada para este campeonato.')
      if (!hasSellerPermission(sellerPermission, 'adicionar_equipes', true)) {
        throw new Error('Este vendedor não pode adicionar equipes diretamente. Gere um link de convite.')
      }
      const limiteVagas = Number(sellerPermission.limite_vagas || 0)
      if (limiteVagas > 0) {
        const { count, error: countError } = await supabaseAdmin
          .from('campeonato_equipes')
          .select('id', { count: 'exact', head: true })
          .eq('campeonato_id', id)
          .eq('criado_por', user.id)
          .in('origem_entrada', ['vendedor', 'convite', 'inscricao', 'link'])
          .eq('status', 'ativo')
        if (countError) throw countError
        if (Number(count || 0) >= limiteVagas) {
          throw new Error(`Este vendedor atingiu o limite de ${limiteVagas} vaga(s) (${count}/${limiteVagas}).`)
        }
      }
    }
    // UI pode enviar slot_id (canônico) ou vaga_id como alias do id do slot.
    const slotId = String(body.slot_id || body.vaga_id || '')
    const equipeId = String(body.equipe_id || '')
    if (!slotId || !equipeId) throw new Error('Selecione o slot e a equipe (pasta).')

    const { data: slot } = await supabaseAdmin
      .from('campeonato_slots')
      .select('id,grupo_id,slot_numero,slot_letra,equipe_id,line_id')
      .eq('id', slotId)
      .eq('campeonato_id', id)
      .maybeSingle()
    if (!slot) throw new Error('Slot não encontrado.')
    if (slot.equipe_id || slot.line_id) throw new Error('Este slot já está ocupado.')

    const { data: equipe } = await supabaseAdmin.from('equipes').select('id, nome, tag, logo_url').eq('id', equipeId).single()
    if (!equipe) throw new Error('Equipe não encontrada.')

    let origem = permission.role === 'seller' ? 'vendedor' : 'organizador'
    const ligaConfig = await loadLigaConfig(id, permission.canManage)
    if (ligaConfig) {
      const requestedOrigin = String(body.origem_entrada || '').trim()
      if (!LIGA_ENTRY_TYPES.has(requestedOrigin)) throw new Error('Escolha a origem da equipe neste agrupamento da Liga.')

      const { data: grupo, error: grupoError } = await supabaseAdmin
        .from('campeonato_grupos')
        .select('id,nome')
        .eq('id', slot.grupo_id)
        .eq('campeonato_id', id)
        .maybeSingle()
      if (grupoError) throw grupoError
      if (!grupo) throw new Error('Agrupamento da Liga não encontrado para este slot.')

      const division = ligaConfig.divisoes.find((item: any) => String(item?.nome || '').trim().toLocaleLowerCase('pt-BR') === String(grupo.nome || '').trim().toLocaleLowerCase('pt-BR'))
      if (!division) throw new Error('Este grupo não corresponde a um agrupamento configurado da Liga.')
      const planned = (Array.isArray(division.entradas) ? division.entradas : []).filter((entry: any) => String(entry?.tipo || '') === requestedOrigin)
      const quota = planned.reduce((sum: number, entry: any) => sum + Math.max(0, Number(entry?.quantidade || 0)), 0)
      if (quota < 1) throw new Error('Esta origem não possui vagas planejadas neste agrupamento.')

      const normalizedOrigin = `liga_${requestedOrigin}`
      const { count: usedOrigin, error: usedOriginError } = await supabaseAdmin
        .from('campeonato_equipes')
        .select('id', { count: 'exact', head: true })
        .eq('campeonato_id', id)
        .eq('grupo_id', slot.grupo_id)
        .eq('origem_entrada', normalizedOrigin)
        .eq('status', 'ativo')
      if (usedOriginError) throw usedOriginError
      if (Number(usedOrigin || 0) >= quota) throw new Error(`A cota desta origem já foi preenchida (${usedOrigin}/${quota}).`)

      const { data: duplicateTeam, error: duplicateTeamError } = await supabaseAdmin
        .from('campeonato_equipes')
        .select('id,grupo_id')
        .eq('campeonato_id', id)
        .eq('equipe_id', equipeId)
        .eq('status', 'ativo')
        .limit(1)
        .maybeSingle()
      if (duplicateTeamError) throw duplicateTeamError
      if (duplicateTeam) throw new Error('Esta equipe já ocupa uma vaga em outro agrupamento desta Liga.')
      origem = normalizedOrigin
    }

    // Unidade competitiva = line. Pasta = equipe.
    const resolved = await resolveLineForInscricao({
      equipeId,
      campeonatoId: id,
      lineId: body.line_id ? String(body.line_id) : null,
      nomeLine: String(body.nome_line || '').trim() || null,
      tag: equipe.tag,
      logoUrl: equipe.logo_url,
    })

    // Escrita enxuta: campeonato_id + line_id + slot_id
    const participacao = await inserirParticipacaoNoSlot({
      campeonatoId: id,
      slotId,
      lineId: resolved.id,
      equipeId,
      nomeExibicao: resolved.nome,
      origem,
      criadoPor: user.id,
    })

    return NextResponse.json({
      ok: true,
      participacao,
      line: { id: resolved.id, nome: resolved.nome, criada_agora: resolved.criada_agora },
      mensagem: resolved.criada_agora
        ? `Line "${resolved.nome}" criada e adicionada ao slot ${slot.slot_letra || slot.slot_numero}.`
        : `Line "${resolved.nome}" adicionada ao slot ${slot.slot_letra || slot.slot_numero}.`,
    }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro ao adicionar line.' }, { status: 400 })
  }
}


export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const user = await getBearerUser(req)
    const permission = await getCampeonatoPermission(user.id, id)
    if (!permission.canManage) throw new Error('Você não tem permissão para mover equipes entre slots.')

    const body = await req.json()

    if (body.mode === 'review_request') {
      const participationId = String(body.participacao_id || body.request_id || '')
      const action = String(body.action || '')
      if (!participationId) throw new Error('Solicitação não informada.')
      if (!['approve', 'reject'].includes(action)) throw new Error('Ação de revisão inválida.')

      const { data: requestRow, error: requestError } = await supabaseAdmin
        .from('campeonato_equipes')
        .select('id,campeonato_id,equipe_id,line_id,status')
        .eq('id', participationId)
        .eq('campeonato_id', id)
        .maybeSingle()
      if (requestError) throw requestError
      if (!requestRow) throw new Error('Solicitação de inscrição não encontrada.')
      if (!['pendente', 'rejeitado'].includes(String(requestRow.status))) throw new Error('Esta inscrição não está aguardando revisão.')

      const now = new Date().toISOString()
      if (action === 'reject') {
        const motivo = String(body.motivo || '').trim()
        const { data: rejected, error: rejectError } = await supabaseAdmin
          .from('campeonato_equipes')
          .update({ status: 'rejeitado', motivo_rejeicao: motivo || null, revisado_em: now, revisado_por: user.id, slot_id: null, grupo_id: null, slot_numero: null, updated_at: now })
          .eq('id', participationId)
          .select('*')
          .single()
        if (rejectError) throw rejectError
        return NextResponse.json({ ok: true, solicitacao: rejected, mensagem: 'Inscrição rejeitada.' })
      }

      const slotId = String(body.slot_id || '')
      if (!slotId) throw new Error('Escolha manualmente o slot antes de aprovar a inscrição.')
      const { data: slot, error: slotError } = await supabaseAdmin
        .from('campeonato_slots')
        .select('id,grupo_id,slot_numero,slot_letra,equipe_id,line_id')
        .eq('id', slotId)
        .eq('campeonato_id', id)
        .maybeSingle()
      if (slotError) throw slotError
      if (!slot) throw new Error('Slot não encontrado.')
      if (slot.equipe_id || slot.line_id) throw new Error('Este slot já está ocupado.')

      const { data: activeLine, error: activeLineError } = await supabaseAdmin
        .from('campeonato_equipes')
        .select('id')
        .eq('campeonato_id', id)
        .eq('line_id', requestRow.line_id)
        .eq('status', 'ativo')
        .neq('id', participationId)
        .maybeSingle()
      if (activeLineError) throw activeLineError
      if (activeLine) throw new Error('Esta line já possui uma inscrição ativa neste campeonato.')

      const { data: approved, error: approveError } = await supabaseAdmin
        .from('campeonato_equipes')
        .update({ status: 'ativo', slot_id: slot.id, grupo_id: slot.grupo_id, slot_numero: slot.slot_numero, revisado_em: now, revisado_por: user.id, motivo_rejeicao: null, updated_at: now })
        .eq('id', participationId)
        .select('*')
        .single()
      if (approveError) throw approveError
      return NextResponse.json({ ok: true, participacao: approved, mensagem: `Inscrição aprovada no slot ${slot.slot_letra || slot.slot_numero}.` })
    }

    if (body.mode === 'distribute_phase') {
      const phaseId = String(body.phase_id || '')
      const groupIds: string[] = Array.isArray(body.group_ids) ? body.group_ids.map(String).filter(Boolean) : []
      const strategy = body.strategy === 'random' ? 'random' : 'balanced'
      if (!phaseId) throw new Error('Selecione a fase que será organizada.')
      if (groupIds.length < 2) throw new Error('Selecione pelo menos dois grupos para distribuir as equipes.')

      const { data: selectedGroups, error: groupsError } = await supabaseAdmin
        .from('campeonato_grupos')
        .select('id,nome,fase_id')
        .eq('campeonato_id', id)
        .eq('fase_id', phaseId)
        .in('id', groupIds)
      if (groupsError) throw groupsError
      if ((selectedGroups || []).length !== groupIds.length) throw new Error('Um ou mais grupos não pertencem à fase selecionada.')

      const { data: phaseSlots, error: slotsError } = await supabaseAdmin
        .from('campeonato_slots')
        .select('id,campeonato_id,fase_id,grupo_id,slot_numero,slot_letra,equipe_id,line_id,status')
        .eq('campeonato_id', id)
        .eq('fase_id', phaseId)
        .in('grupo_id', groupIds)
        .order('slot_numero', { ascending: true })
      if (slotsError) throw slotsError
      if (!phaseSlots?.length) throw new Error('Nenhum slot foi encontrado nos grupos selecionados.')

      const occupiedSlots = phaseSlots.filter((slot) => slot.equipe_id || slot.line_id)
      if (occupiedSlots.length < 2) throw new Error('É necessário ter pelo menos duas equipes para realizar a distribuição.')

      const occupiedSlotIds = occupiedSlots.map((slot) => String(slot.id))
      const { data: participations, error: participationsError } = await supabaseAdmin
        .from('campeonato_equipes')
        .select('id,line_id,equipe_id,slot_id,grupo_id,slot_numero,status')
        .eq('campeonato_id', id)
        .eq('status', 'ativo')
        .in('slot_id', occupiedSlotIds)
      if (participationsError) throw participationsError

      let entries = occupiedSlots.map((slot) => {
        const participation = (participations || []).find((row) => String(row.slot_id) === String(slot.id))
        if (!participation) throw new Error(`Não foi possível localizar a participação do slot ${slot.slot_letra || slot.slot_numero}.`)
        return { slot, participation }
      })

      for (let index = entries.length - 1; index > 0; index -= 1) {
        const randomIndex = Math.floor(Math.random() * (index + 1))
        const current = entries[index]
        entries[index] = entries[randomIndex]
        entries[randomIndex] = current
      }

      const slotsByGroup = new Map<string, any[]>()
      for (const groupId of groupIds) {
        slotsByGroup.set(groupId, phaseSlots.filter((slot) => String(slot.grupo_id) === groupId).sort((a, b) => Number(a.slot_numero || 0) - Number(b.slot_numero || 0)))
      }

      let targets: any[] = []
      if (strategy === 'balanced') {
        const maxSlots = Math.max(...[...slotsByGroup.values()].map((items) => items.length))
        for (let slotIndex = 0; slotIndex < maxSlots; slotIndex += 1) {
          for (const groupId of groupIds) {
            const target = slotsByGroup.get(groupId)?.[slotIndex]
            if (target) targets.push(target)
          }
        }
      } else {
        targets = [...phaseSlots]
        for (let index = targets.length - 1; index > 0; index -= 1) {
          const randomIndex = Math.floor(Math.random() * (index + 1))
          const current = targets[index]
          targets[index] = targets[randomIndex]
          targets[randomIndex] = current
        }
      }
      targets = targets.slice(0, entries.length)
      if (targets.length < entries.length) throw new Error('Os grupos selecionados não possuem slots suficientes para todas as equipes.')

      const now = new Date().toISOString()
      const rollback = async () => {
        await supabaseAdmin.from('campeonato_slots').update({ equipe_id: null, line_id: null, status: 'livre', updated_at: now }).eq('campeonato_id', id).eq('fase_id', phaseId).in('grupo_id', groupIds)
        for (const entry of entries) {
          await supabaseAdmin.from('campeonato_equipes').update({ slot_id: entry.slot.id, grupo_id: entry.slot.grupo_id, slot_numero: entry.slot.slot_numero, updated_at: now }).eq('id', entry.participation.id).eq('campeonato_id', id)
          await supabaseAdmin.from('campeonato_slots').update({ equipe_id: entry.slot.equipe_id, line_id: entry.slot.line_id, status: 'ocupado', updated_at: now }).eq('id', entry.slot.id).eq('campeonato_id', id)
        }
      }

      try {
        const { error: clearSlotsError } = await supabaseAdmin.from('campeonato_slots').update({ equipe_id: null, line_id: null, status: 'livre', updated_at: now }).eq('campeonato_id', id).eq('fase_id', phaseId).in('grupo_id', groupIds)
        if (clearSlotsError) throw clearSlotsError

        const participationIds = entries.map((entry) => entry.participation.id)
        const { error: clearParticipationsError } = await supabaseAdmin.from('campeonato_equipes').update({ slot_id: null, updated_at: now }).eq('campeonato_id', id).in('id', participationIds)
        if (clearParticipationsError) throw clearParticipationsError

        for (let index = 0; index < entries.length; index += 1) {
          const entry = entries[index]
          const target = targets[index]
          const { error: participationUpdateError } = await supabaseAdmin.from('campeonato_equipes').update({ slot_id: target.id, grupo_id: target.grupo_id, slot_numero: target.slot_numero, updated_at: now }).eq('id', entry.participation.id).eq('campeonato_id', id)
          if (participationUpdateError) throw participationUpdateError
          const { error: slotUpdateError } = await supabaseAdmin.from('campeonato_slots').update({ equipe_id: entry.slot.equipe_id, line_id: entry.slot.line_id, status: 'ocupado', updated_at: now }).eq('id', target.id).eq('campeonato_id', id)
          if (slotUpdateError) throw slotUpdateError
        }
      } catch (distributionError) {
        await rollback()
        throw distributionError
      }

      const counts = groupIds.map((groupId) => ({
        grupo_id: groupId,
        equipes: targets.filter((slot) => String(slot.grupo_id) === groupId).length,
      }))
      return NextResponse.json({
        ok: true,
        mensagem: `${entries.length} equipe(s) distribuída(s) entre ${groupIds.length} grupos.`,
        distribuicao: counts,
      })
    }

    if (body.mode === 'shuffle_group') {
      const groupId = String(body.group_id || '')
      if (!groupId) throw new Error('Selecione o grupo que será sorteado.')

      const { data: groupSlots, error: groupSlotsError } = await supabaseAdmin
        .from('campeonato_slots')
        .select('id,campeonato_id,fase_id,grupo_id,slot_numero,slot_letra,equipe_id,line_id,status')
        .eq('campeonato_id', id)
        .eq('grupo_id', groupId)
        .order('slot_numero', { ascending: true })
      if (groupSlotsError) throw groupSlotsError
      if (!groupSlots?.length) throw new Error('Nenhum slot foi encontrado neste grupo.')

      const occupiedSlots = groupSlots.filter((slot) => slot.equipe_id || slot.line_id)
      if (occupiedSlots.length < 2) throw new Error('É necessário ter pelo menos duas equipes no grupo para realizar o sorteio.')

      const occupiedSlotIds = occupiedSlots.map((slot) => String(slot.id))
      const { data: participations, error: participationsError } = await supabaseAdmin
        .from('campeonato_equipes')
        .select('id,line_id,equipe_id,slot_id,grupo_id,slot_numero,status')
        .eq('campeonato_id', id)
        .eq('status', 'ativo')
        .in('slot_id', occupiedSlotIds)
      if (participationsError) throw participationsError

      const entries = occupiedSlots.map((slot) => {
        const participation = (participations || []).find((row) => String(row.slot_id) === String(slot.id))
        if (!participation) throw new Error(`Não foi possível localizar a participação do slot ${slot.slot_letra || slot.slot_numero}.`)
        return { slot, participation }
      })

      const shuffledTargets = [...groupSlots]
      for (let index = shuffledTargets.length - 1; index > 0; index -= 1) {
        const randomIndex = Math.floor(Math.random() * (index + 1))
        const current = shuffledTargets[index]
        shuffledTargets[index] = shuffledTargets[randomIndex]
        shuffledTargets[randomIndex] = current
      }
      const targets = shuffledTargets.slice(0, entries.length)
      const unchanged = entries.every((entry, index) => String(entry.slot.id) === String(targets[index]?.id))
      if (unchanged && targets.length > 1) {
        const first = targets[0]
        targets[0] = targets[1]
        targets[1] = first
      }

      const now = new Date().toISOString()
      const rollback = async () => {
        await supabaseAdmin.from('campeonato_slots').update({ equipe_id: null, line_id: null, status: 'livre', updated_at: now }).eq('campeonato_id', id).eq('grupo_id', groupId)
        for (const entry of entries) {
          await supabaseAdmin.from('campeonato_equipes').update({
            slot_id: entry.slot.id,
            grupo_id: entry.slot.grupo_id,
            slot_numero: entry.slot.slot_numero,
            updated_at: now,
          }).eq('id', entry.participation.id).eq('campeonato_id', id)
          await supabaseAdmin.from('campeonato_slots').update({
            equipe_id: entry.slot.equipe_id,
            line_id: entry.slot.line_id,
            status: 'ocupado',
            updated_at: now,
          }).eq('id', entry.slot.id).eq('campeonato_id', id)
        }
      }

      try {
        const { error: clearSlotsError } = await supabaseAdmin
          .from('campeonato_slots')
          .update({ equipe_id: null, line_id: null, status: 'livre', updated_at: now })
          .eq('campeonato_id', id)
          .eq('grupo_id', groupId)
        if (clearSlotsError) throw clearSlotsError

        const participationIds = entries.map((entry) => entry.participation.id)
        const { error: clearParticipationsError } = await supabaseAdmin
          .from('campeonato_equipes')
          .update({ slot_id: null, updated_at: now })
          .eq('campeonato_id', id)
          .in('id', participationIds)
        if (clearParticipationsError) throw clearParticipationsError

        for (let index = 0; index < entries.length; index += 1) {
          const entry = entries[index]
          const target = targets[index]
          const { error: participationUpdateError } = await supabaseAdmin
            .from('campeonato_equipes')
            .update({ slot_id: target.id, grupo_id: target.grupo_id, slot_numero: target.slot_numero, updated_at: now })
            .eq('id', entry.participation.id)
            .eq('campeonato_id', id)
          if (participationUpdateError) throw participationUpdateError

          const { error: slotUpdateError } = await supabaseAdmin
            .from('campeonato_slots')
            .update({ equipe_id: entry.slot.equipe_id, line_id: entry.slot.line_id, status: 'ocupado', updated_at: now })
            .eq('id', target.id)
            .eq('campeonato_id', id)
          if (slotUpdateError) throw slotUpdateError
        }
      } catch (shuffleError) {
        await rollback()
        throw shuffleError
      }

      return NextResponse.json({
        ok: true,
        mensagem: `${entries.length} equipe(s) sorteada(s) novamente entre os slots do grupo.`,
      })
    }

    const sourceSlotId = String(body.source_slot_id || '')
    const targetSlotId = String(body.target_slot_id || '')
    const mode = body.mode === 'swap' ? 'swap' : 'move'
    if (!sourceSlotId || !targetSlotId || sourceSlotId === targetSlotId) {
      throw new Error('Selecione dois slots diferentes.')
    }

    const { data: slotRows, error: slotsError } = await supabaseAdmin
      .from('campeonato_slots')
      .select('id,campeonato_id,fase_id,grupo_id,slot_numero,slot_letra,equipe_id,line_id,status')
      .eq('campeonato_id', id)
      .in('id', [sourceSlotId, targetSlotId])
    if (slotsError) throw slotsError

    const source = (slotRows || []).find((slot) => String(slot.id) === sourceSlotId)
    const target = (slotRows || []).find((slot) => String(slot.id) === targetSlotId)
    if (!source || !target) throw new Error('Um dos slots selecionados não foi encontrado.')
    if (!source.line_id && !source.equipe_id) throw new Error('O slot de origem está livre.')

    const targetOccupied = Boolean(target.line_id || target.equipe_id)
    if (mode === 'move' && targetOccupied) throw new Error('O slot de destino precisa estar livre.')
    if (mode === 'swap' && !targetOccupied) throw new Error('Para trocar posições, selecione outro slot ocupado.')

    const { data: participacoes, error: participacoesError } = await supabaseAdmin
      .from('campeonato_equipes')
      .select('id,line_id,equipe_id,slot_id,grupo_id,slot_numero,status')
      .eq('campeonato_id', id)
      .eq('status', 'ativo')
      .in('slot_id', [sourceSlotId, targetSlotId])
    if (participacoesError) throw participacoesError

    const sourceParticipation = (participacoes || []).find((row) => String(row.slot_id) === sourceSlotId)
    const targetParticipation = (participacoes || []).find((row) => String(row.slot_id) === targetSlotId)
    if (!sourceParticipation) throw new Error('Não foi possível localizar a participação vinculada ao slot de origem.')
    if (mode === 'swap' && !targetParticipation) {
      throw new Error('Não foi possível localizar a participação vinculada ao slot de destino.')
    }

    const now = new Date().toISOString()

    if (mode === 'swap' && targetParticipation) {
      const rollback = async () => {
        await supabaseAdmin.from('campeonato_slots').update({
          equipe_id: source.equipe_id,
          line_id: source.line_id,
          status: 'ocupado',
          updated_at: now,
        }).eq('id', sourceSlotId).eq('campeonato_id', id)
        await supabaseAdmin.from('campeonato_slots').update({
          equipe_id: target.equipe_id,
          line_id: target.line_id,
          status: 'ocupado',
          updated_at: now,
        }).eq('id', targetSlotId).eq('campeonato_id', id)
        await supabaseAdmin.from('campeonato_equipes').update({
          slot_id: sourceSlotId,
          grupo_id: source.grupo_id,
          slot_numero: source.slot_numero,
          updated_at: now,
        }).eq('id', sourceParticipation.id).eq('campeonato_id', id)
        await supabaseAdmin.from('campeonato_equipes').update({
          slot_id: targetSlotId,
          grupo_id: target.grupo_id,
          slot_numero: target.slot_numero,
          updated_at: now,
        }).eq('id', targetParticipation.id).eq('campeonato_id', id)
      }

      try {
        const { error: clearSlotsError } = await supabaseAdmin
          .from('campeonato_slots')
          .update({ equipe_id: null, line_id: null, status: 'livre', updated_at: now })
          .eq('campeonato_id', id)
          .in('id', [sourceSlotId, targetSlotId])
        if (clearSlotsError) throw clearSlotsError

        const { error: releaseSourceParticipationError } = await supabaseAdmin
          .from('campeonato_equipes')
          .update({ slot_id: null, updated_at: now })
          .eq('id', sourceParticipation.id)
          .eq('campeonato_id', id)
        if (releaseSourceParticipationError) throw releaseSourceParticipationError

        const { error: targetParticipationError } = await supabaseAdmin
          .from('campeonato_equipes')
          .update({
            slot_id: sourceSlotId,
            grupo_id: source.grupo_id,
            slot_numero: source.slot_numero,
            updated_at: now,
          })
          .eq('id', targetParticipation.id)
          .eq('campeonato_id', id)
        if (targetParticipationError) throw targetParticipationError

        const { error: sourceParticipationError } = await supabaseAdmin
          .from('campeonato_equipes')
          .update({
            slot_id: targetSlotId,
            grupo_id: target.grupo_id,
            slot_numero: target.slot_numero,
            updated_at: now,
          })
          .eq('id', sourceParticipation.id)
          .eq('campeonato_id', id)
        if (sourceParticipationError) throw sourceParticipationError

        const { error: sourceSlotError } = await supabaseAdmin
          .from('campeonato_slots')
          .update({
            equipe_id: target.equipe_id,
            line_id: target.line_id,
            status: 'ocupado',
            updated_at: now,
          })
          .eq('id', sourceSlotId)
          .eq('campeonato_id', id)
        if (sourceSlotError) throw sourceSlotError

        const { error: targetSlotError } = await supabaseAdmin
          .from('campeonato_slots')
          .update({
            equipe_id: source.equipe_id,
            line_id: source.line_id,
            status: 'ocupado',
            updated_at: now,
          })
          .eq('id', targetSlotId)
          .eq('campeonato_id', id)
        if (targetSlotError) throw targetSlotError
      } catch (swapError) {
        await rollback()
        throw swapError
      }

      return NextResponse.json({
        ok: true,
        mensagem: `Equipes trocadas entre os slots ${source.slot_letra || source.slot_numero} e ${target.slot_letra || target.slot_numero}.`,
      })
    }

    const { error: targetUpdateError } = await supabaseAdmin
      .from('campeonato_slots')
      .update({ equipe_id: source.equipe_id, line_id: source.line_id, status: 'ocupado', updated_at: now })
      .eq('id', targetSlotId)
      .eq('campeonato_id', id)
      .is('equipe_id', null)
      .is('line_id', null)
    if (targetUpdateError) throw targetUpdateError

    const { error: participationUpdateError } = await supabaseAdmin
      .from('campeonato_equipes')
      .update({
        slot_id: targetSlotId,
        grupo_id: target.grupo_id,
        slot_numero: target.slot_numero,
        updated_at: now,
      })
      .eq('id', sourceParticipation.id)
      .eq('campeonato_id', id)
    if (participationUpdateError) {
      await supabaseAdmin.from('campeonato_slots').update({ equipe_id: null, line_id: null, status: 'livre', updated_at: now }).eq('id', targetSlotId)
      throw participationUpdateError
    }

    const { error: sourceUpdateError } = await supabaseAdmin
      .from('campeonato_slots')
      .update({ equipe_id: null, line_id: null, status: 'livre', updated_at: now })
      .eq('id', sourceSlotId)
      .eq('campeonato_id', id)
    if (sourceUpdateError) throw sourceUpdateError

    return NextResponse.json({
      ok: true,
      mensagem: `Equipe movida para o slot ${target.slot_letra || target.slot_numero}.`,
    })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro ao organizar slots.' }, { status: 400 })
  }
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const user = await getBearerUser(req)
    const permission = await getCampeonatoPermission(user.id, id)
    const participacaoId = req.nextUrl.searchParams.get('participacao_id') || ''
    const { data: participacao } = await supabaseAdmin.from('campeonato_equipes').select('id, grupo_id, slot_numero, line_id, criado_por, origem_entrada').eq('id', participacaoId).eq('campeonato_id', id).single()
    if (!participacao) throw new Error('Participação não encontrada.')
    if (permission.role === 'owner' || permission.role === 'manager') {
      if (!permission.canRemove && !permission.canManage) {
        throw new Error('Você não tem permissão para remover equipes deste campeonato.')
      }
    } else if (permission.role === 'seller') {
      if (!permission.canRemove) {
        throw new Error('Este vendedor não pode remover equipes. Solicite ao administrador.')
      }
      const { data: seller, error: sellerError } = await supabaseAdmin
        .from('campeonato_vendedores')
        .select('id,permissoes')
        .eq('campeonato_id', id)
        .eq('manager_auth_user_id', user.id)
        .eq('status', 'ativo')
        .maybeSingle()
      if (sellerError) throw sellerError
      if (!seller) throw new Error('Permissão de vendedor não encontrada para este campeonato.')
      // remoção plena se remover_equipes; senão (legado) só as próprias
      const perms = seller.permissoes || {}
      const fullRemove = perms.remover_equipes === true || perms.remover_equipes === undefined
      const ownOnly = !fullRemove && (perms.remover_proprias_equipes === true || hasSellerPermission(seller, 'remover_proprias_equipes', true))
      if (!fullRemove && !ownOnly) {
        throw new Error('Este vendedor não pode remover equipes.')
      }
      if (!fullRemove) {
        const origemSeller = ['vendedor', 'convite', 'inscricao', 'link']
        if (participacao.criado_por !== user.id || !origemSeller.includes(String(participacao.origem_entrada || ''))) {
          throw new Error('O vendedor só pode remover equipes que ele adicionou.')
        }
      }
    } else {
      throw new Error('Você não tem permissão para remover equipes deste campeonato.')
    }
    await softRemoveParticipacao(participacaoId)
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro ao remover line.' }, { status: 400 })
  }
}
