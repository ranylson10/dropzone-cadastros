'use client'

import { useCallback, useEffect } from 'react'
import {useScopedState} from '@/hooks/useScopedState'
import {useAccountResourceScope} from '@/hooks/useAccountResourceScope'
import { campeonatoEquipesService } from '../services/campeonato-equipes.service'
import type { CampeonatoEquipesPayload } from '../types/campeonato-equipes.types'

export function useCampeonatoEquipes(campeonatoId: string) {
  const scope=useAccountResourceScope(campeonatoId)
  const [data, setData] = useScopedState<CampeonatoEquipesPayload | null>(scope.key,null)
  const [loading, setLoading] = useScopedState(scope.key,true)
  const [error, setError] = useScopedState(scope.key,'')

  const reload = useCallback(async () => {
    if (!campeonatoId||!scope.ready||!scope.isCurrent()) return null
    setLoading(true)
    setError('')
    try {
      const next=await campeonatoEquipesService.listar(campeonatoId) as CampeonatoEquipesPayload
      if(!scope.isCurrent())return null
      if(next.participation_actor_id!=null&&next.participation_actor_id!==scope.actor)throw new Error('A conta mudou. Atualize o acompanhamento.')
      setData(next);return next
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar vagas.')
      return null
    } finally {
      setLoading(false)
    }
  }, [campeonatoId,scope.key,scope.ready])

  useEffect(() => { void reload() }, [reload])
  return { data, loading, error, reload }
}
