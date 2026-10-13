import { supabaseAdmin } from '../../shared/supabase-admin'
import { readPagedRows, readRowsByIds } from '../../shared/paginated-query'
import { isPublicDirectoryRow } from '../../shared/public-visibility'

export const DEFAULT_PUBLIC_STATS_DELAY_SECONDS = 300

export type PublicacaoEstatisticas = {
  delay_segundos: number
  corte_em: string
  partidas_publicadas: string[]
}
function normalizeDelay(value: unknown) {
  if (!['number', 'string'].includes(typeof value) || String(value).trim() === '') return DEFAULT_PUBLIC_STATS_DELAY_SECONDS
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0) return DEFAULT_PUBLIC_STATS_DELAY_SECONDS
  if (parsed === 0) return 0
  return Math.max(1, Math.min(7200, Math.round(parsed)))
}

/** One clock cut for a scoped set of championships; hidden parents have no entry. */
export async function carregarPublicacoesEstatisticas(campeonatoIds: string[]): Promise<Map<string, PublicacaoEstatisticas>> {
  const parents = await readRowsByIds<any>(campeonatoIds, batch => supabaseAdmin
    .from('campeonatos').select('id,status,aprovacao_status,deleted_at')
    .in('id', batch).order('id', { ascending: true }))
  const publicIds = parents.filter(isPublicDirectoryRow).map(row => String(row.id))
  const configs = new Map<string, any>()
  try {
    for (const row of await readRowsByIds<any>(publicIds, batch => supabaseAdmin
      .from('campeonato_configuracoes').select('campeonato_id,estatisticas_delay_segundos')
      .in('campeonato_id', batch).order('campeonato_id', { ascending: true }))) configs.set(String(row.campeonato_id), row)
  } catch (error: any) {
    if (!['42703', 'PGRST204'].includes(error?.code || '')) throw error
    configs.clear()
  }
  const now = Date.now()
  const publications = new Map(publicIds.map(id => {
    const delay = normalizeDelay(configs.get(id)?.estatisticas_delay_segundos)
    return [id, { delay_segundos: delay, corte_em: new Date(now - delay * 1000).toISOString(), partidas_publicadas: [] as string[] }] as const
  }))
  const partidas = await readRowsByIds<any>(publicIds, batch => supabaseAdmin
    .from('campeonato_partidas').select('id,campeonato_id,finalizada_em')
    .in('campeonato_id', batch).eq('status', 'finalizada')
    .not('finalizada_em', 'is', null).lte('finalizada_em', new Date(now).toISOString())
    .order('id', { ascending: true }))
  for (const partida of partidas) {
    const publication = publications.get(String(partida.campeonato_id))
    const finalizedAt = Date.parse(String(partida.finalizada_em))
    if (publication && Number.isFinite(finalizedAt) && finalizedAt <= Date.parse(publication.corte_em)) publication.partidas_publicadas.push(String(partida.id))
  }
  return publications
}

export async function carregarPublicacaoEstatisticas(campeonatoId: string): Promise<PublicacaoEstatisticas> {
  const { data: campeonato, error: championshipError } = await supabaseAdmin
    .from('campeonatos')
    .select('id,status,aprovacao_status,deleted_at')
    .eq('id', campeonatoId)
    .maybeSingle()
  if (championshipError) throw championshipError
  if (!campeonato || !isPublicDirectoryRow(campeonato)) throw new Error('Campeonato não disponível para leitura pública.')

  const { data: configuracao, error: configError } = await supabaseAdmin
    .from('campeonato_configuracoes')
    .select('estatisticas_delay_segundos')
    .eq('campeonato_id', campeonatoId)
    .maybeSingle()

  // Compatibilidade durante a aplicacao da migration: nunca libera resultados
  // instantaneamente apenas porque a coluna ainda nao chegou ao ambiente.
  const missingDelayColumn = ['42703', 'PGRST204'].includes(configError?.code || '')
  if (configError && !missingDelayColumn) throw configError

  const delaySegundos = normalizeDelay(configuracao?.estatisticas_delay_segundos)
  const corteEm = new Date(Date.now() - delaySegundos * 1000).toISOString()
  const partidas = await readPagedRows<any>(supabaseAdmin
    .from('campeonato_partidas')
    .select('id')
    .eq('campeonato_id', campeonatoId)
    .eq('status', 'finalizada')
    .not('finalizada_em', 'is', null)
    .lte('finalizada_em', corteEm)
    .order('id', { ascending: true }))

  return {
    delay_segundos: delaySegundos,
    corte_em: corteEm,
    partidas_publicadas: (partidas || []).map((partida: any) => String(partida.id)).filter(Boolean),
  }
}
