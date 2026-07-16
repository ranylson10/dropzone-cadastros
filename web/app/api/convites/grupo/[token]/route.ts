import { NextRequest, NextResponse } from 'next/server'
import { getAccountsForUser, getBearerUser } from '@backend/auth/server-auth'
import {
  inserirParticipacaoNoSlot,
  resolveLineForInscricao,
  softRemoveParticipacao,
} from '@backend/campeonatos/participacao-sync'
import {
  buildLinkMetaPayload,
  CAMPEONATO_LINK_SELECT_FULL,
  CAMPEONATO_LINK_SELECT_NO_META,
  encodeLinkDescricao,
  extractHumanDescricao,
  isMissingMetadataColumn,
  linkRestantes,
  parseLinkMetadata,
  resolveLinkLimiteVagas,
  type LinkEntrada,
  type LinkMetadata,
} from '@backend/shared/campeonato-link-metadata'
import { supabaseAdmin } from '@backend/shared/supabase-admin'

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message
  if (error && typeof error === 'object') {
    const maybe = error as { message?: string; details?: string; hint?: string; code?: string }
    const parts = [maybe.message, maybe.details, maybe.hint].filter(Boolean)
    if (parts.length) return parts.join(' | ')
    if (maybe.code) return `${fallback} (${maybe.code})`
  }
  return fallback
}

function isMissingView(error: { code?: string; message?: string } | null | undefined) {
  const msg = String(error?.message || '')
  return error?.code === '42P01' || error?.code === 'PGRST205' || /vw_campeonato_slots_lines/i.test(msg)
}

/** Leitura de link: tenta com metadata; se a coluna não existe no Supabase, cai para descricao. */
async function fetchCampeonatoLink(builder: (columns: string) => any) {
  const withMeta = await builder(CAMPEONATO_LINK_SELECT_FULL)
  if (!withMeta.error) return withMeta
  if (!isMissingMetadataColumn(withMeta.error)) return withMeta
  return builder(CAMPEONATO_LINK_SELECT_NO_META)
}

/**
 * Persiste meta do link em metadata (se existir) e sempre em descricao (fallback).
 * Assim o app funciona mesmo sem a migration da coluna metadata.
 */
async function persistLinkMeta(params: {
  linkId: string
  metaPayload: Record<string, unknown>
  currentDescricao?: string | null
  ativo?: boolean
  onlyIfAtivo?: boolean
}) {
  const human = extractHumanDescricao(params.currentDescricao)
  const descricao = encodeLinkDescricao(params.metaPayload, human)
  const basePatch: Record<string, unknown> = {
    descricao,
    updated_at: new Date().toISOString(),
  }
  if (params.ativo !== undefined) basePatch.ativo = params.ativo

  let query = supabaseAdmin
    .from('campeonato_links')
    .update({ ...basePatch, metadata: params.metaPayload })
    .eq('id', params.linkId)
  if (params.onlyIfAtivo) query = query.eq('ativo', true)

  let { error } = await query
  if (error && isMissingMetadataColumn(error)) {
    let retry = supabaseAdmin
      .from('campeonato_links')
      .update(basePatch)
      .eq('id', params.linkId)
    if (params.onlyIfAtivo) retry = retry.eq('ativo', true)
    const result = await retry
    error = result.error
  }
  if (error) throw error
}

async function loadLinkRowById(linkId: string) {
  const result = await fetchCampeonatoLink((columns) =>
    supabaseAdmin.from('campeonato_links').select(columns).eq('id', linkId).maybeSingle(),
  )
  if (result.error) throw result.error
  return result.data
}

function linkClosedMessage(
  reason: 'limite' | 'grupo_cheio' | 'pausado' | 'expirado' | 'invalido',
  limite?: number,
) {
  if (reason === 'limite') {
    return limite === 1
      ? 'Este link ja foi usado (limite de 1 equipe). Gere um novo link na aba Links.'
      : `Este link esgotou as vagas (limite de ${limite} equipes). Gere um novo link na aba Links.`
  }
  if (reason === 'grupo_cheio') {
    return 'Este link nao pode ser usado: o grupo nao tem slots livres no momento.'
  }
  if (reason === 'expirado') {
    return 'Este link expirou pela data de encerramento definida pelo organizador.'
  }
  if (reason === 'pausado') {
    return 'Este link foi pausado pelo organizador.'
  }
  return 'Link de equipes invalido ou inativo.'
}

async function countSlotsLivres(campeonatoId: string, grupoId: string): Promise<number | null> {
  try {
    const { data: rows, error: viewError } = await supabaseAdmin
      .from('vw_campeonato_slots_lines')
      .select('status_ui,line_id,participacao_id')
      .eq('campeonato_id', campeonatoId)
      .eq('grupo_id', grupoId)

    if (!viewError && rows && rows.length > 0) {
      return rows.filter(
        (row: any) =>
          String(row.status_ui || '') !== 'ocupada'
          && !row.participacao_id
          && !row.line_id,
      ).length
    }

    const { count: livres, error: freeError } = await supabaseAdmin
      .from('campeonato_slots')
      .select('id', { count: 'exact', head: true })
      .eq('campeonato_id', campeonatoId)
      .eq('grupo_id', grupoId)
      .is('line_id', null)
      .is('equipe_id', null)
    if (freeError) return null
    return Number(livres || 0)
  } catch {
    return null
  }
}

/**
 * Checagem SOMENTE LEITURA no GET.
 * Não grava ativo=false aqui — isso confundia com "desativado pelo organizador".
 */
async function evaluateLinkAvailability(link: {
  id: string
  campeonato_id: string
  grupo_id: string
  metadata?: unknown
  descricao?: string | null
  ativo?: boolean
  expira_em?: string | null
}): Promise<'ok' | 'limite' | 'grupo_cheio' | 'pausado' | 'expirado'> {
  if (link.expira_em && new Date(link.expira_em).getTime() < Date.now()) return 'expirado'

  const meta = parseLinkMetadata(link)
  const { data: grupo } = await supabaseAdmin
    .from('campeonato_grupos')
    .select('slots')
    .eq('id', link.grupo_id)
    .maybeSingle()
  const limite = resolveLinkLimiteVagas(meta, grupo?.slots)

  // Esgotado por uso (mesmo se alguém reativou o flag ativo)
  if (meta.usos >= limite || meta.closed_reason === 'limite_atingido') return 'limite'

  if (link.ativo === false) {
    if (meta.closed_reason === 'grupo_cheio') {
      // Revalida: se o grupo voltou a ter vaga, não bloqueia só pelo flag antigo
      const livres = await countSlotsLivres(link.campeonato_id, link.grupo_id)
      if (livres != null && livres > 0) return 'ok'
      return 'grupo_cheio'
    }
    if (meta.closed_reason === 'limite_atingido') return 'limite'
    return 'pausado'
  }

  const livres = await countSlotsLivres(link.campeonato_id, link.grupo_id)
  if (livres === 0) return 'grupo_cheio'
  return 'ok'
}

type LinkAvailability = 'ok' | 'limite' | 'grupo_cheio' | 'pausado' | 'expirado'

async function fetchLinkByToken(token: string) {
  const clean = decodeURIComponent(String(token || '').trim())
  if (!clean) throw new Error(linkClosedMessage('invalido'))

  let link: any = null
  const exact = await fetchCampeonatoLink((columns) =>
    supabaseAdmin
      .from('campeonato_links')
      .select(columns)
      .eq('token', clean)
      .eq('tipo', 'inscricao_equipes_grupo')
      .maybeSingle(),
  )
  if (exact.error) throw exact.error
  link = exact.data

  if (!link) {
    const byUpper = await fetchCampeonatoLink((columns) =>
      supabaseAdmin
        .from('campeonato_links')
        .select(columns)
        .eq('tipo', 'inscricao_equipes_grupo')
        .ilike('token', clean)
        .maybeSingle(),
    )
    if (byUpper.error) throw byUpper.error
    link = byUpper.data
  }

  if (!link) throw new Error(linkClosedMessage('invalido'))
  if (!link.campeonato_id || !link.grupo_id) {
    throw new Error('Este link de grupo esta incompleto no banco.')
  }
  return link
}

/** GET: carrega mesmo esgotado (vira acompanhamento). POST inscrição exige status ok. */
async function resolveLink(token: string): Promise<{ link: any; status: LinkAvailability; limite: number }> {
  const link = await fetchLinkByToken(token)
  const status = await evaluateLinkAvailability(link)
  const meta = parseLinkMetadata(link)
  const { data: grupo } = await supabaseAdmin
    .from('campeonato_grupos')
    .select('slots')
    .eq('id', link.grupo_id)
    .maybeSingle()
  const limite = resolveLinkLimiteVagas(meta, grupo?.slots)
  return { link, status, limite }
}

async function loadLinkForInscricao(token: string) {
  const { link, status, limite } = await resolveLink(token)
  if (status !== 'ok') throw new Error(linkClosedMessage(status, limite))
  return link
}

/** Fecha de verdade só no POST (após uso) ou quando o grupo fica sem slot no aceite. */
async function deactivateGroupLink(
  linkId: string,
  reason: 'limite_atingido' | 'grupo_cheio',
  extraMeta: Record<string, unknown> = {},
) {
  const current = await loadLinkRowById(linkId)
  const meta = parseLinkMetadata(current || {})
  const payload = buildLinkMetaPayload(meta, {
    ...extraMeta,
    closed_reason: reason,
    closed_at: new Date().toISOString(),
  })

  await persistLinkMeta({
    linkId,
    metaPayload: payload,
    currentDescricao: current?.descricao,
    ativo: false,
    onlyIfAtivo: true,
  })
}

async function maybeCloseGroupLinkAfterUse(link: {
  id: string
  campeonato_id: string
  grupo_id: string
  metadata?: unknown
  descricao?: string | null
}): Promise<'limite' | 'grupo_cheio' | null> {
  const meta = parseLinkMetadata(link)
  const { data: grupo } = await supabaseAdmin
    .from('campeonato_grupos')
    .select('slots')
    .eq('id', link.grupo_id)
    .maybeSingle()
  const limite = resolveLinkLimiteVagas(meta, grupo?.slots)
  if (meta.usos >= limite) {
    await deactivateGroupLink(link.id, 'limite_atingido', { limite_vagas: limite, usos: meta.usos })
    return 'limite'
  }

  const livres = await countSlotsLivres(link.campeonato_id, link.grupo_id)
  if (livres === 0) {
    await deactivateGroupLink(link.id, 'grupo_cheio', { limite_vagas: limite, usos: meta.usos })
    return 'grupo_cheio'
  }
  return null
}

/** Consome 1 uso do link; fecha se atingir o limite. Retorna usos após o consumo. */
async function consumirVagaDoLink(link: {
  id: string
  metadata?: unknown
  descricao?: string | null
  grupo_id: string
}) {
  const fresh = await loadLinkRowById(link.id)
  if (!fresh || fresh.ativo === false) throw new Error('Este link de equipes foi desativado pelo organizador.')

  const meta = parseLinkMetadata(fresh)
  const { data: grupo } = await supabaseAdmin
    .from('campeonato_grupos')
    .select('slots')
    .eq('id', fresh.grupo_id)
    .maybeSingle()
  const limite = resolveLinkLimiteVagas(meta, grupo?.slots)
  if (meta.usos >= limite) {
    await deactivateGroupLink(fresh.id, 'limite_atingido', { limite_vagas: limite, usos: meta.usos })
    throw new Error('Este link expirou: o limite de vagas do link foi atingido.')
  }

  const nextUsos = meta.usos + 1
  const atLimit = nextUsos >= limite
  const nextMeta = buildLinkMetaPayload(
    { ...meta, limite_vagas: limite, usos: nextUsos } as LinkMetadata,
    atLimit
      ? { closed_reason: 'limite_atingido', closed_at: new Date().toISOString() }
      : {},
  )

  await persistLinkMeta({
    linkId: fresh.id,
    metaPayload: nextMeta,
    currentDescricao: fresh.descricao,
    ...(atLimit ? { ativo: false } : {}),
    onlyIfAtivo: true,
  })

  return {
    usos: nextUsos,
    limite,
    restantes: Math.max(0, limite - nextUsos),
    entradas: meta.entradas,
  }
}

/** Registra quem entrou no histórico do link (preserva usos/limite). */
async function registrarEntradaNoLink(
  linkId: string,
  entrada: LinkEntrada,
  opts: { limite: number; usos: number },
) {
  const fresh = await loadLinkRowById(linkId)
  if (!fresh) return

  const meta = parseLinkMetadata(fresh)
  const jaTem = meta.entradas.some((item) => item.participacao_id === entrada.participacao_id)
  const entradas = jaTem ? meta.entradas : [...meta.entradas, entrada]
  const usos = Math.max(opts.usos, entradas.length, meta.usos)
  const atLimit = usos >= opts.limite
  const nextMeta = buildLinkMetaPayload(
    {
      ...meta,
      limite_vagas: opts.limite,
      usos,
      entradas,
    } as LinkMetadata,
    atLimit
      ? {
          closed_reason: meta.closed_reason || 'limite_atingido',
          closed_at: meta.closed_at || new Date().toISOString(),
        }
      : {},
  )

  await persistLinkMeta({
    linkId,
    metaPayload: nextMeta,
    currentDescricao: fresh.descricao,
    ...(atLimit ? { ativo: false } : {}),
  })
}

/** Grade do grupo via VIEW (1 query). Fallback se a view nao existir. */
async function loadGrupoVagas(campeonatoId: string, grupoId: string) {
  const { data: rows, error } = await supabaseAdmin
    .from('vw_campeonato_slots_lines')
    .select(
      'slot_id,slot_numero,slot_letra,status_ui,line_id,equipe_id,line_nome,line_logo_url,equipe_nome,nome_exibicao,participacao_id',
    )
    .eq('campeonato_id', campeonatoId)
    .eq('grupo_id', grupoId)
    .order('slot_numero', { ascending: true })

  if (!error && rows) {
    const vagas = rows.map((row: any, index: number) => {
      const ocupada = String(row.status_ui || '') === 'ocupada' || Boolean(row.participacao_id || row.line_id)
      const letra = String(row.slot_letra || '').trim().toUpperCase() || String.fromCharCode(65 + index)
      return {
        index,
        nome: `Slot ${letra}`,
        slot_id: row.slot_id,
        slot_numero: row.slot_numero ?? index + 1,
        slot_letra: letra,
        ocupada,
        equipe_nome: row.equipe_nome || null,
        line_nome: row.line_nome || row.nome_exibicao || null,
        logo_url: row.line_logo_url || null,
        referencia_equipe: ocupada ? row.nome_exibicao || row.line_nome || null : null,
        campeonato_equipe_id: row.participacao_id || null,
      }
    })
    return { vagas, source: 'view' as const }
  }

  if (error && !isMissingView(error)) throw error

  // Fallback: slots + participacoes (sem heal no GET — triggers cuidam do espelho)
  const [{ data: slots, error: slotsError }, { data: parts, error: partsError }] = await Promise.all([
    supabaseAdmin
      .from('campeonato_slots')
      .select('id,slot_numero,slot_letra,equipe_id,line_id')
      .eq('campeonato_id', campeonatoId)
      .eq('grupo_id', grupoId)
      .order('slot_numero', { ascending: true }),
    supabaseAdmin
      .from('campeonato_equipes')
      .select('id,equipe_id,line_id,slot_numero,nome_exibicao')
      .eq('campeonato_id', campeonatoId)
      .eq('grupo_id', grupoId)
      .eq('status', 'ativo'),
  ])
  if (slotsError) throw slotsError
  if (partsError) throw partsError

  const partBySlot = new Map<number, any>()
  for (const part of parts || []) {
    if (part.slot_numero == null) continue
    if (!partBySlot.has(Number(part.slot_numero))) partBySlot.set(Number(part.slot_numero), part)
  }

  const equipeIds = [...new Set((parts || []).map((p) => p.equipe_id).filter(Boolean))]
  const lineIds = [
    ...new Set([
      ...(parts || []).map((p) => p.line_id).filter(Boolean),
      ...(slots || []).map((s) => s.line_id).filter(Boolean),
    ]),
  ]
  const [{ data: equipes }, { data: lines }] = await Promise.all([
    equipeIds.length
      ? supabaseAdmin.from('equipes').select('id,nome,logo_url').in('id', equipeIds)
      : Promise.resolve({ data: [] as any[] }),
    lineIds.length
      ? supabaseAdmin.from('equipe_lines').select('id,nome,logo_url').in('id', lineIds)
      : Promise.resolve({ data: [] as any[] }),
  ])
  const equipeMap = new Map((equipes || []).map((e) => [e.id, e]))
  const lineMap = new Map((lines || []).map((l) => [l.id, l]))

  const vagas = (slots || []).map((slot: any, index: number) => {
    const part = partBySlot.get(Number(slot.slot_numero)) || null
    const line = (slot.line_id && lineMap.get(slot.line_id)) || (part?.line_id && lineMap.get(part.line_id)) || null
    const team =
      (slot.equipe_id && equipeMap.get(slot.equipe_id)) ||
      (part?.equipe_id && equipeMap.get(part.equipe_id)) ||
      null
    const ocupada = Boolean(slot.equipe_id || slot.line_id || part)
    const letra = String(slot.slot_letra || '').trim().toUpperCase() || String.fromCharCode(65 + index)
    return {
      index,
      nome: `Slot ${letra}`,
      slot_id: slot.id,
      slot_numero: slot.slot_numero || index + 1,
      slot_letra: letra,
      ocupada,
      equipe_nome: team?.nome || null,
      line_nome: line?.nome || part?.nome_exibicao || null,
      logo_url: line?.logo_url || team?.logo_url || null,
      referencia_equipe: ocupada ? part?.nome_exibicao || line?.nome || null : null,
      campeonato_equipe_id: part?.id || null,
    }
  })
  return { vagas, source: 'fallback' as const }
}

/** Hub: so carrega jogadores/links se a equipe ja tem part no grupo. */
async function loadMinhasParticipacoes(equipeId: string, campeonatoId: string, grupoId: string) {
  const { data: parts, error } = await supabaseAdmin
    .from('campeonato_equipes')
    .select('id,equipe_id,line_id,grupo_id,slot_numero,slot_id,nome_exibicao')
    .eq('campeonato_id', campeonatoId)
    .eq('grupo_id', grupoId)
    .eq('equipe_id', equipeId)
    .eq('status', 'ativo')
    .order('slot_numero', { ascending: true })
  if (error) throw error
  if (!parts?.length) return [] as any[]

  const partIds = parts.map((p) => p.id)
  const lineIds = parts.map((p) => p.line_id).filter(Boolean)

  const [{ data: lines }, { data: jogadores }, { data: links }] = await Promise.all([
    lineIds.length
      ? supabaseAdmin.from('equipe_lines').select('id,nome,tag,logo_url').in('id', lineIds)
      : Promise.resolve({ data: [] as any[] }),
    supabaseAdmin
      .from('campeonato_jogadores')
      .select('id,campeonato_equipe_id,nick,foto_url,id_jogo,funcao,status,slot_numero')
      .in('campeonato_equipe_id', partIds)
      .eq('status', 'ativo')
      .order('slot_numero', { ascending: true }),
    supabaseAdmin
      .from('campeonato_links_inscricao')
      .select('id,campeonato_equipe_id,token,ativo,expira_em,limite_jogadores,created_at')
      .in('campeonato_equipe_id', partIds)
      .eq('tipo', 'escalacao_line')
      .eq('ativo', true)
      .order('created_at', { ascending: false }),
  ])

  const lineMap = new Map((lines || []).map((l) => [l.id, l]))
  const now = Date.now()
  const linkByPart = new Map<string, any>()
  for (const link of links || []) {
    if (link.expira_em && new Date(link.expira_em).getTime() <= now) continue
    if (!linkByPart.has(link.campeonato_equipe_id)) linkByPart.set(link.campeonato_equipe_id, link)
  }

  return parts.map((part) => {
    const line = part.line_id ? lineMap.get(part.line_id) || null : null
    const players = (jogadores || []).filter((j) => j.campeonato_equipe_id === part.id)
    const link = linkByPart.get(part.id) || null
    const limite = Number(link?.limite_jogadores || 6)
    return {
      id: part.id,
      campeonato_equipe_id: part.id,
      equipe_id: part.equipe_id,
      line_id: part.line_id,
      grupo_id: part.grupo_id,
      slot_id: part.slot_id || null,
      slot_numero: part.slot_numero,
      nome_exibicao: part.nome_exibicao || line?.nome || 'Line',
      line: line ? { id: line.id, nome: line.nome, tag: line.tag, logo_url: line.logo_url } : null,
      jogadores: players,
      quantidade_jogadores: players.length,
      limite_jogadores: limite,
      vagas_disponiveis: Math.max(0, limite - players.length),
      link_escalacao: link
        ? {
            id: link.id,
            token: link.token,
            expira_em: link.expira_em,
            limite_jogadores: limite,
            public_path: `/escala/${link.token}`,
          }
        : null,
    }
  })
}

const emptySession = {
  autenticado: false,
  equipe: null as null,
  lines: [] as any[],
  lines_disponiveis: [] as any[],
  lines_inscritas: [] as any[],
  minhas_participacoes: [] as any[],
  inscrita: false,
  total_lines_inscritas_campeonato: 0,
}

async function sessionTeam(req: NextRequest, campeonatoId: string, grupoId: string) {
  try {
    const user = await getBearerUser(req)
    const accounts = await getAccountsForUser(user)
    const equipe = accounts.find((account) => account.profile_type === 'equipe') || null
    if (!equipe) {
      return {
        ...emptySession,
        autenticado: true,
      }
    }

    // Lines da pasta + parts ativas no campeonato + hub do grupo (em paralelo)
    const [{ data: lines }, { data: participacoesCampeonato }, minhasParticipacoes] = await Promise.all([
      supabaseAdmin
        .from('equipe_lines')
        .select('id,nome,tag,logo_url,status')
        .eq('equipe_id', equipe.id)
        .neq('status', 'inativo')
        .order('created_at', { ascending: true }),
      supabaseAdmin
        .from('campeonato_equipes')
        .select('id,line_id,grupo_id,slot_numero,nome_exibicao')
        .eq('campeonato_id', campeonatoId)
        .eq('equipe_id', equipe.id)
        .eq('status', 'ativo'),
      loadMinhasParticipacoes(equipe.id, campeonatoId, grupoId),
    ])

    const used = new Set((participacoesCampeonato || []).map((item) => item.line_id).filter(Boolean))
    const allLines = (lines || []).map((line) => ({
      ...line,
      ja_inscrita: used.has(line.id),
    }))
    const linesDisponiveis = allLines.filter((line) => !line.ja_inscrita)
    const linesInscritas = allLines
      .filter((line) => line.ja_inscrita)
      .map((line) => {
        const part = (participacoesCampeonato || []).find((p) => p.line_id === line.id)
        return {
          ...line,
          participacao_id: part?.id || null,
          grupo_id: part?.grupo_id || null,
          slot_numero: part?.slot_numero || null,
          nome_exibicao: part?.nome_exibicao || line.nome,
        }
      })

    return {
      autenticado: true,
      equipe: {
        id: equipe.id,
        nome: equipe.name,
        tag: equipe.data?.tag || null,
        logo_url: equipe.data?.logo_url || null,
      },
      lines: allLines,
      lines_disponiveis: linesDisponiveis,
      lines_inscritas: linesInscritas,
      minhas_participacoes: minhasParticipacoes,
      inscrita: minhasParticipacoes.length > 0,
      total_lines_inscritas_campeonato: used.size,
    }
  } catch {
    return { ...emptySession }
  }
}

async function payloadFor(req: NextRequest, token: string) {
  const { link, status, limite } = await resolveLink(token)
  const meta = parseLinkMetadata(link)
  const inscricaoAberta = status === 'ok'

  // 1 link + 3 queries em paralelo (camp/grupo/view + session)
  const [{ data: campeonato, error: campError }, { data: grupo, error: grupoError }, grade, session] =
    await Promise.all([
      supabaseAdmin.from('campeonatos').select('id,nome,logo_url,status').eq('id', link.campeonato_id).single(),
      supabaseAdmin.from('campeonato_grupos').select('id,nome,slots').eq('id', link.grupo_id).single(),
      loadGrupoVagas(link.campeonato_id, link.grupo_id),
      sessionTeam(req, link.campeonato_id, link.grupo_id),
    ])
  if (campError) throw campError
  if (grupoError) throw grupoError

  const vagas = grade.vagas
  const usos = meta.usos
  const restantes = inscricaoAberta ? linkRestantes(meta, grupo?.slots) : 0
  const usedNames = new Set(
    vagas
      .filter((v) => v.ocupada)
      .map((v) => String(v.referencia_equipe || v.line_nome || '').trim().toLowerCase())
      .filter(Boolean),
  )
  // Legado: lista de nomes (links antigos). Links novos só usam limite_vagas.
  const expected = meta.expected_teams
  const equipesEsperadas = expected.map((nome) => ({
    nome,
    disponivel: !usedNames.has(nome.trim().toLowerCase()),
  }))

  return {
    link: {
      token: link.token,
      titulo: link.titulo,
      limite_vagas: limite,
      usos,
      restantes,
      expira_em: link.expira_em || null,
    },
    /** inscricao = ainda aceita equipes; acompanhamento = esgotado/pausado/expirado (só ver). */
    modo: inscricaoAberta ? 'inscricao' : 'acompanhamento',
    inscricao_aberta: inscricaoAberta,
    status_link: status,
    status_mensagem: inscricaoAberta ? null : linkClosedMessage(status, limite),
    campeonato,
    grupo,
    vagas,
    equipes_esperadas: equipesEsperadas,
    equipes_esperadas_disponiveis: equipesEsperadas.filter((item) => item.disponivel).map((item) => item.nome),
    resumo_grupo: {
      total: vagas.length,
      ocupadas: vagas.filter((v) => v.ocupada).length,
      livres: vagas.filter((v) => !v.ocupada).length,
    },
    resumo_link: {
      limite_vagas: limite,
      usos,
      restantes,
    },
    modelo: {
      leitura: grade.source,
      unidade_competitiva: 'line',
    },
    ...session,
  }
}

export async function GET(req: NextRequest, context: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await context.params
    return NextResponse.json(await payloadFor(req, token))
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error, 'Convite invalido.') }, { status: 404 })
  }
}

export async function POST(req: NextRequest, context: { params: Promise<{ token: string }> }) {
  let occupiedSlotId: string | null = null
  let createdParticipacaoId: string | null = null

  try {
    const { token } = await context.params
    const user = await getBearerUser(req)
    const accounts = await getAccountsForUser(user)
    const account = accounts.find((item) => item.profile_type === 'equipe')
    if (!account) throw new Error('Este login ainda nao possui um perfil de equipe vinculado.')

    const body = await req.json().catch(() => ({}))
    const vagaIndex = Number(body.vaga_index)
    const slotIdInformado = String(body.slot_id || '').trim()
    const lineIdInformada = String(body.line_id || '').trim()
    const nomeNovaLine = String(body.nome_line || '').trim()
    const referenciaEquipe = String(body.referencia_equipe || body.nome_lista || '').trim()

    const link = await loadLinkForInscricao(token)
    const meta = parseLinkMetadata(link)
    const expected = meta.expected_teams

    // Resolve slot sem join pesado
    let slot: any = null
    if (slotIdInformado) {
      const { data, error } = await supabaseAdmin
        .from('campeonato_slots')
        .select('id,slot_numero,slot_letra,equipe_id,line_id,grupo_id,campeonato_id')
        .eq('id', slotIdInformado)
        .eq('campeonato_id', link.campeonato_id)
        .eq('grupo_id', link.grupo_id)
        .maybeSingle()
      if (error) throw error
      slot = data
    } else if (Number.isInteger(vagaIndex) && vagaIndex >= 0) {
      const { data: slots, error } = await supabaseAdmin
        .from('campeonato_slots')
        .select('id,slot_numero,slot_letra,equipe_id,line_id,grupo_id,campeonato_id')
        .eq('campeonato_id', link.campeonato_id)
        .eq('grupo_id', link.grupo_id)
        .order('slot_numero', { ascending: true })
      if (error) throw error
      if (!slots?.length) throw new Error('Este grupo ainda nao possui slots. Crie o grupo novamente ou regenere os slots.')
      slot = slots[vagaIndex] || null
    }

    if (!slot) throw new Error('Slot do grupo nao encontrado para a letra selecionada.')
    if (slot.equipe_id || slot.line_id) throw new Error('Esse slot ja foi preenchido. Escolha outra letra.')

    // Lista de referência do admin (obrigatória nos links novos): 1 nome = 1 vaga do link
    if (expected.length) {
      if (!referenciaEquipe) throw new Error('Selecione qual vaga de referência da lista é a sua.')
      const existsInList = expected.some((nome) => nome.trim().toLowerCase() === referenciaEquipe.toLowerCase())
      if (!existsInList) throw new Error('A referência selecionada não está na lista deste link.')

      const refKey = referenciaEquipe.trim().toLowerCase()
      const alreadyOnLink = meta.entradas.some((entrada) => {
        const key = String(entrada.referencia_lista || entrada.equipe_nome || '').trim().toLowerCase()
        return key === refKey
      })
      if (alreadyOnLink) throw new Error('Essa vaga de referência já foi usada neste link.')

      const { data: claimed } = await supabaseAdmin
        .from('campeonato_equipes')
        .select('id,nome_exibicao')
        .eq('campeonato_id', link.campeonato_id)
        .eq('grupo_id', link.grupo_id)
        .eq('status', 'ativo')
      const already = (claimed || []).some(
        (row) => String(row.nome_exibicao || '').trim().toLowerCase() === refKey,
      )
      if (already) throw new Error('Essa vaga de referência já foi reivindicada neste grupo.')
    } else {
      // Links antigos sem lista: ainda funcionam, mas admin deve recriar com lista
    }

    // Consome vaga do link ANTES de gravar (evita overflow se o limite for 1)
    const consumo = await consumirVagaDoLink(link)

    const resolvedLine = await resolveLineForInscricao({
      equipeId: account.id,
      campeonatoId: link.campeonato_id,
      lineId: lineIdInformada || null,
      nomeLine: nomeNovaLine || null,
      tag: account.data?.tag || null,
      logoUrl: account.data?.logo_url || null,
    })

    const nomeExibicao = referenciaEquipe || resolvedLine.nome

    let participacao: any
    try {
      participacao = await inserirParticipacaoNoSlot({
        campeonatoId: link.campeonato_id,
        slotId: slot.id,
        lineId: resolvedLine.id,
        equipeId: account.id,
        nomeExibicao,
        origem: 'link',
        criadoPor: user.id,
      })
    } catch (insertError) {
      // Devolve o uso se a inscrição falhar (preserva histórico de entradas)
      try {
        const rolled = Math.max(0, consumo.usos - 1)
        await persistLinkMeta({
          linkId: link.id,
          metaPayload: buildLinkMetaPayload({
            ...meta,
            limite_vagas: consumo.limite,
            usos: rolled,
            entradas: consumo.entradas || meta.entradas,
          } as LinkMetadata),
          currentDescricao: link.descricao,
          ativo: true,
        })
      } catch {
        // ignore rollback errors
      }
      throw insertError
    }
    createdParticipacaoId = participacao.id
    occupiedSlotId = slot.id

    const letra = String(slot.slot_letra || '').trim().toUpperCase() || String(slot.slot_numero)

    // Histórico: quem entrou por este link (+ referência da lista do admin)
    try {
      await registrarEntradaNoLink(
        link.id,
        {
          participacao_id: String(participacao.id),
          equipe_id: account.id,
          equipe_nome: account.name || null,
          line_id: resolvedLine.id,
          line_nome: resolvedLine.nome || null,
          slot_id: slot.id,
          slot_letra: letra,
          slot_numero: slot.slot_numero != null ? Number(slot.slot_numero) : null,
          referencia_lista: referenciaEquipe || null,
          entrou_em: new Date().toISOString(),
        },
        { limite: consumo.limite, usos: consumo.usos },
      )
    } catch {
      // inscrição ok; histórico é best-effort
    }

    // Fecha só após o aceite: limite do link ou grupo sem slots livres
    try {
      await maybeCloseGroupLinkAfterUse({
        ...link,
        metadata: buildLinkMetaPayload({
          ...meta,
          limite_vagas: consumo.limite,
          usos: consumo.usos,
          entradas: consumo.entradas || meta.entradas,
        }),
        descricao: link.descricao,
      })
    } catch {
      // inscrição já concluída; fechamento do link é best-effort
    }

    return NextResponse.json({
      ok: true,
      participacao,
      equipe: { id: account.id, nome: account.name },
      line: { id: resolvedLine.id, nome: resolvedLine.nome, criada_agora: resolvedLine.criada_agora },
      grupo_id: link.grupo_id,
      slot_id: slot.id,
      slot_letra: letra,
      referencia: referenciaEquipe || resolvedLine.nome || `Slot ${letra}`,
      link: {
        limite_vagas: consumo.limite,
        usos: consumo.usos,
        restantes: consumo.restantes,
        encerrado: consumo.restantes <= 0,
      },
      mensagem: resolvedLine.criada_agora
        ? `Line "${resolvedLine.nome}" criada e inscrita no slot ${letra}.`
        : `Line "${resolvedLine.nome}" inscrita no slot ${letra}.`,
    })
  } catch (error) {
    if (createdParticipacaoId) {
      try {
        await softRemoveParticipacao(createdParticipacaoId)
      } catch {
        // ignore
      }
    }
    return NextResponse.json(
      { error: errorMessage(error, 'Erro ao entrar no grupo.') },
      { status: 400 },
    )
  }
}
