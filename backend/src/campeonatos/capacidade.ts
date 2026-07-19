import { supabaseAdmin } from '../shared/supabase-admin'

/**
 * numero_vagas = limite/meta do campeonato (não materializa rows).
 * Capacidade de ENTRADA = slots da fase de entrada (menor `ordem`).
 *
 * Fases seguintes reutilizam equipes classificadas — criar grupos nelas
 * NÃO consome o limite de vagas do campeonato.
 */

type CapacidadeOptions = {
  /** Se informado e NÃO for fase de entrada, assertPodeCriarSlots libera sem checar limite. */
  faseId?: string | null
}

/** Menor `ordem` entre as fases do campeonato (null se não houver fases). */
async function getOrdemFaseEntrada(campeonatoId: string): Promise<number | null> {
  const { data, error } = await supabaseAdmin
    .from('campeonato_fases')
    .select('ordem')
    .eq('campeonato_id', campeonatoId)
    .order('ordem', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  if (!data) return null
  const ordem = Number(data.ordem)
  return Number.isFinite(ordem) ? ordem : null
}

/**
 * Fase de entrada = a(s) fase(s) com menor `ordem`.
 * Sem fases cadastradas, qualquer criação conta como entrada.
 * faseId null também conta como entrada (legado / sem fase).
 */
export async function isFaseDeEntrada(
  campeonatoId: string,
  faseId?: string | null,
): Promise<boolean> {
  if (!faseId) return true

  const [{ data: fase, error: faseError }, ordemEntrada] = await Promise.all([
    supabaseAdmin
      .from('campeonato_fases')
      .select('ordem')
      .eq('id', faseId)
      .eq('campeonato_id', campeonatoId)
      .maybeSingle(),
    getOrdemFaseEntrada(campeonatoId),
  ])

  if (faseError) throw faseError
  // Fase inexistente / de outro campeonato: trata como entrada (conservador).
  if (!fase) return true
  if (ordemEntrada == null) return true

  return Number(fase.ordem) === ordemEntrada
}

/** IDs das fases de entrada (menor ordem). Vazio se não houver fases. */
async function getFaseEntradaIds(campeonatoId: string): Promise<string[]> {
  const ordemEntrada = await getOrdemFaseEntrada(campeonatoId)
  if (ordemEntrada == null) return []

  const { data, error } = await supabaseAdmin
    .from('campeonato_fases')
    .select('id')
    .eq('campeonato_id', campeonatoId)
    .eq('ordem', ordemEntrada)

  if (error) throw error
  return (data || []).map((row) => String(row.id))
}

/**
 * Conta slots de entrada do campeonato.
 * Inclui: slots sem fase + slots das fases com menor ordem.
 * Exclui: slots de fases posteriores (classificados).
 */
async function countSlotsEntrada(
  campeonatoId: string,
  onlyOccupied = false,
): Promise<number> {
  const faseEntradaIds = await getFaseEntradaIds(campeonatoId)

  let query = supabaseAdmin
    .from('campeonato_slots')
    .select('id', { count: 'exact', head: true })
    .eq('campeonato_id', campeonatoId)

  if (onlyOccupied) {
    query = query.or('line_id.not.is.null,status.eq.ocupado')
  }

  // Com fases: conta slots sem fase OU da(s) fase(s) de entrada.
  // Sem fases: todos os slots contam (estrutura de entrada legada).
  if (faseEntradaIds.length > 0) {
    const ids = faseEntradaIds.join(',')
    query = query.or(`fase_id.is.null,fase_id.in.(${ids})`)
  }

  const { count, error } = await query
  if (error) throw error
  return Number(count || 0)
}

export async function getCampeonatoCapacidade(campeonatoId: string) {
  const [{ data: config }, slotsCriados, slotsOcupados] = await Promise.all([
    supabaseAdmin
      .from('campeonato_configuracoes')
      .select('numero_vagas')
      .eq('campeonato_id', campeonatoId)
      .maybeSingle(),
    countSlotsEntrada(campeonatoId, false),
    countSlotsEntrada(campeonatoId, true),
  ])

  const rawLimite = Number(config?.numero_vagas || 0)
  const limite = Number.isFinite(rawLimite) && rawLimite > 0 ? Math.floor(rawLimite) : null

  return {
    /** Meta comercial do campeonato (entrada). */
    limite_vagas: limite,
    /** Slots da fase de entrada (não inclui fases de classificação). */
    slots_criados: slotsCriados,
    slots_ocupados: slotsOcupados,
    slots_livres_estrutura: Math.max(0, slotsCriados - slotsOcupados),
    slots_ainda_podem_ser_criados: limite == null ? null : Math.max(0, limite - slotsCriados),
    vagas_restantes_meta: limite == null ? null : Math.max(0, limite - slotsOcupados),
  }
}

/**
 * Bloqueia criação de N novos slots se estourar o limite do campeonato.
 * Só se aplica à fase de entrada; fases seguintes são liberadas.
 */
export async function assertPodeCriarSlots(
  campeonatoId: string,
  novosSlots: number,
  options?: CapacidadeOptions,
) {
  if (novosSlots <= 0) return

  const faseId = options?.faseId
  const entrada = await isFaseDeEntrada(campeonatoId, faseId)
  if (!entrada) return

  const cap = await getCampeonatoCapacidade(campeonatoId)
  if (cap.limite_vagas == null) return
  if (cap.slots_criados + novosSlots > cap.limite_vagas) {
    throw new Error(
      `Limite de vagas do campeonato é ${cap.limite_vagas}. Já existem ${cap.slots_criados} slot(s) na fase de entrada; não é possível criar mais ${novosSlots}.`,
    )
  }
}
