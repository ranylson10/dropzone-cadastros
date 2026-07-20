import { NextRequest, NextResponse } from 'next/server'
import { assertCampeonatoNoAr } from '@backend/admin/aprovacao'
import { supabaseAdmin } from '@backend/shared/supabase-admin'
import { listarEstatisticasEquipes, listarEstatisticasMvp } from '@backend/campeonatos/estatisticas/estatisticas.service'
import {
  loadPartidasForStream,
  resolveStreamContext,
} from '@backend/campeonatos/stream/stream-context'
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

function mapImageFor(name: string, fallback?: string | null) {
  if (fallback) return String(fallback)
  const key = String(name || '').toLowerCase()
  const hit = Object.entries(MAP_IMAGES).find(([k]) => key.includes(k))
  return hit?.[1] || '/images/maps/bermuda.png'
}

function text(v: unknown) {
  if (v == null) return ''
  return String(v)
}

/**
 * Feed público por share_token (Browser Source / vMix).
 * Filtra mapas/partidas pelo jogo ativo da live (pack ou auto-detect).
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
    await assertCampeonatoNoAr(campeonatoId)
    const streamCtx = await resolveStreamContext(campeonatoId)
    const activeJogoId = streamCtx.activeJogoId

    type MapaCat = { codigo?: string; nome?: string; imagem_url?: string | null }

    const [classificacao, mvp, champ, partidasRaw, mapasCatRes] = await Promise.all([
      listarEstatisticasEquipes(campeonatoId, {
        jogoId: activeJogoId || undefined,
      }).catch(() => [] as any[]),
      listarEstatisticasMvp(campeonatoId, {
        jogoId: activeJogoId || undefined,
      }).catch(() => [] as any[]),
      supabaseAdmin.from('campeonatos').select('id,nome,logo_url').eq('id', campeonatoId).maybeSingle(),
      loadPartidasForStream(campeonatoId, activeJogoId),
      supabaseAdmin
        .from('dropzone_mapas')
        .select('codigo, nome, imagem_url')
        .eq('ativo', true),
    ])

    const mapasCat: MapaCat[] = Array.isArray(mapasCatRes?.data) ? mapasCatRes.data : []
    const mapaByCode = new Map(
      mapasCat.map((m) => [String(m.codigo || '').toLowerCase(), m]),
    )

    const classifRows = (classificacao || []).slice(0, 20).map((row: any, i: number) => ({
      pos: row.colocacao ?? i + 1,
      nome: row.nome || '—',
      logo: row.logo_url || null,
      booyah: row.booyahs ?? 0,
      abates: row.abates ?? 0,
      pts: row.pontos_total ?? 0,
      campeonato_equipe_id: row.campeonato_equipe_id || null,
    }))

    const withDelta = classifRows.map((row: typeof classifRows[number]) => ({ ...row, delta: 0 as number }))

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
        delta: 0 as number,
      }
    })

    const partidaList = (partidasRaw as any[]).map((p: any) => {
      const codigo = text(p.mapa_codigo || '').toLowerCase()
      const cat = mapaByCode.get(codigo)
      const mapaNome = text(p.mapa_nome || cat?.nome || p.mapa_codigo || 'Mapa')
      return {
        ...p,
        mapa_nome: mapaNome,
        mapa_imagem: mapImageFor(mapaNome, p.mapa_imagem_url || cat?.imagem_url || null),
      }
    })

    // Súmula por queda: top da partida (1º) alimenta o card de mapa
    const sumulas = await Promise.all(
      partidaList.slice(0, 12).map(async (p) => {
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

    const mapas = partidaList.slice(0, 12).map((p, i) => {
      const mapaNome = p.mapa_nome || p.mapa_codigo || `Mapa ${i + 1}`
      const sumula = sumulaByPartida.get(p.id) || []
      const top = sumula[0]
      return {
        title: `${String(mapaNome).toUpperCase()}${p.numero_partida ? ` · Q${p.numero_partida}` : ''}`,
        imageUrl: p.mapa_imagem || mapImageFor(mapaNome),
        logo: top?.logo || null,
        pts: top?.pts ?? 0,
        abates: top?.abates ?? 0,
        nome: top?.nome || '',
        status: p.status || null,
        partida_id: p.id || null,
        sumula: sumula.slice(0, 12),
      }
    })

    // Planilha "mapas" para tabelas e cells (mesmo formato do editor)
    const mapasSheet = partidaList.map((p, i) => {
      const sumula = sumulaByPartida.get(p.id) || []
      const top = sumula[0]
      const mapaNome = String(p.mapa_nome || p.mapa_codigo || `Mapa ${i + 1}`).toUpperCase()
      return {
        id: p.id,
        cells: {
          imagem: p.mapa_imagem || mapImageFor(mapaNome),
          nome: mapaNome,
          mapa: mapaNome,
          booyah_logo: text(top?.logo || ''),
          booyah_nome: text(top?.nome || (sumula.length ? '—' : 'sem pontuação')),
          pontos: text(top?.pts ?? 0),
          abates: text(top?.abates ?? 0),
          jogo: text(streamCtx.activeJogo?.nome || ''),
          queda: text(p.numero_partida || i + 1),
          status: text(p.status || ''),
          partida_id: text(p.id),
        },
      }
    })

    const equipesSheet = withDelta.map((row: typeof withDelta[number]) => ({
      id: `eq-${row.pos}`,
      cells: {
        pos: text(row.pos),
        colocacao: text(row.pos),
        nome: text(row.nome),
        logo: text(row.logo || ''),
        booyahs: text(row.booyah ?? 0),
        abates: text(row.abates ?? 0),
        pontos: text(row.pts ?? 0),
        delta: text(row.delta ?? 0),
      },
    }))

    const mvpSheet = mvpRows.map((row: typeof mvpRows[number]) => ({
      id: `mvp-${row.pos}`,
      cells: {
        pos: text(row.pos),
        colocacao: text(row.pos),
        nick: text(row.nome),
        nome: text(row.nome),
        logo: text(row.logo || ''),
        foto: text(row.logo || ''),
        abates: text(row.abates ?? 0),
        quedas: text(row.quedas ?? 0),
        kd: text(row.kd || '0'),
        delta: text(row.delta ?? 0),
      },
    }))

    // Partida atual / próxima dentro do jogo ativo
    let currentIdx = partidaList.findIndex((p) => /em_andamento|andamento|live|ao.?vivo|em_jogo/i.test(p.status || ''))
    if (currentIdx < 0) {
      let lastDone = -1
      for (let i = 0; i < partidaList.length; i++) {
        if (/finaliz|conclu|encerr|done|finished/i.test(partidaList[i].status || '')) lastDone = i
      }
      currentIdx = lastDone >= 0 ? lastDone : (partidaList.length ? 0 : -1)
    }
    const current = currentIdx >= 0 ? partidaList[currentIdx] : null
    const next = currentIdx >= 0 ? partidaList[currentIdx + 1] || null : null

    const partidaAtualSheet = current
      ? [{
          id: current.id,
          cells: {
            mapa_nome: String(current.mapa_nome || '').toUpperCase(),
            mapa_img: current.mapa_imagem || mapImageFor(current.mapa_nome || ''),
            queda_atual: text(current.numero_partida || currentIdx + 1),
            quedas_totais: text(partidaList.length),
            jogo: text(streamCtx.activeJogo?.nome || ''),
            status: text(current.status || '—'),
          },
        }]
      : [{
          id: 'empty',
          cells: {
            mapa_nome: '—',
            mapa_img: '',
            queda_atual: '0',
            quedas_totais: text(partidaList.length),
            jogo: text(streamCtx.activeJogo?.nome || ''),
            status: activeJogoId ? 'sem quedas neste jogo' : 'sem jogo ativo',
          },
        }]

    const proximaSheet = next
      ? [{
          id: next.id,
          cells: {
            mapa_nome: String(next.mapa_nome || '').toUpperCase(),
            mapa_img: next.mapa_imagem || mapImageFor(next.mapa_nome || ''),
            queda_numero: text(next.numero_partida || currentIdx + 2),
            jogo: text(streamCtx.activeJogo?.nome || ''),
          },
        }]
      : [{
          id: 'empty-next',
          cells: {
            mapa_nome: '—',
            mapa_img: '',
            queda_numero: '—',
            jogo: text(streamCtx.activeJogo?.nome || ''),
          },
        }]

    const sheets = {
      mapas: mapasSheet,
      quedas: mapasSheet,
      equipes_geral: equipesSheet,
      classificacao: equipesSheet,
      equipes: equipesSheet,
      mvp: mvpSheet,
      partida_atual: partidaAtualSheet,
      proxima_queda: proximaSheet,
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
      context: {
        active_jogo_id: activeJogoId,
        active_jogo: streamCtx.activeJogo,
        source: streamCtx.source,
      },
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
        sheets,
      },
      fetchedAt: new Date().toISOString(),
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro no feed live.' }, { status: 400 })
  }
}
