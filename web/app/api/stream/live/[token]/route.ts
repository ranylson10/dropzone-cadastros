import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@backend/shared/supabase-admin'
import { listarEstatisticasEquipes, listarEstatisticasMvp } from '@backend/campeonatos/estatisticas/estatisticas.service'
import { unpackOverlayBlocks } from '@/features/campeonatos/stream/utils/overlay-frame'

const MAP_IMAGES: Record<string, string> = {
  bermuda: '/images/maps/bermuda.png',
  purgatorio: '/images/maps/purgatorio.png',
  purgatório: '/images/maps/purgatorio.png',
  'nova terra': '/images/maps/nova-terra.png',
  'nova-terra': '/images/maps/nova-terra.png',
  kalahari: '/images/maps/kalahari.png',
  alpine: '/images/maps/alpine.png',
  solara: '/images/maps/solara.png',
  misterioso: '/images/maps/misterioso.png',
}

function mapImageFor(name: string) {
  const key = String(name || '').toLowerCase()
  const hit = Object.entries(MAP_IMAGES).find(([k]) => key.includes(k))
  return hit?.[1] || '/images/maps/bermuda.png'
}

/**
 * Feed público por share_token (Browser Source / vMix).
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
    const [classificacao, mvp, champ, partidas] = await Promise.all([
      listarEstatisticasEquipes(campeonatoId, {}).catch(() => []),
      listarEstatisticasMvp(campeonatoId, {}).catch(() => []),
      supabaseAdmin.from('campeonatos').select('id,nome,logo_url').eq('id', campeonatoId).maybeSingle(),
      (async () => {
        try {
          const r = await supabaseAdmin
            .from('campeonato_partidas_com_mapa')
            .select('id,jogo_id,numero_partida,mapa_codigo,mapa_nome,status,horario')
            .eq('campeonato_id', campeonatoId)
            .order('numero_partida', { ascending: true })
            .limit(12)
          return r.error ? [] : r.data || []
        } catch {
          return []
        }
      })(),
    ])

    const classifRows = (classificacao || []).slice(0, 20).map((row: any, i: number) => ({
      pos: row.colocacao ?? i + 1,
      nome: row.nome || '—',
      logo: row.logo_url || null,
      booyah: row.booyahs ?? 0,
      abates: row.abates ?? 0,
      pts: row.pontos_total ?? 0,
      campeonato_equipe_id: row.campeonato_equipe_id || null,
    }))

    // delta de colocação: compara pos atual com ordem por pts da rodada anterior não existe aqui —
    // placeholder 0; o client anima mudança entre polls.
    const withDelta = classifRows.map((row) => ({ ...row, delta: 0 }))

    const mvpRows = (mvp || []).slice(0, 20).map((row: any, i: number) => {
      const abates = Number(row.abates || 0)
      const quedas = Math.max(1, Number(row.quedas || 1))
      return {
        pos: row.colocacao ?? i + 1,
        nome: row.nick || '—',
        logo: row.foto_url || null,
        abates,
        quedas: row.quedas ?? 0,
        kd: (abates / quedas).toFixed(1).replace('.', ','),
        delta: 0,
      }
    })

    // Súmula por queda: top da partida (1º) alimenta o card de mapa
    const partidaList = partidas as any[]
    const sumulas = await Promise.all(
      partidaList.slice(0, 6).map(async (p) => {
        try {
          const rows = await listarEstatisticasEquipes(campeonatoId, { partidaId: p.id })
          const ordered = (rows || []).map((row: any, i: number) => ({
            pos: row.colocacao ?? i + 1,
            nome: row.nome || '—',
            logo: row.logo_url || null,
            booyah: row.booyahs ?? (row.colocacao === 1 ? 1 : 0),
            abates: row.abates ?? 0,
            pts: row.pontos_total ?? 0,
          }))
          return { partida_id: p.id, equipes: ordered }
        } catch {
          return { partida_id: p.id, equipes: [] as any[] }
        }
      }),
    )
    const sumulaByPartida = new Map(sumulas.map((s) => [s.partida_id, s.equipes]))

    const mapas = partidaList.slice(0, 6).map((p, i) => {
      const mapaNome = p.mapa_nome || p.mapa_codigo || `Mapa ${i + 1}`
      const sumula = sumulaByPartida.get(p.id) || []
      const top = sumula[0] || classifRows[i]
      return {
        title: `${String(mapaNome).toUpperCase()}${p.numero_partida ? ` ${p.numero_partida}` : ''}`,
        imageUrl: mapImageFor(mapaNome),
        logo: top?.logo || null,
        pts: top?.pts ?? 0,
        abates: top?.abates ?? 0,
        nome: top?.nome || '',
        status: p.status || null,
        partida_id: p.id || null,
        sumula: sumula.slice(0, 12),
      }
    })

    if (!mapas.length) {
      ;['Bermuda', 'Purgatório', 'Nova Terra'].forEach((nome, i) => {
        const line = classifRows[i]
        mapas.push({
          title: `${nome.toUpperCase()} ${i + 1}`,
          imageUrl: mapImageFor(nome),
          logo: line?.logo || null,
          pts: line?.pts ?? 0,
          abates: line?.abates ?? 0,
          nome: line?.nome || '',
          status: null,
          partida_id: null,
          sumula: [],
        })
      })
    }

    const packed = unpackOverlayBlocks(overlay.blocks)
    return NextResponse.json({
      overlay: {
        id: overlay.id,
        name: overlay.nome,
        template: overlay.template,
        blocks: packed.blocks,
        frameW: packed.frameW,
        frameH: packed.frameH,
        updatedAt: overlay.updated_at,
      },
      campeonato: champ.data || { id: campeonatoId },
      data: {
        classificacao: withDelta,
        mvp: mvpRows,
        mapas,
        quedas: partidaList.slice(0, 24).map((p) => ({
          id: p.id,
          numero: p.numero_partida,
          mapa: p.mapa_nome || p.mapa_codigo || '—',
          status: p.status || '',
          horario: p.horario || '',
          jogo_id: p.jogo_id,
        })),
      },
      fetchedAt: new Date().toISOString(),
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro no feed live.' }, { status: 400 })
  }
}
