import { NextRequest, NextResponse } from 'next/server'
import { getAccountsForUser, getBearerUser } from '@backend/auth/server-auth'
import { listControllableEquipes } from '@backend/equipes/manager-team-access'
import {
  inserirParticipacaoNoSlot,
  loadParticipacoesLineNoCampeonato,
  markLinesJaInscritas,
  resolveLineForInscricao,
  softRemoveParticipacao,
} from '@backend/campeonatos/participacao-sync'
import {
  buildLinkMetaPayload,
  CAMPEONATO_LINK_SELECT_FULL,
  CAMPEONATO_LINK_SELECT_FULL_LEGACY,
  CAMPEONATO_LINK_SELECT_NO_META,
  CAMPEONATO_LINK_SELECT_NO_META_LEGACY,
  encodeLinkDescricao,
  extractHumanDescricao,
  isMissingConsumeRpc,
  isMissingDeletedAtColumn,
  isMissingMetadataColumn,
  linkRestantes,
  matchExpectedTeamReference,
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

/** Leitura de link: tenta com metadata + deleted_at; degrada se colunas não existirem. */
async function fetchCampeonatoLink(builder: (columns: string) => any) {
  const withMeta = await builder(CAMPEONATO_LINK_SELECT_FULL)
  if (!withMeta.error) return withMeta

  if (isMissingDeletedAtColumn(withMeta.error) && !isMissingMetadataColumn(withMeta.error)) {
    const legacyMeta = await builder(CAMPEONATO_LINK_SELECT_FULL_LEGACY)
    if (!legacyMeta.error || !isMissingMetadataColumn(legacyMeta.error)) return legacyMeta
  }

  if (isMissingMetadataColumn(withMeta.error) || isMissingDeletedAtColumn(withMeta.error)) {
    const noMeta = await builder(CAMPEONATO_LINK_SELECT_NO_META)
    if (!noMeta.error) return noMeta
    if (isMissingDeletedAtColumn(noMeta.error)) {
      return builder(CAMPEONATO_LINK_SELECT_NO_META_LEGACY)
    }
    return noMeta
  }

  return withMeta
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
  reason: 'limite' | 'grupo_cheio' | 'pausado' | 'expirado' | 'excluido' | 'invalido',
  limite?: number,
) {
  // Mensagens voltadas ao convidado (não ao admin) — nunca pedir para "gerar link".
  if (reason === 'limite') {
    return limite === 1
      ? 'Este link já foi utilizado e não aceita novas inscrições.'
      : `Este link esgotou as vagas (limite de ${limite} equipes) e não aceita novas inscrições.`
  }
  if (reason === 'grupo_cheio') {
    return 'O grupo não tem slots livres no momento. Novas inscrições por este link estão encerradas.'
  }
  if (reason === 'expirado') {
    return 'Este link expirou e não aceita mais inscrições.'
  }
  if (reason === 'pausado') {
    return 'Este link foi pausado pelo organizador e não aceita mais inscrições.'
  }
  if (reason === 'excluido') {
    return 'Este link foi encerrado pelo organizador. Você ainda pode acompanhar o grupo.'
  }
  return 'Link de equipes inválido ou inativo.'
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
  deleted_at?: string | null
}): Promise<'ok' | 'limite' | 'grupo_cheio' | 'pausado' | 'expirado' | 'excluido'> {
  const meta = parseLinkMetadata(link)
  if (link.deleted_at || meta.closed_reason === 'excluido') return 'excluido'
  if (link.expira_em && new Date(link.expira_em).getTime() < Date.now()) return 'expirado'

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

type LinkAvailability = 'ok' | 'limite' | 'grupo_cheio' | 'pausado' | 'expirado' | 'excluido'

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

/** Consome 1 uso do link de forma atômica (RPC) com fallback otimista. */
async function consumirVagaDoLink(link: {
  id: string
  metadata?: unknown
  descricao?: string | null
  grupo_id: string
}) {
  // Preferência: RPC com SELECT FOR UPDATE (migration 20260716)
  const rpc = await supabaseAdmin.rpc('fn_consumir_vaga_link_grupo', { p_link_id: link.id })
  if (!rpc.error && rpc.data) {
    const payload = typeof rpc.data === 'string' ? JSON.parse(rpc.data) : rpc.data
    return {
      usos: Number(payload.usos || 0),
      limite: Number(payload.limite || 1),
      restantes: Number(payload.restantes ?? 0),
      entradas: Array.isArray(payload.entradas) ? payload.entradas : parseLinkMetadata(link).entradas,
    }
  }
  if (rpc.error && !isMissingConsumeRpc(rpc.error)) {
    throw new Error(rpc.error.message || 'Não foi possível consumir a vaga deste link.')
  }

  // Fallback sem RPC: retenta se outro request consumiu no meio
  for (let attempt = 0; attempt < 5; attempt++) {
    const fresh = await loadLinkRowById(link.id)
    if (!fresh) throw new Error('Este link de equipes foi desativado pelo organizador.')
    if (fresh.deleted_at) throw new Error('Este link foi excluido pelo organizador.')
    if (fresh.ativo === false) throw new Error('Este link de equipes foi desativado pelo organizador.')

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

    const prevUsos = meta.usos
    const nextUsos = prevUsos + 1
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

    const confirmed = await loadLinkRowById(link.id)
    const confirmedMeta = parseLinkMetadata(confirmed || {})
    // Aceita se o contador ficou no valor que gravamos (ninguém sobrescreveu com valor menor/outro)
    if (confirmedMeta.usos === nextUsos) {
      return {
        usos: nextUsos,
        limite,
        restantes: Math.max(0, limite - nextUsos),
        entradas: meta.entradas,
      }
    }
    // Conflito: tenta de novo
  }

  throw new Error('Muitas equipes tentando entrar ao mesmo tempo. Atualize e tente de novo.')
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

/**
 * Grade do grupo via VIEW (1 query). Fallback se a view nao existir.
 * `refByParticipacaoId`: mapa participacao_id → referência da lista do admin (ex.: ALOE).
 * A referência NÃO é o nome da line — só etiqueta de controle do organizador.
 */
async function loadGrupoVagas(
  campeonatoId: string,
  grupoId: string,
  refByParticipacaoId: Map<string, string> = new Map(),
) {
  const { data: rows, error } = await supabaseAdmin
    .from('vw_campeonato_slots_lines')
    .select(
      'slot_id,slot_numero,slot_letra,status_ui,line_id,equipe_id,line_nome,line_logo_url,equipe_nome,nome_exibicao,participacao_id',
    )
    .eq('campeonato_id', campeonatoId)
    .eq('grupo_id', grupoId)
    .order('slot_numero', { ascending: true })

  if (!error && rows) {
    // View prioriza nome_exibicao (que no legado era a referência do admin).
    // Buscamos o nome real em equipe_lines para não mostrar "ALOE" no lugar de "ALOE PARÁ".
    const lineIds = [...new Set(rows.map((r: any) => r.line_id).filter(Boolean))]
    const lineNameMap = new Map<string, string>()
    if (lineIds.length) {
      const { data: realLines } = await supabaseAdmin
        .from('equipe_lines')
        .select('id,nome')
        .in('id', lineIds)
      for (const line of realLines || []) {
        if (line?.id && line?.nome) lineNameMap.set(String(line.id), String(line.nome))
      }
    }

    const vagas = rows.map((row: any, index: number) => {
      const ocupada = String(row.status_ui || '') === 'ocupada' || Boolean(row.participacao_id || row.line_id)
      const letra = String(row.slot_letra || '').trim().toUpperCase() || String.fromCharCode(65 + index)
      const partId = row.participacao_id ? String(row.participacao_id) : ''
      const realLineNome = row.line_id ? lineNameMap.get(String(row.line_id)) || null : null
      const ref = (partId && refByParticipacaoId.get(partId)) || null
      return {
        index,
        nome: `Slot ${letra}`,
        slot_id: row.slot_id,
        slot_numero: row.slot_numero ?? index + 1,
        slot_letra: letra,
        ocupada,
        equipe_nome: row.equipe_nome || null,
        line_nome: realLineNome || row.line_nome || row.nome_exibicao || null,
        logo_url: row.line_logo_url || null,
        referencia_equipe: ocupada ? ref : null,
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
    const partId = part?.id ? String(part.id) : ''
    const ref = (partId && refByParticipacaoId.get(partId)) || null
    return {
      index,
      nome: `Slot ${letra}`,
      slot_id: slot.id,
      slot_numero: slot.slot_numero || index + 1,
      slot_letra: letra,
      ocupada,
      equipe_nome: team?.nome || null,
      // Nome real da line (não a etiqueta de referência do admin)
      line_nome: line?.nome || part?.nome_exibicao || null,
      logo_url: line?.logo_url || team?.logo_url || null,
      referencia_equipe: ocupada ? ref : null,
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

  // Heal legado: se nome_exibicao era a referência do admin (≠ line.nome), corrige no banco
  const heals: Array<{ id: string; nome: string }> = []
  const result = parts.map((part) => {
    const line = part.line_id ? lineMap.get(part.line_id) || null : null
    const players = (jogadores || []).filter((j) => j.campeonato_equipe_id === part.id)
    const link = linkByPart.get(part.id) || null
    const limite = Number(link?.limite_jogadores || 6)
    // Sempre o nome da line real — nunca a etiqueta de referência do admin (legado em nome_exibicao)
    const nomeLine = String(line?.nome || '').trim() || String(part.nome_exibicao || '').trim() || 'Line'
    const stored = String(part.nome_exibicao || '').trim()
    if (line?.nome && stored && stored.toLowerCase() !== String(line.nome).trim().toLowerCase()) {
      heals.push({ id: part.id, nome: String(line.nome).trim() })
    }
    return {
      id: part.id,
      campeonato_equipe_id: part.id,
      equipe_id: part.equipe_id,
      line_id: part.line_id,
      grupo_id: part.grupo_id,
      slot_id: part.slot_id || null,
      slot_numero: part.slot_numero,
      nome_exibicao: nomeLine,
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

  if (heals.length) {
    void Promise.all(
      heals.map((h) =>
        supabaseAdmin
          .from('campeonato_equipes')
          .update({ nome_exibicao: h.nome, updated_at: new Date().toISOString() })
          .eq('id', h.id),
      ),
    ).catch(() => {
      // best-effort
    })
  }

  return result
}

const emptySession = {
  autenticado: false,
  equipe: null as null,
  equipes_disponiveis: [] as any[],
  papel_sessao: null as null | 'equipe' | 'manager',
  lines: [] as any[],
  lines_disponiveis: [] as any[],
  lines_inscritas: [] as any[],
  minhas_participacoes: [] as any[],
  inscrita: false,
  total_lines_inscritas_campeonato: 0,
}

async function loadSessionForEquipe(equipeId: string, campeonatoId: string, grupoId: string, meta: {
  nome: string
  tag?: string | null
  logo_url?: string | null
  papel?: string
}) {
  const [{ lines, parts: participacoesCampeonato }, minhasParticipacoes] = await Promise.all([
    loadParticipacoesLineNoCampeonato(equipeId, campeonatoId),
    loadMinhasParticipacoes(equipeId, campeonatoId, grupoId),
  ])

  const allLines = markLinesJaInscritas(lines, participacoesCampeonato)
  const linesDisponiveis = allLines.filter((line) => !line.ja_inscrita)
  const linesInscritas = allLines
    .filter((line) => line.ja_inscrita)
    .map((line) => {
      const part = (participacoesCampeonato || []).find(
        (p) =>
          p.line_id === line.id
          || String(p.nome_exibicao || '').trim().toLowerCase() === String(line.nome || '').trim().toLowerCase(),
      )
      return {
        ...line,
        participacao_id: part?.id || null,
        grupo_id: part?.grupo_id || null,
        slot_numero: part?.slot_numero || null,
        nome_exibicao: line.nome || part?.nome_exibicao || null,
      }
    })

  return {
    autenticado: true,
    equipe: {
      id: equipeId,
      nome: meta.nome,
      tag: meta.tag || null,
      logo_url: meta.logo_url || null,
      papel: meta.papel || null,
    },
    lines: linesDisponiveis,
    lines_disponiveis: linesDisponiveis,
    lines_inscritas: linesInscritas,
    lines_ja_no_campeonato: linesInscritas.length,
    minhas_participacoes: minhasParticipacoes,
    inscrita: minhasParticipacoes.length > 0,
    total_lines_inscritas_campeonato: linesInscritas.length,
  }
}

async function sessionTeam(req: NextRequest, campeonatoId: string, grupoId: string) {
  try {
    const user = await getBearerUser(req)
    const accounts = await getAccountsForUser(user)
    const controllable = await listControllableEquipes(user.id, accounts)
    const hasManager = accounts.some((a) => a.profile_type === 'manager')
    const preferredEquipeId = String(req.nextUrl.searchParams.get('equipe_id') || '').trim()

    if (!controllable.length) {
      return {
        ...emptySession,
        autenticado: true,
        papel_sessao: hasManager ? 'manager' : null,
        equipes_disponiveis: [],
      }
    }

    // Manager (ou multi-equipe): lista todas; se só 1, já seleciona
    const papelSessao: 'manager' | 'equipe' = hasManager ? 'manager' : 'equipe'
    let selected = preferredEquipeId
      ? controllable.find((e) => e.id === preferredEquipeId) || null
      : controllable.length === 1
        ? controllable[0]
        : null

    // Usuário só com perfil equipe e uma pasta: mantém fluxo antigo
    if (!selected && !hasManager && controllable.length === 1) {
      selected = controllable[0]
    }

    // Multi-equipe sem preferência: prioriza equipe já inscrita neste grupo
    // (link fechado / acompanhamento → manager ainda precisa gerenciar escalação)
    let equipesInscritasNoGrupo: string[] = []
    if (!selected && controllable.length > 1) {
      const { data: partsInGroup, error: partsInGroupError } = await supabaseAdmin
        .from('campeonato_equipes')
        .select('equipe_id')
        .eq('campeonato_id', campeonatoId)
        .eq('grupo_id', grupoId)
        .eq('status', 'ativo')
        .in(
          'equipe_id',
          controllable.map((e) => e.id),
        )
      if (partsInGroupError) throw partsInGroupError
      equipesInscritasNoGrupo = [
        ...new Set((partsInGroup || []).map((p) => String(p.equipe_id)).filter(Boolean)),
      ]
      if (equipesInscritasNoGrupo.length === 1) {
        selected = controllable.find((e) => e.id === equipesInscritasNoGrupo[0]) || null
      }
    }

    const mapEquipe = (e: (typeof controllable)[number], inscrita?: boolean) => ({
      id: e.id,
      nome: e.nome,
      username: e.username,
      logo_url: e.logo_url,
      tag: e.tag,
      papel: e.papel,
      inscrita_no_grupo: Boolean(inscrita),
    })

    if (!selected) {
      // Marca quais pastas já estão no grupo (UI de escolha / escalação)
      if (!equipesInscritasNoGrupo.length && controllable.length > 1) {
        const { data: partsInGroup } = await supabaseAdmin
          .from('campeonato_equipes')
          .select('equipe_id')
          .eq('campeonato_id', campeonatoId)
          .eq('grupo_id', grupoId)
          .eq('status', 'ativo')
          .in(
            'equipe_id',
            controllable.map((e) => e.id),
          )
        equipesInscritasNoGrupo = [
          ...new Set((partsInGroup || []).map((p) => String(p.equipe_id)).filter(Boolean)),
        ]
      }
      const inscribed = new Set(equipesInscritasNoGrupo)
      return {
        ...emptySession,
        autenticado: true,
        papel_sessao: papelSessao,
        equipes_disponiveis: controllable.map((e) => mapEquipe(e, inscribed.has(e.id))),
        tem_equipe_inscrita_no_grupo: inscribed.size > 0,
      }
    }

    const session = await loadSessionForEquipe(selected.id, campeonatoId, grupoId, {
      nome: selected.nome,
      tag: selected.tag,
      logo_url: selected.logo_url,
      papel: selected.papel,
    })

    return {
      ...session,
      papel_sessao: papelSessao,
      equipes_disponiveis: controllable.map((e) =>
        mapEquipe(e, e.id === selected!.id ? session.inscrita : undefined),
      ),
      tem_equipe_inscrita_no_grupo: Boolean(session.inscrita),
    }
  } catch {
    return { ...emptySession }
  }
}

async function payloadFor(req: NextRequest, token: string) {
  const { link, status, limite } = await resolveLink(token)
  const meta = parseLinkMetadata(link)
  const inscricaoAberta = status === 'ok'

  // Mapa participacao → referência da lista do admin (só controle; não é o nome da line)
  const refByParticipacaoId = new Map<string, string>()
  for (const entrada of meta.entradas || []) {
    const partId = String(entrada.participacao_id || '').trim()
    const ref = String(entrada.referencia_lista || '').trim()
    if (partId && ref && !refByParticipacaoId.has(partId)) {
      refByParticipacaoId.set(partId, ref)
    }
  }

  // 1 link + 3 queries em paralelo (camp/grupo/view + session)
  const [{ data: campeonato, error: campError }, { data: grupo, error: grupoError }, grade, session, temaRes] =
    await Promise.all([
      supabaseAdmin.from('campeonatos').select('id,nome,logo_url,status').eq('id', link.campeonato_id).single(),
      supabaseAdmin.from('campeonato_grupos').select('id,nome,slots').eq('id', link.grupo_id).single(),
      loadGrupoVagas(link.campeonato_id, link.grupo_id, refByParticipacaoId),
      sessionTeam(req, link.campeonato_id, link.grupo_id),
      supabaseAdmin
        .from('campeonato_configuracoes')
        .select('cor_principal,cor_secundaria,cor_texto_clara,cor_texto_escura,bg_opacidade,bg_image_url')
        .eq('campeonato_id', link.campeonato_id)
        .maybeSingle(),
    ])
  if (campError) throw campError
  if (grupoError) throw grupoError
  const tema = temaRes.error ? null : temaRes.data

  const vagasBase = grade.vagas
  const usos = meta.usos
  const restantes = inscricaoAberta ? linkRestantes(meta, grupo?.slots) : 0
  // Referências já usadas = entradas do link com referencia_lista (fonte da verdade do admin)
  const usedNames = new Set(
    (meta.entradas || [])
      .map((e) => String(e.referencia_lista || '').trim().toLowerCase())
      .filter(Boolean),
  )
  // Legado: lista de nomes (links antigos). Links novos só usam limite_vagas.
  const expected = meta.expected_teams
  const equipesEsperadas = expected.map((nome) => ({
    nome,
    disponivel: !usedNames.has(nome.trim().toLowerCase()),
    status: usedNames.has(nome.trim().toLowerCase()) ? ('inscrita' as const) : ('pendente' as const),
    entrada:
      (meta.entradas || []).find(
        (e) => String(e.referencia_lista || '').trim().toLowerCase() === nome.trim().toLowerCase(),
      ) || null,
  }))

  // Jogadores públicos por participação (acompanhamento: clicar na equipe)
  const partIds = vagasBase.map((v) => v.campeonato_equipe_id).filter(Boolean) as string[]
  let jogadoresByPart = new Map<string, any[]>()
  if (partIds.length) {
    const { data: jogadores } = await supabaseAdmin
      .from('campeonato_jogadores')
      .select('id,campeonato_equipe_id,nick,foto_url,id_jogo,funcao,status,slot_numero')
      .in('campeonato_equipe_id', partIds)
      .eq('status', 'ativo')
      .order('slot_numero', { ascending: true })
    for (const player of jogadores || []) {
      const key = String(player.campeonato_equipe_id)
      const list = jogadoresByPart.get(key) || []
      list.push(player)
      jogadoresByPart.set(key, list)
    }
  }
  const vagas = vagasBase.map((vaga) => {
    const partId = vaga.campeonato_equipe_id ? String(vaga.campeonato_equipe_id) : ''
    const players = partId ? jogadoresByPart.get(partId) || [] : []
    return {
      ...vaga,
      jogadores: players,
      quantidade_jogadores: players.length,
    }
  })

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
    tema: {
      cor_principal: tema?.cor_principal || '#ff4655',
      cor_secundaria: tema?.cor_secundaria || '#17191d',
      bg_opacidade: tema?.bg_opacidade != null ? Number(tema.bg_opacidade) : 18,
      bg_image_url: tema?.bg_image_url || null,
      cor_texto_clara: tema?.cor_texto_clara || '#ffffff',
      cor_texto_escura: tema?.cor_texto_escura || '#17191d',
    },
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
      // UI pede slot; se omitido, servidor ainda preenche o primeiro livre
      auto_slot: true,
      escolher_slot: true,
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
    const body = await req.json().catch(() => ({}))
    const vagaIndex = Number(body.vaga_index)
    const slotIdInformado = String(body.slot_id || '').trim()
    const lineIdInformada = String(body.line_id || '').trim()
    const nomeNovaLine = String(body.nome_line || '').trim()
    const equipeIdInformada = String(body.equipe_id || '').trim()
    // referência da lista é opcional/legado; preferimos match automático
    const referenciaInformada = String(body.referencia_equipe || body.nome_lista || '').trim()

    const controllable = await listControllableEquipes(user.id, accounts)
    if (!controllable.length) {
      throw new Error('Este login não controla nenhuma equipe. Crie ou aceite um convite de staff primeiro.')
    }
    const selectedTeam = equipeIdInformada
      ? controllable.find((e) => e.id === equipeIdInformada)
      : controllable.length === 1
        ? controllable[0]
        : null
    if (!selectedTeam) {
      throw new Error('Selecione com qual equipe deseja entrar neste campeonato.')
    }
    const account = {
      id: selectedTeam.id,
      name: selectedTeam.nome,
      data: { tag: selectedTeam.tag, logo_url: selectedTeam.logo_url },
    }

    const link = await loadLinkForInscricao(token)
    const meta = parseLinkMetadata(link)
    const expected = meta.expected_teams

    // Resolve slot: informado, índice, ou primeiro livre (auto-slot)
    // Considera tanto colunas do slot quanto participações ativas (evita desync do espelho).
    let slot: any = null
    const [{ data: slotsGrupo, error: slotsError }, { data: partsAtivas, error: partsErr }] =
      await Promise.all([
        supabaseAdmin
          .from('campeonato_slots')
          .select('id,slot_numero,slot_letra,equipe_id,line_id,grupo_id,campeonato_id')
          .eq('campeonato_id', link.campeonato_id)
          .eq('grupo_id', link.grupo_id)
          .order('slot_numero', { ascending: true }),
        supabaseAdmin
          .from('campeonato_equipes')
          .select('id,slot_id,slot_numero,line_id')
          .eq('campeonato_id', link.campeonato_id)
          .eq('grupo_id', link.grupo_id)
          .eq('status', 'ativo'),
      ])
    if (slotsError) throw slotsError
    if (partsErr) throw partsErr
    if (!slotsGrupo?.length) {
      throw new Error('Este grupo ainda nao possui slots. Crie o grupo novamente ou regenere os slots.')
    }

    const occupiedSlotIds = new Set(
      (partsAtivas || []).map((p) => p.slot_id).filter(Boolean).map(String),
    )
    const occupiedSlotNums = new Set(
      (partsAtivas || [])
        .map((p) => (p.slot_numero != null ? Number(p.slot_numero) : null))
        .filter((n) => n != null && Number.isFinite(n)),
    )
    const isSlotFree = (s: any) =>
      !s.equipe_id
      && !s.line_id
      && !occupiedSlotIds.has(String(s.id))
      && !occupiedSlotNums.has(Number(s.slot_numero))

    if (slotIdInformado) {
      slot = slotsGrupo.find((s) => s.id === slotIdInformado) || null
    } else if (Number.isInteger(vagaIndex) && vagaIndex >= 0) {
      slot = slotsGrupo[vagaIndex] || null
    } else {
      slot = slotsGrupo.find((s) => isSlotFree(s)) || null
    }

    if (!slot) throw new Error('Nenhum slot livre neste grupo no momento.')
    if (!isSlotFree(slot)) throw new Error('Esse slot ja foi preenchido. Tente novamente.')

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

    // nome_exibicao = nome real da line, nunca a etiqueta de referência do admin
    const nomeExibicao = resolvedLine.nome

    // Match automático da lista interna (não bloqueia inscrição)
    const claimedRefs = (meta.entradas || [])
      .map((e) => String(e.referencia_lista || '').trim())
      .filter(Boolean)
    let referenciaEquipe = referenciaInformada || ''
    if (expected.length) {
      if (referenciaEquipe) {
        const existsInList = expected.some((nome) => nome.trim().toLowerCase() === referenciaEquipe.toLowerCase())
        if (!existsInList) referenciaEquipe = ''
        else {
          const alreadyOnLink = claimedRefs.some((key) => key.toLowerCase() === referenciaEquipe.toLowerCase())
          if (alreadyOnLink) referenciaEquipe = ''
        }
      }
      if (!referenciaEquipe) {
        referenciaEquipe =
          matchExpectedTeamReference({
            expectedTeams: expected,
            claimedReferences: claimedRefs,
            equipeNome: account.name,
            lineNome: resolvedLine.nome,
          }) || ''
      }
    }

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

    // Histórico: quem entrou por este link (+ match automático na lista do admin)
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

    // valor de inscrição (se houver) — frontend pode abrir ASAAS
    let valorInscricao: number | null = null
    try {
      const { data: cfg } = await supabaseAdmin
        .from('campeonato_configuracoes')
        .select('valor_inscricao')
        .eq('campeonato_id', link.campeonato_id)
        .maybeSingle()
      if (cfg?.valor_inscricao != null && Number(cfg.valor_inscricao) > 0) {
        valorInscricao = Number(cfg.valor_inscricao)
      }
    } catch {
      // ignore
    }

    return NextResponse.json({
      ok: true,
      participacao,
      campeonato_equipe_id: participacao?.id || createdParticipacaoId,
      equipe: { id: account.id, nome: account.name },
      line: { id: resolvedLine.id, nome: resolvedLine.nome, criada_agora: resolvedLine.criada_agora },
      grupo_id: link.grupo_id,
      slot_id: slot.id,
      slot_letra: letra,
      referencia: referenciaEquipe || resolvedLine.nome || `Slot ${letra}`,
      valor_inscricao: valorInscricao,
      precisa_pagamento: Boolean(valorInscricao && valorInscricao >= 1),
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
