'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { RefreshCcw } from 'lucide-react'
import { confirmAction } from '@/components/feedback'
import { DropzoneLoader } from '@/components/feedback/DropzoneLoader'
import { Select } from '@/components/ui/Field'
import { supabase } from '@/lib/supabase-browser'

const GameScorer = dynamic(() => import('./GameScorer').then(module => module.GameScorer), {
  loading: () => <DropzoneLoader label="Carregando pontuador" />,
})
type Game = { id: string; nome: string; fase_id: string; fase?: { nome: string; ordem?: number }; numero_partidas: number }

export function ProducerScoringWorkspace({ campeonatoId, onPendingChange }: { campeonatoId: string; onPendingChange?: (pending: boolean, busy?: boolean) => void }) {
  const [games, setGames] = useState<Game[]>([])
  const [phaseId, setPhaseId] = useState('')
  const [gameId, setGameId] = useState('')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  const pendingRef = useRef(false)
  const phases = useMemo(() => [...new Map(games.map(game => [game.fase_id, game.fase])).entries()]
    .sort((a, b) => (a[1]?.ordem || 0) - (b[1]?.ordem || 0)), [games])

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true); setError(''); setGames([]); setGameId(''); setPhaseId('')
    void (async () => {
      try {
        const { data } = await supabase.auth.getSession()
        if (!data.session) throw new Error('Entre novamente na sua conta.')
        const response = await fetch(`/api/campeonatos/${campeonatoId}/pontuador/jogos`, {
          signal: controller.signal, headers: { Authorization: `Bearer ${data.session.access_token}` },
        })
        const result = await response.json()
        if (!response.ok) throw new Error(result.error || 'Não foi possível carregar os jogos.')
        if (controller.signal.aborted) return
        setGames(result.jogos || [])
        const first = result.jogos?.[0]
        setPhaseId(first?.fase_id || ''); setGameId(first?.id || '')
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Erro ao carregar os jogos.')
      } finally { if (!controller.signal.aborted) setLoading(false) }
    })()
    return () => controller.abort()
  }, [campeonatoId, revision])

  async function changeDestination(nextPhase: string, nextGame: string) {
    if (busy) return
    if (nextPhase === phaseId && nextGame === gameId) return
    if (pendingRef.current && !await confirmAction('Há pontuação ou vínculos não salvos. Descartar e trocar de jogo?')) return
    pendingRef.current = false; onPendingChange?.(false)
    setPhaseId(nextPhase); setGameId(nextGame)
  }

  return <div className="producer-scoring-workspace">
    <div className="producer-scoring-destination">
      <label>Fase<Select aria-label="Fase" value={phaseId} disabled={loading || busy} onChange={event => {
        const next = event.target.value
        void changeDestination(next, games.find(game => game.fase_id === next)?.id || '')
      }}><option value="">Selecione a fase</option>{phases.map(([id, phase]) => <option key={id} value={id}>{phase?.nome || 'Fase'}</option>)}</Select></label>
      <label>Jogo<Select aria-label="Jogo" value={gameId} disabled={loading || busy || !phaseId} onChange={event => void changeDestination(phaseId, event.target.value)}>
        <option value="">Selecione o jogo</option>{games.filter(game => game.fase_id === phaseId).map(game => <option key={game.id} value={game.id}>{game.nome} · {game.numero_partidas} quedas</option>)}
      </Select></label>
      <button type="button" className="button secondary" disabled={loading || busy} onClick={async () => {
        if (pendingRef.current && !await confirmAction('Descartar as alterações não salvas e atualizar os jogos?')) return
        pendingRef.current = false; onPendingChange?.(false); setRevision(value => value + 1)
      }}><RefreshCcw size={16} />Atualizar jogos</button>
    </div>
    {loading ? <DropzoneLoader label="Carregando jogos" /> : error ? <p role="alert">{error}</p> : !games.length ? <p className="empty">Cadastre um jogo em Jogos e quedas para começar a pontuar.</p> : null}
    {gameId ? <GameScorer key={`${campeonatoId}:${gameId}`} campeonatoId={campeonatoId} jogoId={gameId} embedded onPendingChange={(pending, busy) => { pendingRef.current = pending; setBusy(Boolean(busy)); onPendingChange?.(pending, busy) }} /> : null}
  </div>
}
