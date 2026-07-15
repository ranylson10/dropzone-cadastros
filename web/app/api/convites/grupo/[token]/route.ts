import { NextRequest, NextResponse } from 'next/server'
import { getAccountsForUser, getBearerUser } from '@backend/auth/server-auth'
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

function isMissingRelation(error: { code?: string; message?: string } | null | undefined) {
  const message = String(error?.message || '').toLowerCase()
  return ['42P01', '42703', 'PGRST204', 'PGRST205'].includes(error?.code || '')
    || message.includes('campeonato_vagas')
    || message.includes('vaga_id')
    || message.includes('origem_entrada')
    || message.includes('nome_exibicao')
    || message.includes('line_id')
}

async function loadLink(token: string) {
  const { data: link, error } = await supabaseAdmin
    .from('campeonato_links')
    .select('*')
    .eq('token', token)
    .eq('tipo', 'inscricao_equipes_grupo')
    .eq('ativo', true)
    .maybeSingle()
  if (error) throw error
  if (!link) throw new Error('Link de equipes invalido ou inativo.')
  if (link.expira_em && new Date(link.expira_em).getTime() < Date.now()) throw new Error('Link de equipes expirado.')
  if (!link.campeonato_id || !link.grupo_id) throw new Error('Este link de grupo esta incompleto no banco.')
  return link
}

async function sessionTeam(req: NextRequest, campeonatoId: string) {
  try {
    const user = await getBearerUser(req)
    const accounts = await getAccountsForUser(user)
    const equipe = accounts.find((account) => account.profile_type === 'equipe') || null
    if (!equipe) return { autenticado: true, equipe: null, lines: [] as any[] }
    const [{ data: lines }, { data: participacoes }] = await Promise.all([
      supabaseAdmin
        .from('equipe_lines')
        .select('id,nome,tag,logo_url,status')
        .eq('equipe_id', equipe.id)
        .neq('status', 'inativo')
        .order('created_at', { ascending: true }),
      supabaseAdmin
        .from('campeonato_equipes')
        .select('line_id,status')
        .eq('campeonato_id', campeonatoId)
        .eq('equipe_id', equipe.id)
        .eq('status', 'ativo'),
    ])
    const used = new Set((participacoes || []).map((item) => item.line_id).filter(Boolean))
    return {
      autenticado: true,
      equipe: {
        id: equipe.id,
        nome: equipe.name,
        tag: equipe.data?.tag || null,
        logo_url: equipe.data?.logo_url || null,
      },
      lines: (lines || []).map((line) => ({ ...line, ja_inscrita: used.has(line.id) })),
    }
  } catch {
    return { autenticado: false, equipe: null, lines: [] as any[] }
  }
}

async function loadGroupSlots(campeonatoId: string, grupoId: string) {
  const { data: slots, error } = await supabaseAdmin
    .from('campeonato_slots')
    .select('id,slot_numero,slot_letra,equipe_id,line_id,status,equipes:equipe_id(id,nome,tag,logo_url),equipe_lines:line_id(id,nome,tag,logo_url)')
    .eq('campeonato_id', campeonatoId)
    .eq('grupo_id', grupoId)
    .order('slot_numero', { ascending: true })
  if (error) throw error
  return slots || []
}

function mapVagas(expected: string[], slots: any[]) {
  const labels = expected.length
    ? expected
    : slots.map((slot, index) => `Vaga ${slot.slot_letra || slot.slot_numero || index + 1}`)

  return labels.map((nome, index) => {
    const slot = slots[index] || null
    const line = Array.isArray(slot?.equipe_lines) ? slot.equipe_lines[0] : slot?.equipe_lines
    const team = Array.isArray(slot?.equipes) ? slot.equipes[0] : slot?.equipes
    const ocupada = Boolean(slot?.equipe_id || slot?.line_id)
    return {
      index,
      nome,
      slot_id: slot?.id || null,
      slot_numero: slot?.slot_numero || index + 1,
      slot_letra: slot?.slot_letra || null,
      ocupada,
      equipe_nome: team?.nome || null,
      line_nome: line?.nome || null,
      logo_url: line?.logo_url || team?.logo_url || null,
    }
  })
}

async function payloadFor(req: NextRequest, token: string) {
  const link = await loadLink(token)
  const expected = parseLinkMetadata(link).expected_teams
  const [{ data: campeonato, error: campError }, { data: grupo, error: grupoError }, slots] = await Promise.all([
    supabaseAdmin.from('campeonatos').select('id,nome,logo_url,status').eq('id', link.campeonato_id).single(),
    supabaseAdmin.from('campeonato_grupos').select('id,nome,slots').eq('id', link.grupo_id).single(),
    loadGroupSlots(link.campeonato_id, link.grupo_id),
  ])
  if (campError) throw campError
  if (grupoError) throw grupoError
  const session = await sessionTeam(req, link.campeonato_id)
  return {
    link: { token: link.token, titulo: link.titulo },
    campeonato,
    grupo,
    vagas: mapVagas(expected, slots),
    ...session,
  }
}

async function insertParticipacao(payload: Record<string, unknown>) {
  // Tenta payload completo e vai removendo colunas opcionais se o schema estiver desatualizado.
  const attempts: Array<Record<string, unknown>> = [
    payload,
    Object.fromEntries(Object.entries(payload).filter(([key]) => key !== 'vaga_id')),
    Object.fromEntries(Object.entries(payload).filter(([key]) => !['vaga_id', 'origem_entrada'].includes(key))),
    Object.fromEntries(Object.entries(payload).filter(([key]) => !['vaga_id', 'origem_entrada', 'nome_exibicao'].includes(key))),
  ]

  let lastError: any = null
  for (const attempt of attempts) {
    const { data, error } = await supabaseAdmin
      .from('campeonato_equipes')
      .insert(attempt)
      .select('*')
      .single()
    if (!error && data) return data
    lastError = error
    if (!isMissingRelation(error)) break
  }
  throw lastError || new Error('Nao foi possivel salvar a equipe no campeonato.')
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

    const link = await loadLink(token)
    const expected = parseLinkMetadata(link).expected_teams
    const slots = await loadGroupSlots(link.campeonato_id, link.grupo_id)
    if (!slots.length) throw new Error('Este grupo ainda nao possui slots. Crie o grupo novamente ou regenere os slots.')

    let slot = slotIdInformado
      ? slots.find((item) => item.id === slotIdInformado) || null
      : null

    if (!slot) {
      if (!Number.isInteger(vagaIndex) || vagaIndex < 0) throw new Error('Selecione uma vaga esperada.')
      // Usa a ordem real dos slots do grupo, nao assume que slot_numero === index + 1.
      slot = slots[vagaIndex] || null
    }

    if (!slot) throw new Error('Slot do grupo nao encontrado para a vaga selecionada.')
    if (slot.equipe_id || slot.line_id) throw new Error('Essa vaga ja foi preenchida.')

    if (expected.length && Number.isInteger(vagaIndex) && (vagaIndex < 0 || vagaIndex >= expected.length)) {
      throw new Error('Selecione uma vaga esperada valida.')
    }

    let lineId = lineIdInformada || null
    let lineName = ''

    if (lineId) {
      const { data: line, error: lineError } = await supabaseAdmin
        .from('equipe_lines')
        .select('id,nome')
        .eq('id', lineId)
        .eq('equipe_id', account.id)
        .maybeSingle()
      if (lineError) throw lineError
      if (!line) throw new Error('A line selecionada nao pertence a sua equipe.')
      lineName = line.nome
    } else {
      if (!nomeNovaLine) throw new Error('Selecione uma line ou informe uma nova.')
      const { data: created, error } = await supabaseAdmin
        .from('equipe_lines')
        .insert({
          equipe_id: account.id,
          nome: nomeNovaLine,
          tag: account.data?.tag || null,
          logo_url: account.data?.logo_url || null,
          status: 'ativo',
        })
        .select('id,nome')
        .single()
      if (error) throw error
      lineId = created.id
      lineName = created.nome
    }

    const { data: duplicate, error: duplicateError } = await supabaseAdmin
      .from('campeonato_equipes')
      .select('id')
      .eq('campeonato_id', link.campeonato_id)
      .eq('line_id', lineId)
      .eq('status', 'ativo')
      .maybeSingle()
    if (duplicateError) throw duplicateError
    if (duplicate) throw new Error('Esta line ja esta inscrita neste campeonato.')

    // 1) Grava a participação no campeonato (vínculo real equipe/line/grupo).
    const participationPayload: Record<string, unknown> = {
      campeonato_id: link.campeonato_id,
      equipe_id: account.id,
      grupo_id: link.grupo_id,
      slot_numero: slot.slot_numero,
      line_id: lineId,
      nome_exibicao: lineName,
      // Constraint real no banco: organizador | convite | inscricao
      // (valores como "link" / "vendedor" quebram o insert)
      origem_entrada: 'inscricao',
      criado_por: user.id,
      status: 'ativo',
    }

    let participacao: any
    try {
      participacao = await insertParticipacao(participationPayload)
    } catch (partError: any) {
      if (partError?.code === '23505') {
        throw new Error('Esta equipe/line ja esta vinculada a este campeonato. Se for multi-line, confira se a migration de line unica foi aplicada.')
      }
      throw new Error(errorMessage(partError, 'Nao foi possivel salvar a equipe no campeonato.'))
    }
    createdParticipacaoId = participacao.id

    // 2) Ocupa o slot do grupo com a mesma line.
    const { data: updatedSlot, error: slotError } = await supabaseAdmin
      .from('campeonato_slots')
      .update({
        equipe_id: account.id,
        line_id: lineId,
        status: 'ocupado',
        updated_at: new Date().toISOString(),
      })
      .eq('id', slot.id)
      .eq('campeonato_id', link.campeonato_id)
      .eq('grupo_id', link.grupo_id)
      .is('equipe_id', null)
      .select('id')
      .maybeSingle()

    if (slotError || !updatedSlot) {
      await supabaseAdmin.from('campeonato_equipes').delete().eq('id', participacao.id)
      createdParticipacaoId = null
      if (slotError?.code === '23505') {
        throw new Error('Esta line ja esta posicionada em outro slot desta fase.')
      }
      throw new Error(errorMessage(slotError, 'A vaga foi preenchida por outra equipe. Atualize e tente novamente.'))
    }
    occupiedSlotId = slot.id

    // 3) Melhor esforço: sincroniza campeonato_vagas legado, se existir.
    try {
      const { data: legacyVaga } = await supabaseAdmin
        .from('campeonato_vagas')
        .select('id,status')
        .eq('campeonato_id', link.campeonato_id)
        .eq('numero_vaga', Number(slot.slot_numero))
        .maybeSingle()
      if (legacyVaga?.id) {
        await supabaseAdmin
          .from('campeonato_equipes')
          .update({ vaga_id: legacyVaga.id })
          .eq('id', participacao.id)
        await supabaseAdmin
          .from('campeonato_vagas')
          .update({
            status: 'ocupada',
            campeonato_equipe_id: participacao.id,
            ocupada_em: new Date().toISOString(),
          })
          .eq('id', legacyVaga.id)
      }
    } catch {
      // Fluxo principal nao depende de campeonato_vagas.
    }

    const referencia = expected[vagaIndex] || lineName || `Slot ${slot.slot_numero}`
    return NextResponse.json({
      ok: true,
      participacao,
      equipe: { id: account.id, nome: account.name },
      line: { id: lineId, nome: lineName },
      grupo_id: link.grupo_id,
      slot_id: slot.id,
      referencia,
    })
  } catch (error) {
    // Rollback de melhor esforço se algo falhou no meio.
    if (createdParticipacaoId && !occupiedSlotId) {
      try {
        await supabaseAdmin.from('campeonato_equipes').delete().eq('id', createdParticipacaoId)
      } catch {
        // ignore rollback failure
      }
    }
    return NextResponse.json(
      { error: errorMessage(error, 'Erro ao entrar no grupo.') },
      { status: 400 },
    )
  }
}
