import { supabaseAdmin } from '../../shared/supabase-admin'

export const DEFAULT_PUBLIC_STATS_DELAY_SECONDS = 300

export type PublicacaoEstatisticas = {
  delay_segundos: number
  corte_em: string
  partidas_publicadas: string[]
}
function normalizeDelay(value: unknown) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return DEFAULT_PUBLIC_STATS_DELAY_SECONDS
  return Math.max(0, Math.min(7200, Math.round(parsed)))
}

export async function carregarPublicacaoEstatisticas(campeonatoId: string): Promise<PublicacaoEstatisticas> {
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
  const { data: partidas, error: partidasError } = await supabaseAdmin
    .from('campeonato_partidas')
    .select('id')
    .eq('campeonato_id', campeonatoId)
    .eq('status', 'finalizada')
    .not('finalizada_em', 'is', null)
    .lte('finalizada_em', corteEm)

  if (partidasError) throw partidasError
  return {
    delay_segundos: delaySegundos,
    corte_em: corteEm,
    partidas_publicadas: (partidas || []).map((partida: any) => String(partida.id)).filter(Boolean),
  }
}
