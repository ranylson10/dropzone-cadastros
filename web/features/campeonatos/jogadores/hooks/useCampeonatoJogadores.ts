'use client'

import { useCallback, useEffect, useState } from 'react'
import { listarCampeonatoJogadores } from '../services/campeonato-jogadores.service'
import type { CampeonatoJogadoresPayload } from '../types/campeonato-jogadores.types'

export function useCampeonatoJogadores(campeonatoId: string) {
  const [data, setData] = useState<CampeonatoJogadoresPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const reload = useCallback(async () => {
    if (!campeonatoId) return
    setLoading(true)
    setError('')
    try {
      setData(await listarCampeonatoJogadores(campeonatoId) as CampeonatoJogadoresPayload)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar escalações.')
    } finally {
      setLoading(false)
    }
  }, [campeonatoId])

  useEffect(() => { void reload() }, [reload])
  return { data, loading, error, reload }
}
