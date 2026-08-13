import { NextRequest, NextResponse } from 'next/server'
import { getBearerUser } from '@backend/auth/server-auth'
import { getCampeonatoPermission } from '@backend/campeonatos/campeonato-permissions'
import { supabaseAdmin } from '@backend/shared/supabase-admin'

function canManageArt(permission: Awaited<ReturnType<typeof getCampeonatoPermission>>) {
  return permission.role === 'owner' || permission.role === 'manager' || permission.canManage
}

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await getBearerUser(req)
    const { id } = await context.params
    const permission = await getCampeonatoPermission(user.id, id)
    if (!canManageArt(permission)) return NextResponse.json({ error: 'Sem permissão para carregar os booyahs deste campeonato.' }, { status: 403 })

    const jogoId = String(req.nextUrl.searchParams.get('jogo_id') || '').trim()
    if (!jogoId) return NextResponse.json({ error: 'Selecione um jogo.' }, { status: 400 })

    const [{ data: quedas, error: quedasError }, { data: resultados, error: resultadosError }] = await Promise.all([
      supabaseAdmin
        .from('campeonato_partidas_com_mapa')
        .select('*')
        .eq('campeonato_id', id)
        .eq('jogo_id', jogoId)
        .order('numero_partida'),
      supabaseAdmin
        .from('campeonato_estatisticas_equipes_detalhe')
        .select('partida_id,nome_exibicao,line_nome,equipe_nome,line_logo_url,equipe_logo_url,abates,pontos_total,booyah')
        .eq('campeonato_id', id)
        .eq('jogo_id', jogoId),
    ])
    if (quedasError) throw quedasError
    if (resultadosError) throw resultadosError

    const winnerByPartida = new Map<string, any>()
    for (const row of resultados || []) {
      if (!row.booyah) continue
      winnerByPartida.set(String(row.partida_id || ''), row)
    }

    const items = (quedas || []).flatMap((queda: any, index: number) => {
      const winner = winnerByPartida.get(String(queda.id || ''))
      if (!winner) return []
      return [{
        partida_id: String(queda.id || ''),
        round: `QUEDA ${Number(queda.numero_partida) || index + 1}`,
        map_name: String(queda.mapa_nome || queda.mapa_codigo || `Mapa ${index + 1}`),
        map_image: String(queda.mapa_imagem_url || queda.imagem_url || ''),
        logo: String(winner.line_logo_url || winner.equipe_logo_url || ''),
        name: String(winner.nome_exibicao || winner.line_nome || winner.equipe_nome || 'Equipe'),
        points: Number(winner.pontos_total || 0),
        kills: Number(winner.abates || 0),
      }]
    })

    return NextResponse.json({ items })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro ao carregar os booyahs do jogo.' }, { status: 400 })
  }
}
