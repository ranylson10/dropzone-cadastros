import { NextResponse } from 'next/server'
import { carregarResumoCampeao } from '@backend/campeonatos/estatisticas/estatisticas.service'

export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    return NextResponse.json(await carregarResumoCampeao(id))
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro ao carregar campeão da final.' }, { status: 400 })
  }
}
