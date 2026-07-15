import { NextRequest, NextResponse } from 'next/server'
import { getAccountsForUser, getBearerUser } from '@backend/auth/server-auth'
import {
  inserirParticipacaoNoSlot,
  resolveLineForInscricao,
  softRemoveParticipacao,
} from '@backend/campeonatos/participacao-sync'
import { parseLinkMetadata } from '@backend/shared/campeonato-link-metadata'
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

async function loadLink(token: string) {
  const clean = decodeURIComponent(String(token || '').trim())
  if (!clean) throw new Error('Link de equipes invalido ou inativo.')

  let link: any = null
  const exact = await supabaseAdmin
    .from('campeonato_links')
    .select('id,token,titulo,tipo,ativo,expira_em,campeonato_id,grupo_id,metadata,descricao')
    .eq('token', clean)
    .eq('tipo', 'inscricao_equipes_grupo')
    .maybeSingle()
  if (exact.error) throw exact.error
  link = exact.data

  if (!link) {
    const byUpper = await supabaseAdmin
      .from('campeonato_links')
      .select('id,token,titulo,tipo,ativo,expira_em,campeonato_id,grupo_id,metadata,descricao')
      .eq('tipo', 'inscricao_equipes_grupo')
      .ilike('token', clean.toUpperCase())
      .maybeSingle()
    if (byUpper.error) throw byUpper.error
    link = byUpper.data
  }

  if (!link) throw new Error('Link de equipes invalido ou inativo.')
  if (link.ativo === false) throw new Error('Este link de equipes foi desativado pelo organizador.')
  if (link.expira_em && new Date(link.expira_em).getTime() < Date.now()) throw new Error('Link de equipes expirado.')
  if (!link.campeonato_id || !link.grupo_id) throw new Error('Este link de grupo esta incompleto no banco.')
  return link
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
  const link = await loadLink(token)
  const expected = parseLinkMetadata(link).expected_teams

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
  const usedNames = new Set(
    vagas
      .filter((v) => v.ocupada)
      .map((v) => String(v.referencia_equipe || v.line_nome || '').trim().toLowerCase())
      .filter(Boolean),
  )
  const equipesEsperadas = expected.map((nome) => ({
    nome,
    disponivel: !usedNames.has(nome.trim().toLowerCase()),
  }))

  return {
    link: { token: link.token, titulo: link.titulo },
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

    const link = await loadLink(token)
    const expected = parseLinkMetadata(link).expected_teams

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

    if (expected.length) {
      if (!referenciaEquipe) throw new Error('Selecione qual equipe da lista voce esta representando.')
      const existsInList = expected.some((nome) => nome.trim().toLowerCase() === referenciaEquipe.toLowerCase())
      if (!existsInList) throw new Error('A equipe selecionada nao esta na lista deste grupo.')

      const { data: claimed } = await supabaseAdmin
        .from('campeonato_equipes')
        .select('id,nome_exibicao')
        .eq('campeonato_id', link.campeonato_id)
        .eq('grupo_id', link.grupo_id)
        .eq('status', 'ativo')
      const already = (claimed || []).some(
        (row) => String(row.nome_exibicao || '').trim().toLowerCase() === referenciaEquipe.toLowerCase(),
      )
      if (already) throw new Error('Essa equipe da lista ja foi reivindicada neste grupo.')
    }

    const resolvedLine = await resolveLineForInscricao({
      equipeId: account.id,
      campeonatoId: link.campeonato_id,
      lineId: lineIdInformada || null,
      nomeLine: nomeNovaLine || null,
      tag: account.data?.tag || null,
      logoUrl: account.data?.logo_url || null,
    })

    const nomeExibicao = referenciaEquipe || resolvedLine.nome

    const participacao = await inserirParticipacaoNoSlot({
      campeonatoId: link.campeonato_id,
      slotId: slot.id,
      lineId: resolvedLine.id,
      equipeId: account.id,
      nomeExibicao,
      origem: 'inscricao',
      criadoPor: user.id,
    })
    createdParticipacaoId = participacao.id
    occupiedSlotId = slot.id

    const letra = String(slot.slot_letra || '').trim().toUpperCase() || String(slot.slot_numero)
    return NextResponse.json({
      ok: true,
      participacao,
      equipe: { id: account.id, nome: account.name },
      line: { id: resolvedLine.id, nome: resolvedLine.nome, criada_agora: resolvedLine.criada_agora },
      grupo_id: link.grupo_id,
      slot_id: slot.id,
      slot_letra: letra,
      referencia: referenciaEquipe || resolvedLine.nome || `Slot ${letra}`,
      mensagem: resolvedLine.criada_agora
        ? `Line "${resolvedLine.nome}" criada e inscrita no slot ${letra}.`
        : `Line "${resolvedLine.nome}" inscrita no slot ${letra}.`,
    })
  } catch (error) {
    if (createdParticipacaoId && !occupiedSlotId) {
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
