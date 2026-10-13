import { supabaseAdmin } from '../shared/supabase-admin'
import { readPagedRows, readRowsByIds } from '../shared/paginated-query'

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
    return 'Esta equipe já possui uma participação incompatível com a vaga. Peça à produtora para revisar a inscrição.'
  }
  if (details.includes('equipe_lines') || details.includes('equipe_nome')) {
    return 'Ja existe uma line com esse nome nesta equipe. Selecione a line livre na lista.'
  }
  return 'Conflito ao salvar a participação. Atualize e tente novamente.'
}

/** Marca lines já usadas no campeonato (por line_id e por nome de exibição). */
export function markLinesJaInscritas<T extends { id: string; nome?: string | null }>(
  lines: T[],
  parts: Array<{ line_id?: string | null; nome_exibicao?: string | null }>,
): Array<T & { ja_inscrita: boolean }> {
  const usedIds = new Set(
    (parts || []).map((p) => String(p.line_id || '').trim()).filter(Boolean),
  )
  const usedNames = new Set(
    (parts || [])
      .map((p) => String(p.nome_exibicao || '').trim().toLowerCase())
      .filter(Boolean),
  )
  return (lines || []).map((line) => {
    const nameKey = String(line.nome || '').trim().toLowerCase()
    const ja_inscrita = usedIds.has(String(line.id)) || Boolean(nameKey && usedNames.has(nameKey))
    return { ...line, ja_inscrita }
  })
}

/** Participações ativas da equipe (e das lines dela) neste campeonato. */
export async function loadParticipacoesLineNoCampeonato(equipeId: string, campeonatoId: string) {
  const lines = await readPagedRows<any>(supabaseAdmin
    .from('equipe_lines')
    .select('id,nome,tag,logo_url,status')
    .eq('equipe_id', equipeId)
    .neq('status', 'inativo')
    .order('created_at', { ascending: true }).order('id', { ascending: true }))

  const lineIds = (lines || []).map((l) => l.id).filter(Boolean)
  const parts = await readPagedRows<any>(supabaseAdmin
    .from('campeonato_equipes')
    .select('id,line_id,grupo_id,slot_numero,nome_exibicao,equipe_id,status')
    .eq('campeonato_id', campeonatoId)
    .eq('status', 'ativo')
    .eq('equipe_id', equipeId).order('id', { ascending: true }))
  const byLine = await readRowsByIds<any>(lineIds, batch => supabaseAdmin
    .from('campeonato_equipes').select('id,line_id,grupo_id,slot_numero,nome_exibicao,equipe_id,status')
    .eq('campeonato_id', campeonatoId).eq('status', 'ativo')
    .in('line_id', batch).order('id', { ascending: true }))

  return { lines, parts: [...new Map([...parts, ...byLine].map(row => [String(row.id), row])).values()] }
}

export async function listLinesDisponiveisNoCampeonato(equipeId: string, campeonatoId: string) {
  const { lines, parts } = await loadParticipacoesLineNoCampeonato(equipeId, campeonatoId)
  return markLinesJaInscritas(lines, parts).filter((line) => !line.ja_inscrita)
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
export type ParticipationRemovalExpectation = Partial<Record<
  'campeonato_id' | 'grupo_id' | 'slot_numero' | 'slot_id' | 'line_id' | 'equipe_id' | 'criado_por' | 'origem_entrada',
  string | number | null
>>

export async function softRemoveParticipacao(participacaoId: string, expected?: ParticipationRemovalExpectation) {
  const { data: part, error } = await supabaseAdmin
    .from('campeonato_equipes')
    .select('id,campeonato_id,grupo_id,slot_numero,slot_id,line_id,equipe_id,status,criado_por,origem_entrada')
    .eq('id', participacaoId)
    .maybeSingle()
  if (error) throw error
  if (!part || part.status !== 'ativo') return
  for (const column of ['campeonato_id', 'grupo_id', 'slot_numero', 'slot_id', 'line_id', 'equipe_id', 'criado_por', 'origem_entrada'] as const) {
    if (expected && column in expected && (part[column] ?? null) !== (expected[column] ?? null)) {
      throw new Error('A participação mudou durante a operação. Atualize e tente novamente.')
    }
  }

  let removal = supabaseAdmin
    .from('campeonato_equipes')
    .update({
      status: 'removido',
      slot_id: null,
      slot_numero: null,
      grupo_id: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', participacaoId).eq('status', 'ativo').eq('campeonato_id', part.campeonato_id)
  for (const column of ['slot_id', 'grupo_id', 'slot_numero', 'line_id', 'equipe_id', 'criado_por', 'origem_entrada'] as const) {
    removal = part[column] == null ? removal.is(column, null) : removal.eq(column, part[column])
  }
  const { data: removed, error: upErr } = await removal.select('id').maybeSingle()
  if (upErr) throw upErr
  if (!removed) throw new Error('A participação mudou durante a operação. Atualize e tente novamente.')

  let mirror = supabaseAdmin
      .from('campeonato_slots')
      .update({
        equipe_id: null,
        line_id: null,
        status: 'livre',
        updated_at: new Date().toISOString(),
      }).eq('campeonato_id', part.campeonato_id)
  if (part.slot_id) mirror = mirror.eq('id', part.slot_id)
  else if (part.grupo_id && part.slot_numero != null) mirror = mirror
      .eq('grupo_id', part.grupo_id)
      .eq('slot_numero', part.slot_numero)
  else return
  for (const column of ['line_id', 'equipe_id'] as const) {
    mirror = part[column] == null ? mirror.is(column, null) : mirror.eq(column, part[column])
  }
  const { error: mirrorError } = await mirror
  if (mirrorError) throw mirrorError
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

  // Bloqueia nomes genéricos/placeholder sem escolha real
  const target = nomeNova.toLowerCase()
  if (['nova line', 'nova_line', 'newline', 'new line', '+ criar nova line', 'criar nova line'].includes(target)) {
    throw new Error('Informe um nome real para a line (ex.: ALOE ELITE 2), não "Nova Line".')
  }

  const existingLines = await readPagedRows<any>(supabaseAdmin
    .from('equipe_lines')
    .select('id,nome,status')
    .eq('equipe_id', params.equipeId).order('id', { ascending: true }))

  const existing = (existingLines || []).find((row) => String(row.nome || '').trim().toLowerCase() === target)
  if (existing) {
    try {
      await assertLineLivreNoCampeonato(params.campeonatoId, existing.id)
    } catch {
      throw new Error(
        `A line "${existing.nome}" já está inscrita neste campeonato. Escolha outra line livre ou use um nome diferente.`,
      )
    }
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

  // Também bloqueia se já existe participação com esse nome_exibicao (legado sem line_id)
  const { data: partByName, error: partByNameError } = await supabaseAdmin
    .from('campeonato_equipes')
    .select('id,line_id,nome_exibicao')
    .eq('campeonato_id', params.campeonatoId)
    .eq('equipe_id', params.equipeId)
    .eq('status', 'ativo')
    .ilike('nome_exibicao', nomeNova)
    .maybeSingle()
  if (partByNameError && !['42703', 'PGRST204'].includes(partByNameError.code || '')) throw partByNameError
  if (partByName) {
    throw new Error(
      `A line "${nomeNova}" já está inscrita neste campeonato. Escolha outra line livre ou use um nome diferente.`,
    )
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
  const { data: line, error: lineError } = await supabaseAdmin.from('equipe_lines')
    .select('id,status').eq('id', params.lineId).eq('equipe_id', params.equipeId).maybeSingle()
  if (lineError) throw lineError
  if (!line) throw new Error('A line selecionada nao pertence a sua equipe.')
  if (String(line.status || '').toLowerCase() === 'inativo') throw new Error('A line selecionada esta inativa.')

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

  const { data: participacao, error } = await supabaseAdmin
    .from('campeonato_equipes')
    .insert(base)
    .select('*')
    .single()

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
    .eq('id', params.slotId).eq('campeonato_id', params.campeonatoId)
    .is('equipe_id', null)
    .is('line_id', null)

  const { data: ownedMirror, error: mirrorReadError } = slotUpError
    ? { data: null, error: slotUpError }
    : await supabaseAdmin.from('campeonato_slots').select('id')
      .eq('id', params.slotId).eq('campeonato_id', params.campeonatoId)
      .eq('line_id', params.lineId).eq('equipe_id', params.equipeId).maybeSingle()
  if (mirrorReadError || !ownedMirror) {
    await softRemoveParticipacao(participacao.id, participacao)
    throw new Error('O slot foi preenchido por outra line. Atualize e tente novamente.')
  }

  return participacao
}

const VIEW_COLUMNS =
  'slot_id,campeonato_id,fase_id,grupo_id,slot_numero,slot_letra,slot_status,participacao_id,line_id,equipe_id,nome_exibicao,origem_entrada,participacao_status,line_nome,line_tag,line_logo_url,equipe_nome,equipe_tag,equipe_logo_url,grupo_nome,fase_nome,fase_ordem,status_ui,convite_id,convite_token,convite_expira_em,nome_equipe_reservada,nome_line_reservada'

/** Lista slots do campeonato via view (fallback para query manual). */
export async function listSlotsLinesView(campeonatoId: string, opts?: { grupoId?: string }) {
  let query = supabaseAdmin
    .from('vw_campeonato_slots_lines')
    .select(VIEW_COLUMNS)
    .eq('campeonato_id', campeonatoId)

  if (opts?.grupoId) query = query.eq('grupo_id', opts.grupoId)

  try {
    const data = await readPagedRows<any>(query
    .order('fase_ordem', { ascending: true, nullsFirst: true })
    .order('grupo_nome', { ascending: true, nullsFirst: true })
    .order('slot_numero', { ascending: true }).order('slot_id', { ascending: true }))

    return { rows: data, source: 'view' as const }
  } catch (cause) {
    const error = cause as { code?: string; message?: string }

  // Fallback se a view ainda nao existir no Supabase
  if (error && (error.code === '42P01' || error.code === 'PGRST205')) {
    return { rows: null, source: 'fallback' as const, error }
  }
  throw error
  }
}
