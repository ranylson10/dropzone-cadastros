'use client'

import { useCallback, useEffect, useState } from 'react'
import { campeonatoEquipesService } from '../services/campeonato-equipes.service'
import type { CampeonatoEquipesPayload } from '../types/campeonato-equipes.types'

export function useCampeonatoEquipes(campeonatoId: string) {
  const [data, setData] = useState<CampeonatoEquipesPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const reload = useCallback(async () => {
    if (!campeonatoId) return
    setLoading(true)
    setError('')
    try {
      setData(await campeonatoEquipesService.listar(campeonatoId) as CampeonatoEquipesPayload)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar vagas.')
    } finally {
      setLoading(false)
    }
  }, [campeonatoId])

  useEffect(() => { void reload() }, [reload])
  return { data, loading, error, reload }
}
