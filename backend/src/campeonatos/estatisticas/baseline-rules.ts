export type BaselinePartida = {
  id: string
  campeonato_id?: string | null
  fase_id?: string | null
  jogo_id?: string | null
  numero_partida: number
  status?: string | null
  mapa_codigo?: string | null
  mapa_nome?: string | null
}

const SUM_FIELDS = [
  'abates', 'dano', 'assistencias', 'headshots', 'knockdowns', 'sobrevivencia_segundos',
  'distancia_movida', 'revives', 'membros_revividos', 'membros_resgatados',
  'kits_medicos', 'gel_destruido',
] as const

function number(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export function resolveBaselineCut(partidas: BaselinePartida[], partidaIdAtual: string) {
  const atual = partidas.find((partida) => String(partida.id) === String(partidaIdAtual))
  if (!atual) throw new Error('A queda atual não pertence ao jogo informado.')
  const numeroAtual = number(atual.numero_partida)
  if (!Number.isInteger(numeroAtual) || numeroAtual < 1) throw new Error('A queda atual não possui ordem competitiva válida.')
  const anteriores = partidas
    .filter((partida) => number(partida.numero_partida) < numeroAtual && String(partida.status || '') === 'finalizada')
    .sort((a, b) => number(a.numero_partida) - number(b.numero_partida))
  return { atual, anteriores, baselineAteQueda: Math.max(0, numeroAtual - 1) }
}

export type DetailedPlayerRow = Record<string, unknown> & {
  campeonato_jogador_id?: string | null
  campeonato_equipe_id?: string | null
  player_id?: string | null
}

export function aggregateDetailedPlayerRows(rows: DetailedPlayerRow[]) {
  const invalidRows = rows.filter((row) => !String(row.campeonato_jogador_id || '').trim())
  const aggregate = new Map<string, Record<string, unknown>>()
  for (const row of rows) {
    const key = String(row.campeonato_jogador_id || '').trim()
    if (!key) continue
    const current = aggregate.get(key) || {
      campeonato_jogador_id: key,
      campeonato_equipe_id: row.campeonato_equipe_id || null,
      jogador_id: row.jogador_id || null,
      jogador_temporario_id: row.jogador_temporario_id || null,
      player_id: row.player_id || null,
      nick_snapshot: row.nick_snapshot || null,
      partidas_detalhadas: 0,
      distancia_max_abate: 0,
    }
    current.partidas_detalhadas = number(current.partidas_detalhadas) + 1
    for (const field of SUM_FIELDS) current[field] = number(current[field]) + number(row[field])
    current.distancia_max_abate = Math.max(number(current.distancia_max_abate), number(row.distancia_max_abate))
    aggregate.set(key, current)
  }
  return { players: [...aggregate.values()], invalidRows }
}

export function officialTeamBaseline(row: Record<string, unknown>) {
  return {
    drops: number(row.quedas),
    points: number(row.pontos_total),
    kills: number(row.abates),
    booyahs: number(row.booyahs),
  }
}
