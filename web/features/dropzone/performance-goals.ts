export type PerformanceGoalSample = {
  kills: number | null
  dano: number | null
  colocacao: number | null
  sobrevivencia: number | null
}

export type PerformanceGoal = {
  key: 'kills' | 'dano' | 'colocacao' | 'sobrevivencia'
  label: string
  current: number | null
  reference: number | null
  target: number | null
  progress: number | null
  status: 'atingida' | 'proxima' | 'em_construcao' | 'insuficiente'
  lowerIsBetter: boolean
}

function average(values: Array<number | null>) {
  const clean = values.filter((value): value is number => value !== null && Number.isFinite(value))
  return clean.length ? clean.reduce((sum, value) => sum + value, 0) / clean.length : null
}

export function buildObjectivePerformanceGoals(samples: PerformanceGoalSample[], blockSize = 5): PerformanceGoal[] {
  const metrics = [
    { key: 'kills' as const, label: 'Kills', lowerIsBetter: false },
    { key: 'dano' as const, label: 'Dano', lowerIsBetter: false },
    { key: 'colocacao' as const, label: 'Colocação', lowerIsBetter: true },
    { key: 'sobrevivencia' as const, label: 'Sobrevivência', lowerIsBetter: false },
  ]

  if (samples.length < blockSize * 2) {
    return metrics.map((metric) => ({ ...metric, current: null, reference: null, target: null, progress: null, status: 'insuficiente' as const }))
  }

  const currentRows = samples.slice(-blockSize)
  const previousRows = samples.slice(0, -blockSize)
  const historicalBlocks: PerformanceGoalSample[][] = []
  for (let end = previousRows.length; end >= blockSize; end -= blockSize) {
    historicalBlocks.push(previousRows.slice(end - blockSize, end))
  }

  return metrics.map((metric) => {
    const current = average(currentRows.map((row) => row[metric.key]))
    const historical = historicalBlocks
      .map((block) => average(block.map((row) => row[metric.key])))
      .filter((value): value is number => value !== null)
    const reference = historical[0] ?? null
    if (current === null || reference === null || !historical.length) {
      return { ...metric, current, reference, target: null, progress: null, status: 'insuficiente' as const }
    }

    const target = metric.lowerIsBetter ? Math.min(...historical) : Math.max(...historical)
    const achieved = metric.lowerIsBetter ? current <= target : current >= target
    const improvedVsReference = metric.lowerIsBetter ? current < reference : current > reference
    const status: PerformanceGoal['status'] = achieved ? 'atingida' : improvedVsReference ? 'proxima' : 'em_construcao'
    const rawProgress = metric.lowerIsBetter
      ? (current > 0 ? (target / current) * 100 : 100)
      : (target > 0 ? (current / target) * 100 : 100)

    return {
      ...metric,
      current,
      reference,
      target,
      progress: Math.max(0, Math.min(100, rawProgress)),
      status,
    }
  })
}
