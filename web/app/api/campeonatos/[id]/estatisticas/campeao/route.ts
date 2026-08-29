import { NextRequest, NextResponse } from 'next/server'
import { carregarResumoCampeao, carregarResumoCampeaoPublicado } from '@backend/campeonatos/estatisticas/estatisticas.service'
import { podeVerEstatisticasImediatas } from '@backend/campeonatos/estatisticas/stats-route-auth'

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const imediato = await podeVerEstatisticasImediatas(req, id)
    const payload = imediato ? await carregarResumoCampeao(id) : await carregarResumoCampeaoPublicado(id)
    return NextResponse.json(payload, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro ao carregar campeão da final.' }, { status: 400 })
  }
}
