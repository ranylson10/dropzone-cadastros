import { supabaseAdmin } from '../shared/supabase-admin'
import type { LigaPlan } from './liga-plan'

/** Call only after authorizing this read. Common championships never query Liga columns. */
export async function loadLigaConfig(campeonatoId: string, canManage: boolean, knownType?: string): Promise<LigaPlan | null> {
  if (!canManage) return null
  let type = knownType
  if (type === undefined) {
    const { data, error } = await supabaseAdmin.from('campeonatos').select('tipo').eq('id', campeonatoId).maybeSingle()
    if (error) throw error
    type = String(data?.tipo || '')
  }
  if (type !== 'liga') return null
  const { data, error } = await supabaseAdmin.from('campeonato_configuracoes')
    .select('liga_nome_agrupamento,liga_divisoes').eq('campeonato_id', campeonatoId).maybeSingle()
  if (error) throw error
  if (!data) throw new Error('O plano da Liga não foi configurado. Revise a configuração antes de gerenciar equipes.')
  // Project only fields needed by operational consumers; never serialize arbitrary configuration.
  return {
    nome_agrupamento: String(data.liga_nome_agrupamento || 'Agrupamentos'),
    divisoes: (Array.isArray(data.liga_divisoes) ? data.liga_divisoes : []).map((division: any) => ({
      id: String(division?.id || ''), nome: typeof division?.nome === 'string' ? division.nome : '', codigo: String(division?.codigo || ''), equipes: String(division?.equipes || ''),
      entradas: (Array.isArray(division?.entradas) ? division.entradas : []).map((entry: any) => ({
        id: String(entry?.id || ''), tipo: typeof entry?.tipo === 'string' ? entry.tipo : '',
        quantidade: typeof entry?.quantidade === 'string' || typeof entry?.quantidade === 'number' ? String(entry.quantidade) : '', origem_agrupamento_id: String(entry?.origem_agrupamento_id || ''),
      })),
    })),
  }
}
