import { supabaseAdmin } from '../../shared/supabase-admin'

export type JogoInput = {
  fase_id: string
  rodada_id?: string | null
  ordem_na_rodada?: number | null
  nome: string
  data_jogo?: string | null
  horario?: string | null
  numero_partidas: number
  mapas: string[]
  grupos_ids: string[]
  intervalo_quedas_minutos?: number
  tipo_pontuacao?: 'normal' | 'sem_pontuacao'
  papel_na_fase?: 'normal' | 'classificatorio_bonus' | 'decisivo'
  multiplicador_abates_ultima_queda?: number
  permite_troca_jogadores?: boolean
  limite_troca_minutos?: number | null
  limite_escalacao_minutos?: number | null
  minimo_quedas_jogadas_jogador?: number
  status?: string
}

export type RodadaInput = {
  fase_id: string
  numero: number
  nome?: string | null
  data_inicio?: string | null
  data_fim?: string | null
  status?: 'rascunho' | 'agendada' | 'em_andamento' | 'finalizada' | 'cancelada'
}

export type FaseConfiguracaoInput = {
  quantidade_classificados?: number | null
  criterio_classificacao?: 'pontuacao' | 'colocacao_grupo' | 'manual'
  modo_decisao?: 'pontuacao_normal' | 'booyah_ouro'
  modo_acumulacao?: 'acumulado' | 'bonus_por_ranking'
  booyah_ouro_pontos_limite?: number | null
  booyah_ouro_queda_minima?: number | null
  booyah_ouro_desempate_final?: 'maior_pontuacao' | 'quedas_extras' | 'decisao_manual'
  jogo_decisivo_id?: string | null
  bonus_ranking?: Array<{ posicao: number; pontos_bonus: number }>
}

function nonEmpty(value: unknown, field: string) {
  const clean = String(value ?? '').trim()
  if (!clean) throw new Error(`${field} é obrigatório.`)
  return clean
}

function positiveInt(value: unknown, field: string, options?: { allowZero?: boolean; nullable?: boolean }) {
  if ((value === null || value === undefined || value === '') && options?.nullable) return null
  const parsed = Number(value)
  const min = options?.allowZero ? 0 : 1
  if (!Number.isInteger(parsed) || parsed < min) throw new Error(`${field} inválido.`)
  return parsed
}

function numeric(value: unknown, field: string, options?: { min?: number; nullable?: boolean }) {
  if ((value === null || value === undefined || value === '') && options?.nullable) return null
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < (options?.min ?? 0)) throw new Error(`${field} inválido.`)
  return parsed
}

async function assertCampeonatoFase(campeonatoId: string, faseId: string) {
  const { data, error } = await supabaseAdmin
    .from('campeonato_fases')
    .select('id, campeonato_id, nome')
    .eq('id', faseId)
    .eq('campeonato_id', campeonatoId)
    .maybeSingle()
  if (error) throw error
  if (!data) throw new Error('A fase selecionada não pertence a este campeonato.')
  return data
}

async function assertRodadaContexto(campeonatoId: string, faseId: string, rodadaId?: string | null) {
  if (!rodadaId) return null
  const { data, error } = await supabaseAdmin
    .from('campeonato_rodadas')
    .select('id, campeonato_id, fase_id, numero, nome')
    .eq('id', rodadaId)
    .eq('campeonato_id', campeonatoId)
    .eq('fase_id', faseId)
    .maybeSingle()
  if (error) throw error
  if (!data) throw new Error('A rodada selecionada não pertence à mesma fase do jogo.')
  return data
}

async function assertGruposDaFase(campeonatoId: string, faseId: string, grupoIds: string[]) {
  const ids = [...new Set(grupoIds.map((id) => String(id || '').trim()).filter(Boolean))]
  if (!ids.length) throw new Error('Selecione pelo menos um grupo participante.')

  const { data, error } = await supabaseAdmin
    .from('campeonato_grupos')
    .select('id, campeonato_id, fase_id, nome, slots')
    .in('id', ids)
    .eq('campeonato_id', campeonatoId)
    .eq('fase_id', faseId)
  if (error) throw error
  if ((data || []).length !== ids.length) {
    throw new Error('Um ou mais grupos não pertencem à fase selecionada.')
  }
  return data || []
}

function sanitizeJogoInput(input: Partial<JogoInput>, existing?: any): JogoInput {
  const numeroPartidas = positiveInt(input.numero_partidas ?? existing?.numero_partidas, 'Número de quedas') as number
  const mapas = Array.isArray(input.mapas ?? existing?.mapas)
    ? (input.mapas ?? existing?.mapas).map((item: unknown) => String(item ?? '').trim()).slice(0, numeroPartidas)
    : []
  while (mapas.length < numeroPartidas) mapas.push('')

  const grupos: string[] = Array.isArray(input.grupos_ids ?? existing?.grupos_ids)
    ? [...new Set<string>((input.grupos_ids ?? existing?.grupos_ids).map((id: unknown) => String(id || '').trim()).filter(Boolean))]
    : []

  const permiteTroca = Boolean(input.permite_troca_jogadores ?? existing?.permite_troca_jogadores ?? true)
  const limiteTroca = permiteTroca
    ? positiveInt(input.limite_troca_minutos ?? existing?.limite_troca_minutos, 'Prazo de troca', { allowZero: true, nullable: true })
    : null

  return {
    fase_id: nonEmpty(input.fase_id ?? existing?.fase_id, 'Fase'),
    rodada_id: input.rodada_id === undefined ? (existing?.rodada_id ?? null) : (input.rodada_id || null),
    ordem_na_rodada: positiveInt(input.ordem_na_rodada ?? existing?.ordem_na_rodada, 'Ordem na rodada', { nullable: true }),
    nome: nonEmpty(input.nome ?? existing?.nome, 'Nome do jogo'),
    data_jogo: input.data_jogo === undefined ? (existing?.data_jogo ?? null) : (input.data_jogo || null),
    horario: input.horario === undefined ? (existing?.horario ?? null) : (input.horario || null),
    numero_partidas: numeroPartidas,
    mapas,
    grupos_ids: grupos,
    intervalo_quedas_minutos: positiveInt(input.intervalo_quedas_minutos ?? existing?.intervalo_quedas_minutos ?? 25, 'Intervalo entre quedas', { allowZero: true }) as number,
    tipo_pontuacao: (input.tipo_pontuacao ?? existing?.tipo_pontuacao ?? 'normal') as JogoInput['tipo_pontuacao'],
    papel_na_fase: (input.papel_na_fase ?? existing?.papel_na_fase ?? 'normal') as JogoInput['papel_na_fase'],
    multiplicador_abates_ultima_queda: numeric(input.multiplicador_abates_ultima_queda ?? existing?.multiplicador_abates_ultima_queda ?? 1, 'Multiplicador de abates', { min: 1 }) as number,
    permite_troca_jogadores: permiteTroca,
    limite_troca_minutos: limiteTroca,
    limite_escalacao_minutos: positiveInt(input.limite_escalacao_minutos ?? existing?.limite_escalacao_minutos, 'Prazo de escalação', { allowZero: true, nullable: true }),
    minimo_quedas_jogadas_jogador: positiveInt(input.minimo_quedas_jogadas_jogador ?? existing?.minimo_quedas_jogadas_jogador ?? 0, 'Mínimo de quedas jogadas', { allowZero: true }) as number,
    status: String(input.status ?? existing?.status ?? 'ativo').trim() || 'ativo',
  }
}

async function hydrateJogo(campeonatoId: string, jogoId: string) {
  const { data: jogo, error } = await supabaseAdmin
    .from('campeonato_jogos')
    .select('*')
    .eq('id', jogoId)
    .eq('campeonato_id', campeonatoId)
    .single()
  if (error) throw error

  const [{ data: grupos, error: gruposError }, { data: quedas, error: quedasError }] = await Promise.all([
    supabaseAdmin
      .from('campeonato_jogos_grupos')
      .select('id, grupo_id, campeonato_grupos(id, nome, fase_id, slots)')
      .eq('jogo_id', jogoId)
      .order('created_at'),
    supabaseAdmin
      .from('campeonato_partidas')
      .select('*')
      .eq('jogo_id', jogoId)
      .order('numero_partida'),
  ])
  if (gruposError) throw gruposError
  if (quedasError) throw quedasError

  return { ...jogo, grupos: grupos || [], quedas: quedas || [] }
}

export async function listarJogos(campeonatoId: string, filters?: { faseId?: string | null; rodadaId?: string | null }) {
  let query = supabaseAdmin
    .from('campeonato_jogos')
    .select('*')
    .eq('campeonato_id', campeonatoId)
    .order('data_jogo', { ascending: true, nullsFirst: false })
    .order('horario', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true })
  if (filters?.faseId) query = query.eq('fase_id', filters.faseId)
  if (filters?.rodadaId) query = query.eq('rodada_id', filters.rodadaId)

  const { data, error } = await query
  if (error) throw error
  const ids = (data || []).map((item) => item.id)
  if (!ids.length) return []

  const [{ data: relacoes, error: relError }, { data: quedas, error: quedasError }] = await Promise.all([
    supabaseAdmin
      .from('campeonato_jogos_grupos')
      .select('jogo_id, grupo_id, campeonato_grupos(id, nome, fase_id, slots)')
      .in('jogo_id', ids),
    supabaseAdmin
      .from('campeonato_partidas')
      .select('*')
      .in('jogo_id', ids)
      .order('numero_partida'),
  ])
  if (relError) throw relError
  if (quedasError) throw quedasError

  const gruposMap = new Map<string, any[]>()
  for (const relacao of relacoes || []) {
    const list = gruposMap.get(relacao.jogo_id) || []
    list.push(relacao)
    gruposMap.set(relacao.jogo_id, list)
  }
  const quedasMap = new Map<string, any[]>()
  for (const queda of quedas || []) {
    const list = quedasMap.get(queda.jogo_id) || []
    list.push(queda)
    quedasMap.set(queda.jogo_id, list)
  }

  return (data || []).map((jogo) => ({
    ...jogo,
    grupos: gruposMap.get(jogo.id) || [],
    quedas: quedasMap.get(jogo.id) || [],
  }))
}

export async function obterJogo(campeonatoId: string, jogoId: string) {
  return hydrateJogo(campeonatoId, jogoId)
}

export async function criarJogo(campeonatoId: string, input: Partial<JogoInput>) {
  const payload = sanitizeJogoInput(input)
  await assertCampeonatoFase(campeonatoId, payload.fase_id)
  await assertRodadaContexto(campeonatoId, payload.fase_id, payload.rodada_id)
  await assertGruposDaFase(campeonatoId, payload.fase_id, payload.grupos_ids)

  const { grupos_ids, ...jogoPayload } = payload
  const { data: jogo, error } = await supabaseAdmin
    .from('campeonato_jogos')
    .insert({ ...jogoPayload, grupos_ids, campeonato_id: campeonatoId })
    .select('*')
    .single()
  if (error) throw error

  const { error: gruposError } = await supabaseAdmin
    .from('campeonato_jogos_grupos')
    .insert(grupos_ids.map((grupoId) => ({ campeonato_id: campeonatoId, jogo_id: jogo.id, grupo_id: grupoId })))
  if (gruposError) {
    await supabaseAdmin.from('campeonato_jogos').delete().eq('id', jogo.id)
    throw gruposError
  }

  return hydrateJogo(campeonatoId, jogo.id)
}

export async function atualizarJogo(campeonatoId: string, jogoId: string, input: Partial<JogoInput>) {
  const { data: atual, error: atualError } = await supabaseAdmin
    .from('campeonato_jogos')
    .select('*')
    .eq('id', jogoId)
    .eq('campeonato_id', campeonatoId)
    .maybeSingle()
  if (atualError) throw atualError
  if (!atual) throw new Error('Jogo não encontrado.')

  const { data: relacoes, error: relError } = await supabaseAdmin
    .from('campeonato_jogos_grupos')
    .select('grupo_id')
    .eq('jogo_id', jogoId)
  if (relError) throw relError

  const payload = sanitizeJogoInput(input, {
    ...atual,
    grupos_ids: (relacoes || []).map((item) => item.grupo_id),
  })
  await assertCampeonatoFase(campeonatoId, payload.fase_id)
  await assertRodadaContexto(campeonatoId, payload.fase_id, payload.rodada_id)
  await assertGruposDaFase(campeonatoId, payload.fase_id, payload.grupos_ids)

  const { grupos_ids, ...jogoPayload } = payload
  const { error } = await supabaseAdmin
    .from('campeonato_jogos')
    .update({ ...jogoPayload, grupos_ids })
    .eq('id', jogoId)
    .eq('campeonato_id', campeonatoId)
  if (error) throw error

  const atuais = new Set((relacoes || []).map((item) => item.grupo_id))
  const desejados = new Set(grupos_ids)
  const adicionar = grupos_ids.filter((id) => !atuais.has(id))
  const remover = [...atuais].filter((id) => !desejados.has(id))

  if (adicionar.length) {
    const { error: addError } = await supabaseAdmin
      .from('campeonato_jogos_grupos')
      .insert(adicionar.map((grupoId) => ({ campeonato_id: campeonatoId, jogo_id: jogoId, grupo_id: grupoId })))
    if (addError) throw addError
  }
  if (remover.length) {
    const { error: removeError } = await supabaseAdmin
      .from('campeonato_jogos_grupos')
      .delete()
      .eq('jogo_id', jogoId)
      .in('grupo_id', remover)
    if (removeError) throw removeError
  }

  return hydrateJogo(campeonatoId, jogoId)
}

export async function excluirJogo(campeonatoId: string, jogoId: string, force = false) {
  const { data: jogo, error } = await supabaseAdmin
    .from('campeonato_jogos')
    .select('id')
    .eq('id', jogoId)
    .eq('campeonato_id', campeonatoId)
    .maybeSingle()
  if (error) throw error
  if (!jogo) throw new Error('Jogo não encontrado.')

  const { count, error: resultError } = await supabaseAdmin
    .from('campeonato_resultados_equipes')
    .select('id', { count: 'exact', head: true })
    .eq('jogo_id', jogoId)
  if (resultError) throw resultError
  if ((count || 0) > 0 && !force) {
    throw new Error('Este jogo já possui resultados. Confirme a exclusão definitiva para continuar.')
  }

  const { error: deleteError } = await supabaseAdmin
    .from('campeonato_jogos')
    .delete()
    .eq('id', jogoId)
    .eq('campeonato_id', campeonatoId)
  if (deleteError) throw deleteError
}

export async function listarRodadas(campeonatoId: string, faseId?: string | null) {
  let query = supabaseAdmin
    .from('campeonato_rodadas')
    .select('*')
    .eq('campeonato_id', campeonatoId)
    .order('numero')
  if (faseId) query = query.eq('fase_id', faseId)
  const { data, error } = await query
  if (error) throw error
  return data || []
}

export async function criarRodada(campeonatoId: string, input: Partial<RodadaInput>) {
  const faseId = nonEmpty(input.fase_id, 'Fase')
  await assertCampeonatoFase(campeonatoId, faseId)
  const payload = {
    campeonato_id: campeonatoId,
    fase_id: faseId,
    numero: positiveInt(input.numero, 'Número da rodada'),
    nome: input.nome ? String(input.nome).trim() : null,
    data_inicio: input.data_inicio || null,
    data_fim: input.data_fim || null,
    status: input.status || 'rascunho',
  }
  const { data, error } = await supabaseAdmin.from('campeonato_rodadas').insert(payload).select('*').single()
  if (error) throw error
  return data
}

export async function atualizarRodada(campeonatoId: string, rodadaId: string, input: Partial<RodadaInput>) {
  const { data: atual, error: readError } = await supabaseAdmin
    .from('campeonato_rodadas')
    .select('*')
    .eq('id', rodadaId)
    .eq('campeonato_id', campeonatoId)
    .maybeSingle()
  if (readError) throw readError
  if (!atual) throw new Error('Rodada não encontrada.')

  const faseId = String(input.fase_id ?? atual.fase_id)
  await assertCampeonatoFase(campeonatoId, faseId)
  const payload = {
    fase_id: faseId,
    numero: positiveInt(input.numero ?? atual.numero, 'Número da rodada'),
    nome: input.nome === undefined ? atual.nome : (input.nome ? String(input.nome).trim() : null),
    data_inicio: input.data_inicio === undefined ? atual.data_inicio : (input.data_inicio || null),
    data_fim: input.data_fim === undefined ? atual.data_fim : (input.data_fim || null),
    status: input.status ?? atual.status,
  }
  const { data, error } = await supabaseAdmin
    .from('campeonato_rodadas')
    .update(payload)
    .eq('id', rodadaId)
    .eq('campeonato_id', campeonatoId)
    .select('*')
    .single()
  if (error) throw error
  return data
}

export async function excluirRodada(campeonatoId: string, rodadaId: string) {
  const { count, error: countError } = await supabaseAdmin
    .from('campeonato_jogos')
    .select('id', { count: 'exact', head: true })
    .eq('campeonato_id', campeonatoId)
    .eq('rodada_id', rodadaId)
  if (countError) throw countError
  if ((count || 0) > 0) throw new Error('Remova ou desvincule os jogos desta rodada antes de excluí-la.')

  const { error } = await supabaseAdmin
    .from('campeonato_rodadas')
    .delete()
    .eq('id', rodadaId)
    .eq('campeonato_id', campeonatoId)
  if (error) throw error
}

export async function obterConfiguracaoFase(campeonatoId: string, faseId: string) {
  await assertCampeonatoFase(campeonatoId, faseId)
  const [{ data: config, error }, { data: bonus, error: bonusError }] = await Promise.all([
    supabaseAdmin
      .from('campeonato_fases_configuracoes')
      .select('*')
      .eq('campeonato_id', campeonatoId)
      .eq('fase_id', faseId)
      .single(),
    supabaseAdmin
      .from('campeonato_fases_bonus_ranking')
      .select('id, posicao, pontos_bonus')
      .eq('fase_id', faseId)
      .order('posicao'),
  ])
  if (error) throw error
  if (bonusError) throw bonusError
  return { ...config, bonus_ranking: bonus || [] }
}

export async function atualizarConfiguracaoFase(campeonatoId: string, faseId: string, input: FaseConfiguracaoInput) {
  await assertCampeonatoFase(campeonatoId, faseId)

  const payload: Record<string, unknown> = {}
  if ('quantidade_classificados' in input) payload.quantidade_classificados = positiveInt(input.quantidade_classificados, 'Quantidade de classificados', { nullable: true })
  if (input.criterio_classificacao) payload.criterio_classificacao = input.criterio_classificacao
  if (input.modo_decisao) payload.modo_decisao = input.modo_decisao
  if (input.modo_acumulacao) payload.modo_acumulacao = input.modo_acumulacao
  if ('booyah_ouro_pontos_limite' in input) payload.booyah_ouro_pontos_limite = numeric(input.booyah_ouro_pontos_limite, 'Limite do Booyah de Ouro', { min: 0.01, nullable: true })
  if ('booyah_ouro_queda_minima' in input) payload.booyah_ouro_queda_minima = positiveInt(input.booyah_ouro_queda_minima, 'Queda mínima', { nullable: true })
  if (input.booyah_ouro_desempate_final) payload.booyah_ouro_desempate_final = input.booyah_ouro_desempate_final
  if ('jogo_decisivo_id' in input) payload.jogo_decisivo_id = input.jogo_decisivo_id || null

  const { data, error } = await supabaseAdmin
    .from('campeonato_fases_configuracoes')
    .update(payload)
    .eq('campeonato_id', campeonatoId)
    .eq('fase_id', faseId)
    .select('*')
    .single()
  if (error) throw error

  if (Array.isArray(input.bonus_ranking)) {
    const normalized = input.bonus_ranking
      .map((item) => ({
        fase_id: faseId,
        posicao: positiveInt(item.posicao, 'Posição do bônus') as number,
        pontos_bonus: numeric(item.pontos_bonus, 'Pontos de bônus', { min: 0 }) as number,
      }))
      .sort((a, b) => a.posicao - b.posicao)
    const seen = new Set<number>()
    for (const item of normalized) {
      if (seen.has(item.posicao)) throw new Error(`A posição ${item.posicao} foi informada mais de uma vez.`)
      seen.add(item.posicao)
    }

    const { error: deleteError } = await supabaseAdmin
      .from('campeonato_fases_bonus_ranking')
      .delete()
      .eq('fase_id', faseId)
    if (deleteError) throw deleteError
    if (normalized.length) {
      const { error: insertError } = await supabaseAdmin
        .from('campeonato_fases_bonus_ranking')
        .insert(normalized)
      if (insertError) throw insertError
    }
  }

  return obterConfiguracaoFase(campeonatoId, faseId)
}

export async function aplicarBonusRanking(campeonatoId: string, faseId: string, userId: string) {
  await assertCampeonatoFase(campeonatoId, faseId)
  const { data, error } = await supabaseAdmin.rpc('fn_aplicar_bonus_ranking_fase', {
    p_fase_id: faseId,
    p_aplicado_por: userId,
  })
  if (error) throw error
  const { data: equipes, error: equipesError } = await supabaseAdmin
    .from('campeonato_fases_bonus_equipes')
    .select('*')
    .eq('campeonato_id', campeonatoId)
    .eq('fase_id', faseId)
    .order('posicao_origem')
  if (equipesError) throw equipesError
  return { total: Number(data || 0), equipes: equipes || [] }
}
