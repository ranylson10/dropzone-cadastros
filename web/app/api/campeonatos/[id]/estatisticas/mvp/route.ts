import { NextRequest, NextResponse } from 'next/server'
import { listarEstatisticasMvp, listarEstatisticasMvpPublicadas } from '@backend/campeonatos/estatisticas/estatisticas.service'
import { podeVerEstatisticasImediatas } from '@backend/campeonatos/estatisticas/stats-route-auth'

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const q = req.nextUrl.searchParams
    const filters = {
      faseId: q.get('fase_id'), rodadaId: q.get('rodada_id'), jogoId: q.get('jogo_id'),
      partidaId: q.get('partida_id'), mapaCodigo: q.get('mapa_codigo'), grupoId: q.get('grupo_id'),
    }
    const imediato = await podeVerEstatisticasImediatas(req, id)
    const payload = imediato
      ? { jogadores: await listarEstatisticasMvp(id, filters), publicacao: { modo: 'imediato' } }
      : await listarEstatisticasMvpPublicadas(id, filters)
    return NextResponse.json(payload, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro ao carregar MVP.' }, { status: 400 })
  }
}
