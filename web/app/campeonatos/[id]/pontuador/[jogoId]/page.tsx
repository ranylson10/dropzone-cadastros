'use client'

import { useParams } from 'next/navigation'
import { GameScorer } from '@/features/campeonatos/pontuador/GameScorer'

export default function PontuadorJogoPage() {
  const { id, jogoId } = useParams<{ id: string; jogoId: string }>()
  return <main><GameScorer key={`${id}:${jogoId}`} campeonatoId={id} jogoId={jogoId} /></main>
}
