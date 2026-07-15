import { supabaseAdmin } from '../shared/supabase-admin'

/**
 * numero_vagas = limite/meta do campeonato (não materializa rows).
 * Capacidade real = count(campeonato_slots).
 * Preenchidas = slots com line / status ocupado.
 */
export async function getCampeonatoCapacidade(campeonatoId: string) {
  const [{ data: config }, { count: criados, error: criadosError }, { count: ocupados, error: ocupadosError }] =
    await Promise.all([
      supabaseAdmin
        .from('campeonato_configuracoes')
        .select('numero_vagas')
        .eq('campeonato_id', campeonatoId)
        .maybeSingle(),
      supabaseAdmin
        .from('campeonato_slots')
        .select('id', { count: 'exact', head: true })
        .eq('campeonato_id', campeonatoId),
      supabaseAdmin
        .from('campeonato_slots')
        .select('id', { count: 'exact', head: true })
        .eq('campeonato_id', campeonatoId)
        .or('line_id.not.is.null,status.eq.ocupado'),
    ])

  if (criadosError) throw criadosError
  if (ocupadosError) throw ocupadosError

  const rawLimite = Number(config?.numero_vagas || 0)
  const limite = Number.isFinite(rawLimite) && rawLimite > 0 ? Math.floor(rawLimite) : null
  const slotsCriados = Number(criados || 0)
  const slotsOcupados = Number(ocupados || 0)

  return {
    limite_vagas: limite,
    slots_criados: slotsCriados,
    slots_ocupados: slotsOcupados,
    slots_livres_estrutura: Math.max(0, slotsCriados - slotsOcupados),
    slots_ainda_podem_ser_criados: limite == null ? null : Math.max(0, limite - slotsCriados),
    vagas_restantes_meta: limite == null ? null : Math.max(0, limite - slotsOcupados),
  }
}

/** Bloqueia criação de N novos slots se estourar o limite do campeonato. */
export async function assertPodeCriarSlots(campeonatoId: string, novosSlots: number) {
  if (novosSlots <= 0) return
  const cap = await getCampeonatoCapacidade(campeonatoId)
  if (cap.limite_vagas == null) return
  if (cap.slots_criados + novosSlots > cap.limite_vagas) {
    throw new Error(
      `Limite de vagas do campeonato é ${cap.limite_vagas}. Já existem ${cap.slots_criados} slot(s); não é possível criar mais ${novosSlots}.`,
    )
  }
}
