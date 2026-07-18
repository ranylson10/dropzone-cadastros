import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@backend/shared/supabase-admin'
import { listarEstatisticasEquipes, listarEstatisticasMvp } from '@backend/campeonatos/estatisticas/estatisticas.service'

/**
 * Feed público por share_token (Browser Source / vMix).
 * Não exige login; o token é o segredo da URL.
 */
export async function GET(_req: NextRequest, context: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await context.params
    const clean = String(token || '').trim()
    if (!clean || clean.length < 16) {
      return NextResponse.json({ error: 'Token inválido.' }, { status: 400 })
    }

    const { data: overlay, error } = await supabaseAdmin
      .from('campeonato_stream_overlays')
      .select('id,campeonato_id,nome,template,blocks,share_token,updated_at,ativo')
      .eq('share_token', clean)
      .eq('ativo', true)
      .maybeSingle()

    if (error) {
      if (['42P01', 'PGRST205'].includes(error.code || '')) {
        return NextResponse.json({ error: 'Stream ainda não configurado no banco.' }, { status: 503 })
      }
      throw error
    }
    if (!overlay) return NextResponse.json({ error: 'Overlay não encontrada.' }, { status: 404 })

    const campeonatoId = overlay.campeonato_id as string
    const [classificacao, mvp, champ] = await Promise.all([
      listarEstatisticasEquipes(campeonatoId, {}).catch(() => []),
      listarEstatisticasMvp(campeonatoId, {}).catch(() => []),
      supabaseAdmin.from('campeonatos').select('id,nome,logo_url').eq('id', campeonatoId).maybeSingle(),
    ])

    return NextResponse.json({
      overlay: {
        id: overlay.id,
        name: overlay.nome,
        template: overlay.template,
        blocks: overlay.blocks || [],
        updatedAt: overlay.updated_at,
      },
      campeonato: champ.data || { id: campeonatoId },
      data: {
        classificacao: (classificacao || []).slice(0, 20).map((row: any, i: number) => ({
          pos: row.colocacao ?? i + 1,
          nome: row.nome || '—',
          logo: row.logo_url || null,
          booyah: row.booyahs ?? 0,
          abates: row.abates ?? 0,
          pts: row.pontos_total ?? 0,
        })),
        mvp: (mvp || []).slice(0, 20).map((row: any, i: number) => {
          const abates = Number(row.abates || 0)
          const quedas = Math.max(1, Number(row.quedas || 1))
          return {
            pos: row.colocacao ?? i + 1,
            nome: row.nick || '—',
            logo: row.foto_url || null,
            abates,
            quedas: row.quedas ?? 0,
            kd: (abates / quedas).toFixed(1).replace('.', ','),
          }
        }),
      },
      fetchedAt: new Date().toISOString(),
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro no feed live.' }, { status: 400 })
  }
}
