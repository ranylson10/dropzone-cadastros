import { NextRequest, NextResponse } from 'next/server'
import { listarEstatisticasMvp } from '@backend/campeonatos/estatisticas/estatisticas.service'

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const q = req.nextUrl.searchParams
    const jogadores = await listarEstatisticasMvp(id, {
      faseId: q.get('fase_id'), rodadaId: q.get('rodada_id'), jogoId: q.get('jogo_id'),
      partidaId: q.get('partida_id'), mapaCodigo: q.get('mapa_codigo'), grupoId: q.get('grupo_id'),
    })
    return NextResponse.json({ jogadores })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro ao carregar MVP.' }, { status: 400 })
  }
}
