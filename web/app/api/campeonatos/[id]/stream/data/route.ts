import { NextRequest, NextResponse } from 'next/server'
import { getBearerUser } from '@backend/auth/server-auth'
import { getCampeonatoPermission } from '@backend/campeonatos/campeonato-permissions'
import { listarEstatisticasEquipes, listarEstatisticasMvp } from '@backend/campeonatos/estatisticas/estatisticas.service'
import {
  loadPartidasForStream,
  resolveStreamContext,
} from '@backend/campeonatos/stream/stream-context'
import { supabaseAdmin } from '@backend/shared/supabase-admin'

/**
 * Dados de planilha Stream com service_role (partidas/mapas confiáveis).
 * GET ?sheet=mapas|partidas|equipes_geral|...
 * ?jogo_id= — força um jogo; se omitido, usa contexto da live (pack / auto).
 * ?scope=all — ignora filtro de jogo (todas as partidas do campeonato).
 */
function canStream(permission: Awaited<ReturnType<typeof getCampeonatoPermission>>) {
  return (
    permission.role === 'owner'
    || permission.role === 'manager'
    || permission.canManage
    || permission.canOrganizeGroups
    || permission.canManageGames
    || permission.canScore
    || permission.canView
  )
}

const MAP_IMAGES: Record<string, string> = {
  bermuda: '/images/maps/bermuda.png',
  purgatorio: '/images/maps/purgatorio.png',
  purgatório: '/images/maps/purgatorio.png',
  'nova terra': '/images/maps/nova-terra.png',
  'nova-terra': '/images/maps/nova-terra.png',
  kalahari: '/images/maps/kalahari.png',
  alpine: '/images/maps/alpine.png',
  solara: '/images/maps/solara.png',
  misterioso: '/images/maps/misterioso.png',
}

function mapImageFor(name: string, fallback?: string | null) {
  if (fallback) return String(fallback)
  const key = String(name || '').toLowerCase()
  const hit = Object.entries(MAP_IMAGES).find(([k]) => key.includes(k))
  return hit?.[1] || '/images/maps/bermuda.png'
}

function text(v: unknown) {
  if (v == null) return ''
  return String(v)
}

function groupLetter(value: unknown) {
  const raw = text(value).trim()
  if (!raw) return ''
  const match = raw.match(/\b([A-Za-z])\b/) || raw.match(/([A-Za-z])/)
  return (match?.[1] || raw.charAt(0)).toUpperCase()
}

function pickCurrentAndNextPartida(partidas: any[]) {
  if (!partidas.length) return { current: null as any, next: null as any }
  const liveIndex = partidas.findIndex((p) => /em_andamento|andamento|live|ao.?vivo|em_jogo/i.test(text(p.status)))
  if (liveIndex >= 0) return { current: partidas[liveIndex], next: partidas[liveIndex + 1] || null }
  let lastDone = -1
  for (let i = 0; i < partidas.length; i += 1) {
    if (/finaliz|conclu|encerr|done|finished/i.test(text(partidas[i].status))) lastDone = i
  }
  if (lastDone >= 0) return { current: partidas[lastDone], next: partidas[lastDone + 1] || null }
  return { current: partidas[0], next: partidas[1] || partidas[0] }
}

function teamStatsRows(equipes: any[], slots: any[] = [], compact = false) {
  const slotMap = new Map(slots.map((row: any) => [text(row.campeonato_equipe_id), row]))
  return equipes.map((row: any, index: number) => {
    const id = text(row.campeonato_equipe_id || row.id || `eq-${index}`)
    const slot = slotMap.get(id)
    return {
      id,
      cells: {
        pos: text(row.colocacao ?? index + 1),
        slot: text(slot?.slot_numero ?? row.slot_numero ?? ''),
        logo: text(row.logo_url || slot?.equipe_logo_url || ''),
        nome: text(row.nome || row.line_nome || slot?.equipe_nome || '—'),
        grupo: groupLetter(slot?.grupo_nome || row.grupo_nome || row.grupo_id || ''),
        quedas: text(row.quedas ?? 0),
        booyahs: text(row.booyahs ?? row.booyah ?? 0),
        abates: text(row.abates ?? 0),
        pontos_posicao: text(row.pontos_posicao ?? 0),
        pontos_abates: text(row.pontos_abates ?? 0),
        pontos: text(row.pontos_total ?? row.pontos ?? 0),
        ...(compact ? {} : { delta: '0 =' }),
      },
    }
  })
}

async function loadGameSlots(campeonatoId: string, jogoId?: string | null) {
  if (!jogoId) return []
  const { data, error } = await supabaseAdmin
    .from('campeonato_pontuador_slots_jogo')
    .select('campeonato_equipe_id,equipe_nome,equipe_tag,equipe_logo_url,grupo_id,grupo_nome,slot_numero,slot_vazio')
    .eq('campeonato_id', campeonatoId)
    .eq('jogo_id', jogoId)
    .eq('slot_vazio', false)
    .order('grupo_nome', { ascending: true })
    .order('slot_numero', { ascending: true })
  if (error) throw error
  return data || []
}

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await getBearerUser(req)
    const { id: campeonatoId } = await context.params
    const permission = await getCampeonatoPermission(user.id, campeonatoId)
    if (!canStream(permission)) {
      return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 })
    }

    const sheet = req.nextUrl.searchParams.get('sheet') || 'mapas'
    const grupoId = req.nextUrl.searchParams.get('grupo_id')
    const partidaId = req.nextUrl.searchParams.get('partida_id')
    const mapaCodigo = req.nextUrl.searchParams.get('mapa_codigo')
    const faseId = req.nextUrl.searchParams.get('fase_id')
    const scopeAll = req.nextUrl.searchParams.get('scope') === 'all'
    const jogoIdParam = req.nextUrl.searchParams.get('jogo_id')

    const streamCtx = await resolveStreamContext(campeonatoId)
    const resolvedJogoId = scopeAll
      ? null
      : (jogoIdParam || streamCtx.activeJogoId || null)

    // Partidas com mapa (fonte oficial do pontuador), filtradas pelo jogo ativo
    let partidas = await loadPartidasForStream(campeonatoId, resolvedJogoId)

    // nomes dos jogos
    const jogoIds = [...new Set(partidas.map((p: any) => p.jogo_id).filter(Boolean))]
    // se filtro zerou partidas, ainda precisamos do nome do jogo ativo
    if (resolvedJogoId && !jogoIds.includes(resolvedJogoId)) jogoIds.push(resolvedJogoId)

    const jogosMap = new Map<string, any>()
    if (jogoIds.length) {
      const { data: jogos } = await supabaseAdmin
        .from('campeonato_jogos')
        .select('id, nome, status, fase_id, data_jogo, horario')
        .in('id', jogoIds)
      for (const j of jogos || []) jogosMap.set(j.id, j)
    }

    // catálogo de mapas (imagem oficial)
    const { data: mapasCat } = await supabaseAdmin
      .from('dropzone_mapas')
      .select('codigo, nome, imagem_url')
      .eq('ativo', true)
    const mapaByCode = new Map((mapasCat || []).map((m: any) => [String(m.codigo || '').toLowerCase(), m]))

    const partidasNorm = partidas.map((p: any) => {
      const codigo = text(p.mapa_codigo || '').toLowerCase()
      const cat = mapaByCode.get(codigo)
      const nome = text(p.mapa_nome || cat?.nome || p.mapa_codigo || 'Mapa')
      const jogo = jogosMap.get(p.jogo_id)
      return {
        id: text(p.id),
        jogoId: text(p.jogo_id),
        jogoNome: text(jogo?.nome || p.jogo_nome || ''),
        faseId: text(p.fase_id || jogo?.fase_id || ''),
        grupoId: text(p.grupo_id || ''),
        numero: Number(p.numero_partida ?? p.numero ?? 0),
        mapa: nome,
        mapaCodigo: codigo || nome,
        mapaImagem: mapImageFor(nome, p.mapa_imagem_url || cat?.imagem_url || null),
        status: text(p.status || ''),
        horario: text(p.horario || jogo?.horario || ''),
      }
    }).filter((p) => p.id)

    const contextPayload = {
      active_jogo_id: resolvedJogoId,
      active_jogo: resolvedJogoId
        ? (streamCtx.activeJogo && streamCtx.activeJogo.id === resolvedJogoId
          ? streamCtx.activeJogo
          : (() => {
              const j = jogosMap.get(resolvedJogoId)
              return j
                ? {
                    id: j.id,
                    nome: j.nome,
                    status: j.status || '',
                    data_jogo: j.data_jogo || null,
                    horario: j.horario || null,
                    numero_partidas: 0,
                  }
                : null
            })())
        : streamCtx.activeJogo,
      source: jogoIdParam ? 'query' : (scopeAll ? 'all' : streamCtx.source),
      jogos: streamCtx.jogos,
    }

    if (sheet === 'context' || sheet === 'jogos_context') {
      return NextResponse.json({ context: contextPayload })
    }

    if (sheet === 'partidas') {
      return NextResponse.json({ partidas: partidasNorm, context: contextPayload })
    }

    if (sheet === 'mapas') {
      const rows = []
      for (const p of partidasNorm) {
        let stats: any[] = []
        try {
          stats = await listarEstatisticasEquipes(campeonatoId, {
            partidaId: p.id,
            grupoId: grupoId || undefined,
          })
        } catch {
          stats = []
        }
        const winner =
          stats.find((e) => Number(e.booyahs) > 0)
          || stats.find((e) => Number(e.melhor_posicao) === 1)
          || stats[0]
          || null

        rows.push({
          id: p.id,
          cells: {
            imagem: p.mapaImagem,
            nome: p.mapa.toUpperCase(),
            mapa: p.mapa.toUpperCase(),
            booyah_logo: text(winner?.logo_url || ''),
            booyah_nome: text(winner?.nome || winner?.line_nome || (stats.length ? '—' : 'sem pontuação')),
            pontos: text(winner?.pontos_total ?? 0),
            abates: text(winner?.abates ?? 0),
            jogo: p.jogoNome,
            queda: text(p.numero),
            grupo: text(p.grupoId || ''),
            status: p.status || '',
            partida_id: p.id,
          },
        })
      }
      return NextResponse.json({
        rows,
        partidas: partidasNorm,
        count: rows.length,
        context: contextPayload,
      })
    }

    const jogoIdForStats = jogoIdParam || resolvedJogoId || undefined

    if (sheet === 'equipes_jogo') {
      const slots = await loadGameSlots(campeonatoId, jogoIdForStats)
      const rows = slots.map((row: any, index: number) => ({
        id: text(row.campeonato_equipe_id || `slot-${index}`),
        cells: {
          slot: text(row.slot_numero ?? index + 1),
          logo: text(row.equipe_logo_url || ''),
          nome: text(row.equipe_nome || '—'),
          grupo: groupLetter(row.grupo_nome || row.grupo_id || ''),
        },
      }))
      return NextResponse.json({ rows, context: contextPayload })
    }

    if (sheet === 'equipes_partida') {
      const selectedPartidaId = partidaId || pickCurrentAndNextPartida(partidasNorm).current?.id || null
      if (!selectedPartidaId) return NextResponse.json({ rows: [], context: contextPayload, reason: 'partida_required' })
      const [equipes, slots] = await Promise.all([
        listarEstatisticasEquipes(campeonatoId, { partidaId: selectedPartidaId }),
        loadGameSlots(campeonatoId, jogoIdForStats),
      ])
      return NextResponse.json({
        rows: teamStatsRows(equipes, slots, true),
        partida_id: selectedPartidaId,
        context: contextPayload,
      })
    }

    if (sheet === 'equipes_mapa') {
      const picked = pickCurrentAndNextPartida(partidasNorm)
      const target = mapaCodigo
        ? partidasNorm.find((p: any) => text(p.mapaCodigo) === mapaCodigo || text(p.mapa) === mapaCodigo)
        : (picked.next || picked.current)
      const targetMap = mapaCodigo || target?.mapaCodigo || target?.mapa || null
      const [stats, slots] = await Promise.all([
        targetMap
          ? listarEstatisticasEquipes(campeonatoId, { jogoId: jogoIdForStats, mapaCodigo: targetMap })
          : Promise.resolve([]),
        loadGameSlots(campeonatoId, jogoIdForStats),
      ])
      const byId = new Map(stats.map((row: any) => [text(row.campeonato_equipe_id), row]))
      const merged = slots.map((slot: any) => byId.get(text(slot.campeonato_equipe_id)) || {
        campeonato_equipe_id: slot.campeonato_equipe_id,
        nome: slot.equipe_nome,
        logo_url: slot.equipe_logo_url,
        grupo_nome: slot.grupo_nome,
        slot_numero: slot.slot_numero,
        quedas: 0,
        booyahs: 0,
        abates: 0,
        pontos_total: 0,
      })
      const rows = teamStatsRows(merged, slots)
      return NextResponse.json({
        rows,
        mapa_codigo: targetMap,
        mapa_nome: target?.mapa || targetMap,
        partida_id: target?.id || null,
        context: contextPayload,
      })
    }

    if (sheet === 'mvp_dia') {
      const jogadores = await listarEstatisticasMvp(campeonatoId, { jogoId: jogoIdForStats })
      return NextResponse.json({ jogadores, context: contextPayload })
    }

    if (sheet === 'mvp_partida') {
      const selectedPartidaId = partidaId || pickCurrentAndNextPartida(partidasNorm).current?.id || null
      if (!selectedPartidaId) return NextResponse.json({ jogadores: [], context: contextPayload, reason: 'partida_required' })
      const jogadores = await listarEstatisticasMvp(campeonatoId, { partidaId: selectedPartidaId })
      return NextResponse.json({ jogadores, partida_id: selectedPartidaId, context: contextPayload })
    }

    if (sheet === 'jogadores_mapa') {
      const picked = pickCurrentAndNextPartida(partidasNorm)
      const target = mapaCodigo
        ? partidasNorm.find((p: any) => text(p.mapaCodigo) === mapaCodigo || text(p.mapa) === mapaCodigo)
        : (picked.next || picked.current)
      const targetMap = mapaCodigo || target?.mapaCodigo || target?.mapa || null
      const jogadores = targetMap
        ? await listarEstatisticasMvp(campeonatoId, { jogoId: jogoIdForStats, mapaCodigo: targetMap })
        : []
      return NextResponse.json({
        jogadores,
        mapa_codigo: targetMap,
        mapa_nome: target?.mapa || targetMap,
        partida_id: target?.id || null,
        context: contextPayload,
      })
    }

    if (sheet === 'equipes' || sheet === 'equipes_geral') {
      const equipes = await listarEstatisticasEquipes(campeonatoId, {
        faseId: faseId || undefined,
        jogoId: jogoIdForStats || undefined,
        partidaId: partidaId || undefined,
        mapaCodigo: mapaCodigo || undefined,
        grupoId: grupoId || undefined,
      })
      return NextResponse.json({ equipes, partidas: partidasNorm, context: contextPayload })
    }

    if (sheet === 'mvp') {
      const jogadores = await listarEstatisticasMvp(campeonatoId, {
        faseId: faseId || undefined,
        jogoId: jogoIdForStats || undefined,
        partidaId: partidaId || undefined,
        mapaCodigo: mapaCodigo || undefined,
        grupoId: grupoId || undefined,
      })
      return NextResponse.json({ jogadores, partidas: partidasNorm, context: contextPayload })
    }

    return NextResponse.json({ error: 'sheet inválido' }, { status: 400 })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro ao carregar dados stream.' }, { status: 400 })
  }
}
