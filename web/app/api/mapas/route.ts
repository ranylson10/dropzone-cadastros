import { NextResponse } from 'next/server'
import { listarMapasCatalogo } from '@backend/campeonatos/jogos/jogos.service'

export async function GET() {
  try {
    const mapas = await listarMapasCatalogo()
    return NextResponse.json({ mapas })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao carregar mapas.' },
      { status: 400 },
    )
  }
}
