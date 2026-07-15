import { supabaseAdmin } from '../shared/supabase-admin'

/**
 * Modelo enxuto (escrita):
 *   campeonato_id + line_id + slot_id (+ status, origem, criado_por)
 * Leitura rica:
 *   vw_campeonato_slots_lines
 *
 * Regras:
 * - 1 line = 1 participação ATIVA por campeonato
 * - 1 slot = 1 participação ATIVA
 * - equipe = pasta (via line.equipe_id)
 */

export function isUniqueViolation(error: { code?: string; message?: string; details?: string } | null | undefined) {
  return error?.code === '23505'
}

export function friendlyParticipacaoUniqueError(
  error: { code?: string; message?: string; details?: string } | null | undefined,
  context?: { slotLetra?: string | null; slotNumero?: number | null },
) {
  const details = `${error?.details || ''} ${error?.message || ''}`.toLowerCase()
  if (details.includes('slot_id') || (details.includes('grupo_id') && details.includes('slot_numero'))) {
    const letra = String(context?.slotLetra || context?.slotNumero || '').toUpperCase()
    return `O slot ${letra || 'selecionado'} ja esta ocupado. Escolha outra letra.`
  }
  if (details.includes('line_id') || details.includes('campeonato_equipes_line')) {
    return 'Esta line ja esta inscrita neste campeonato. Cada vaga exige uma line diferente.'
  }
  if (details.includes('equipe_id') && !details.includes('line')) {
    return 'Este campeonato ainda bloqueia multiplas vagas por equipe no banco. Aplique a migration de lines/slot_id.'
  }
  if (details.includes('equipe_lines') || details.includes('equipe_nome')) {
    return 'Ja existe uma line com esse nome nesta equipe. Selecione a line livre na lista.'
  }
  return error?.message || 'Conflito ao salvar a participacao.'
}

export async function listLinesDisponiveisNoCampeonato(equipeId: string, campeonatoId: string) {
  const [{ data: lines, error: linesError }, { data: parts, error: partsError }] = await Promise.all([
    supabaseAdmin
      .from('equipe_lines')
      .select('id,nome,tag,logo_url,status')
      .eq('equipe_id', equipeId)
      .neq('status', 'inativo')
      .order('created_at', { ascending: true }),
    supabaseAdmin
      .from('campeonato_equipes')
      .select('line_id')
      .eq('campeonato_id', campeonatoId)
      .eq('equipe_id', equipeId)
      .eq('status', 'ativo'),
  ])
  if (linesError) throw linesError
  if (partsError) throw partsError
  const used = new Set((parts || []).map((p) => p.line_id).filter(Boolean))
  return (lines || [])
    .map((line) => ({ ...line, ja_inscrita: used.has(line.id) }))
    .filter((line) => !line.ja_inscrita)
}

export async function assertLineLivreNoCampeonato(campeonatoId: string, lineId: string) {
  const { data, error } = await supabaseAdmin
    .from('campeonato_equipes')
    .select('id')
    .eq('campeonato_id', campeonatoId)
    .eq('line_id', lineId)
    .eq('status', 'ativo')
    .maybeSingle()
  if (error) throw error
  if (data) throw new Error('Esta line ja esta inscrita neste campeonato. Cada vaga exige uma line diferente.')
}

export async function assertSlotLivreNoGrupo(params: {
  campeonatoId: string
  grupoId: string
  slotNumero: number
  slotLetra?: string | null
  slotId?: string | null
}) {
  if (params.slotId) {
    const { data, error } = await supabaseAdmin
      .from('campeonato_equipes')
      .select('id')
      .eq('status', 'ativo')
      .eq('slot_id', params.slotId)
      .maybeSingle()
    if (error && !['42703', 'PGRST204'].includes(error.code || '')) throw error
    if (data) {
      const letra = String(params.slotLetra || params.slotNumero).toUpperCase()
      throw new Error(`O slot ${letra} ja esta ocupado. Escolha outra letra.`)
    }
  }

  const { data, error } = await supabaseAdmin
    .from('campeonato_equipes')
    .select('id,equipe_id,line_id,nome_exibicao')
    .eq('campeonato_id', params.campeonatoId)
    .eq('grupo_id', params.grupoId)
    .eq('slot_numero', params.slotNumero)
    .eq('status', 'ativo')
    .maybeSingle()
  if (error) throw error
  if (data) {
    const letra = String(params.slotLetra || params.slotNumero).toUpperCase()
    throw new Error(`O slot ${letra} ja esta ocupado. Escolha outra letra.`)
  }
}

/** Soft-remove participação e libera slot de forma segura. */
export async function softRemoveParticipacao(participacaoId: string) {
  const { data: part, error } = await supabaseAdmin
    .from('campeonato_equipes')
    .select('id,campeonato_id,grupo_id,slot_numero,slot_id,line_id,equipe_id,vaga_id')
    .eq('id', participacaoId)
    .maybeSingle()
  if (error && !['42703', 'PGRST204'].includes(error.code || '')) throw error
  if (!part) return

  if (part.vaga_id) {
    await supabaseAdmin
      .from('campeonato_vagas')
      .update({
        status: 'livre',
        campeonato_equipe_id: null,
        ocupada_em: null,
        reservada_por_token_id: null,
        reservada_em: null,
        reserva_expira_em: null,
        nome_equipe_reservada: null,
        nome_line_reservada: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', part.vaga_id)
  }

  const updatePayload: Record<string, unknown> = {
    status: 'removido',
    slot_numero: null,
    grupo_id: null,
    updated_at: new Date().toISOString(),
  }
  // limpa slot_id se a coluna existir
  updatePayload.slot_id = null

  let { error: upErr } = await supabaseAdmin.from('campeonato_equipes').update(updatePayload).eq('id', participacaoId)
  if (upErr && (upErr.code === 'PGRST204' || /slot_id/i.test(upErr.message || ''))) {
    delete updatePayload.slot_id
    const retry = await supabaseAdmin.from('campeonato_equipes').update(updatePayload).eq('id', participacaoId)
    upErr = retry.error
  }
  if (upErr) throw upErr

  if (part.slot_id) {
    await supabaseAdmin
      .from('campeonato_slots')
      .update({
        equipe_id: null,
        line_id: null,
        status: 'livre',
        updated_at: new Date().toISOString(),
      })
      .eq('id', part.slot_id)
  } else if (part.grupo_id && part.slot_numero != null) {
    await supabaseAdmin
      .from('campeonato_slots')
      .update({
        equipe_id: null,
        line_id: null,
        status: 'livre',
        updated_at: new Date().toISOString(),
      })
      .eq('campeonato_id', part.campeonato_id)
      .eq('grupo_id', part.grupo_id)
      .eq('slot_numero', part.slot_numero)
  }
}

/** Resolve line por id ou cria/reutiliza por nome (somente se livre no campeonato). */
export async function resolveLineForInscricao(params: {
  equipeId: string
  campeonatoId: string
  lineId?: string | null
  nomeLine?: string | null
  tag?: string | null
  logoUrl?: string | null
}) {
  const lineIdInformada = String(params.lineId || '').trim()
  const nomeNova = String(params.nomeLine || '').trim()

  if (lineIdInformada) {
    const { data: line, error } = await supabaseAdmin
      .from('equipe_lines')
      .select('id,nome,status')
      .eq('id', lineIdInformada)
      .eq('equipe_id', params.equipeId)
      .maybeSingle()
    if (error) throw error
    if (!line) throw new Error('A line selecionada nao pertence a sua equipe.')
    if (String(line.status || '').toLowerCase() === 'inativo') {
      throw new Error('A line selecionada esta inativa.')
    }
    await assertLineLivreNoCampeonato(params.campeonatoId, line.id)
    return { id: line.id, nome: line.nome, criada_agora: false }
  }

  if (!nomeNova) throw new Error('Selecione uma line livre ou informe o nome de uma nova line para esta vaga.')

  const target = nomeNova.toLowerCase()
  const { data: existingLines, error: listError } = await supabaseAdmin
    .from('equipe_lines')
    .select('id,nome,status')
    .eq('equipe_id', params.equipeId)
  if (listError) throw listError

  const existing = (existingLines || []).find((row) => String(row.nome || '').trim().toLowerCase() === target)
  if (existing) {
    await assertLineLivreNoCampeonato(params.campeonatoId, existing.id)
    if (String(existing.status || '').toLowerCase() === 'inativo') {
      const { data: reactivated, error } = await supabaseAdmin
        .from('equipe_lines')
        .update({ status: 'ativo', updated_at: new Date().toISOString() })
        .eq('id', existing.id)
        .select('id,nome')
        .single()
      if (error) throw error
      return { id: reactivated.id, nome: reactivated.nome, criada_agora: false }
    }
    return { id: existing.id, nome: existing.nome, criada_agora: false }
  }

  let tag = params.tag || null
  let logoUrl = params.logoUrl || null
  if (!tag || !logoUrl) {
    const { data: equipe } = await supabaseAdmin
      .from('equipes')
      .select('tag,logo_url')
      .eq('id', params.equipeId)
      .maybeSingle()
    tag = tag || equipe?.tag || null
    logoUrl = logoUrl || equipe?.logo_url || null
  }

  const { data: created, error } = await supabaseAdmin
    .from('equipe_lines')
    .insert({
      equipe_id: params.equipeId,
      nome: nomeNova,
      tag,
      logo_url: logoUrl,
      status: 'ativo',
    })
    .select('id,nome,tag,logo_url')
    .single()
  if (error) {
    if (isUniqueViolation(error)) {
      throw new Error('Ja existe uma line com esse nome nesta equipe. Selecione a line livre na lista.')
    }
    throw error
  }
  return { id: created.id, nome: created.nome, criada_agora: true }
}

/**
 * Gravação enxuta: line + slot (+ denorm equipe/grupo/numero para compat).
 * Preferir sempre slot_id.
 */
export async function inserirParticipacaoNoSlot(params: {
  campeonatoId: string
  slotId: string
  lineId: string
  equipeId: string
  nomeExibicao: string
  origem: string
  criadoPor: string
  vagaId?: string | null
}) {
  const { data: slot, error: slotError } = await supabaseAdmin
    .from('campeonato_slots')
    .select('id,campeonato_id,grupo_id,slot_numero,slot_letra,equipe_id,line_id')
    .eq('id', params.slotId)
    .eq('campeonato_id', params.campeonatoId)
    .maybeSingle()
  if (slotError) throw slotError
  if (!slot) throw new Error('Slot nao encontrado.')
  if (slot.equipe_id || slot.line_id) throw new Error('Este slot ja esta ocupado.')

  await assertSlotLivreNoGrupo({
    campeonatoId: params.campeonatoId,
    grupoId: slot.grupo_id,
    slotNumero: Number(slot.slot_numero),
    slotLetra: slot.slot_letra,
    slotId: slot.id,
  })
  await assertLineLivreNoCampeonato(params.campeonatoId, params.lineId)

  const base: Record<string, unknown> = {
    campeonato_id: params.campeonatoId,
    equipe_id: params.equipeId,
    line_id: params.lineId,
    slot_id: params.slotId,
    grupo_id: slot.grupo_id,
    slot_numero: slot.slot_numero,
    nome_exibicao: params.nomeExibicao,
    origem_entrada: params.origem,
    criado_por: params.criadoPor,
    status: 'ativo',
  }
  if (params.vagaId) base.vaga_id = params.vagaId

  let { data: participacao, error } = await supabaseAdmin
    .from('campeonato_equipes')
    .insert(base)
    .select('*')
    .single()

  if (error && (error.code === 'PGRST204' || /slot_id/i.test(error.message || ''))) {
    const { slot_id: _s, ...fallback } = base
    const retry = await supabaseAdmin.from('campeonato_equipes').insert(fallback).select('*').single()
    participacao = retry.data
    error = retry.error
  }

  if (error) {
    if (isUniqueViolation(error)) {
      throw new Error(
        friendlyParticipacaoUniqueError(error, {
          slotLetra: slot.slot_letra,
          slotNumero: slot.slot_numero,
        }),
      )
    }
    throw error
  }

  // Espelho no slot (trigger tambem faz; reforço app-level)
  const { error: slotUpError } = await supabaseAdmin
    .from('campeonato_slots')
    .update({
      equipe_id: params.equipeId,
      line_id: params.lineId,
      status: 'ocupado',
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.slotId)
    .is('equipe_id', null)

  if (slotUpError) {
    await softRemoveParticipacao(participacao.id)
    throw new Error('O slot foi preenchido por outra line. Atualize e tente novamente.')
  }

  return participacao
}

const VIEW_COLUMNS =
  'slot_id,campeonato_id,fase_id,grupo_id,slot_numero,slot_letra,slot_status,participacao_id,line_id,equipe_id,nome_exibicao,origem_entrada,participacao_status,line_nome,line_tag,line_logo_url,equipe_nome,equipe_tag,equipe_logo_url,grupo_nome,fase_nome,fase_ordem,status_ui'

/** Lista slots do campeonato via view (fallback para query manual). */
export async function listSlotsLinesView(campeonatoId: string, opts?: { grupoId?: string }) {
  let query = supabaseAdmin
    .from('vw_campeonato_slots_lines')
    .select(VIEW_COLUMNS)
    .eq('campeonato_id', campeonatoId)

  if (opts?.grupoId) query = query.eq('grupo_id', opts.grupoId)

  const { data, error } = await query
    .order('fase_ordem', { ascending: true, nullsFirst: true })
    .order('grupo_nome', { ascending: true, nullsFirst: true })
    .order('slot_numero', { ascending: true })

  if (!error && data) return { rows: data, source: 'view' as const }

  // Fallback se a view ainda nao existir no Supabase
  if (error && (error.code === '42P01' || error.code === 'PGRST205' || /vw_campeonato_slots_lines/i.test(error.message || ''))) {
    return { rows: null, source: 'fallback' as const, error }
  }
  throw error
}
