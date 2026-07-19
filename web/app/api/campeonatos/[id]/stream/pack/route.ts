import { NextRequest, NextResponse } from 'next/server'
import { getBearerUser } from '@backend/auth/server-auth'
import { getCampeonatoPermission } from '@backend/campeonatos/campeonato-permissions'
import { supabaseAdmin } from '@backend/shared/supabase-admin'

function canStream(permission: Awaited<ReturnType<typeof getCampeonatoPermission>>) {
  return (
    permission.role === 'owner'
    || permission.role === 'manager'
    || permission.canManage
    || permission.canOrganizeGroups
    || permission.canManageGames
    || permission.canScore
  )
}

function missingTable(error: any) {
  return ['42P01', 'PGRST205'].includes(error?.code || '')
}

function asIdList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  const out: string[] = []
  for (const item of raw) {
    const id = String(item || '').trim()
    if (!id || seen.has(id)) continue
    seen.add(id)
    out.push(id)
  }
  return out
}

/**
 * GET — composição da live (overlays selecionadas + BG).
 * PUT — salva seleção ordenada e fundo.
 */
export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await getBearerUser(req)
    const { id } = await context.params
    const permission = await getCampeonatoPermission(user.id, id)
    if (!canStream(permission)) {
      return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 })
    }

    const [{ data: pack, error }, { data: overlays }, { data: jogos }] = await Promise.all([
      supabaseAdmin
        .from('campeonato_stream_pack')
        .select('selected_overlay_ids,bg_type,bg_url,active_jogo_id,updated_at')
        .eq('campeonato_id', id)
        .maybeSingle(),
      supabaseAdmin
        .from('campeonato_stream_overlays')
        .select('id,nome,template,share_token,ativo,updated_at')
        .eq('campeonato_id', id)
        .eq('ativo', true)
        .order('updated_at', { ascending: false }),
      supabaseAdmin
        .from('campeonato_jogos')
        .select('id,nome,status,data_jogo,horario,numero_partidas')
        .eq('campeonato_id', id)
        .order('data_jogo', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: true }),
    ])

    if (error) {
      if (missingTable(error)) {
        return NextResponse.json({
          error: 'Rode o SQL: database/migrations/20260719_broadcast_desk_e_pack.sql',
          missing_table: true,
        }, { status: 503 })
      }
      // coluna active_jogo_id ainda não migrada — tenta sem ela
      if (String(error.message || '').includes('active_jogo_id') || error.code === '42703') {
        const fallback = await supabaseAdmin
          .from('campeonato_stream_pack')
          .select('selected_overlay_ids,bg_type,bg_url,updated_at')
          .eq('campeonato_id', id)
          .maybeSingle()
        if (fallback.error && missingTable(fallback.error)) {
          return NextResponse.json({
            error: 'Rode o SQL: database/migrations/20260719_broadcast_desk_e_pack.sql',
            missing_table: true,
          }, { status: 503 })
        }
        if (fallback.error) throw fallback.error
        return NextResponse.json({
          pack: {
            selected_overlay_ids: asIdList(fallback.data?.selected_overlay_ids),
            bg_type: fallback.data?.bg_type || 'none',
            bg_url: fallback.data?.bg_url || null,
            active_jogo_id: null,
            updated_at: fallback.data?.updated_at || null,
          },
          overlays: (overlays || []).map((o) => ({
            id: o.id,
            name: o.nome,
            template: o.template,
            share_token: o.share_token,
            updated_at: o.updated_at,
          })),
          jogos: (jogos || []).map((j) => ({
            id: j.id,
            nome: j.nome,
            status: j.status,
            data_jogo: j.data_jogo,
            horario: j.horario,
            numero_partidas: j.numero_partidas,
          })),
          needs_active_jogo_sql: true,
        })
      }
      throw error
    }

    const selectedIds = asIdList(pack?.selected_overlay_ids)
    return NextResponse.json({
      pack: {
        selected_overlay_ids: selectedIds,
        bg_type: pack?.bg_type || 'none',
        bg_url: pack?.bg_url || null,
        active_jogo_id: pack?.active_jogo_id || null,
        updated_at: pack?.updated_at || null,
      },
      overlays: (overlays || []).map((o) => ({
        id: o.id,
        name: o.nome,
        template: o.template,
        share_token: o.share_token,
        updated_at: o.updated_at,
      })),
      jogos: (jogos || []).map((j) => ({
        id: j.id,
        nome: j.nome,
        status: j.status,
        data_jogo: j.data_jogo,
        horario: j.horario,
        numero_partidas: j.numero_partidas,
      })),
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Erro' }, { status: 400 })
  }
}

export async function PUT(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await getBearerUser(req)
    const { id } = await context.params
    const permission = await getCampeonatoPermission(user.id, id)
    if (!canStream(permission)) {
      return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 })
    }

    const body = await req.json().catch(() => ({}))
    let selectedIds = asIdList(body.selected_overlay_ids)
    const bgTypeRaw = String(body.bg_type || 'none').toLowerCase()
    const bgType = (['none', 'image', 'video'].includes(bgTypeRaw) ? bgTypeRaw : 'none') as
      | 'none'
      | 'image'
      | 'video'
    const bgUrl = body.bg_url === null || body.bg_url === ''
      ? null
      : String(body.bg_url || '').trim().slice(0, 2000) || null

    // active_jogo_id: string uuid | null (limpar) | undefined (não alterar se só bg/overlays)
    let activeJogoId: string | null | undefined = undefined
    if (Object.prototype.hasOwnProperty.call(body, 'active_jogo_id')) {
      const raw = body.active_jogo_id
      if (raw === null || raw === '' || raw === 'auto') {
        activeJogoId = null
      } else {
        activeJogoId = String(raw).trim() || null
        if (activeJogoId) {
          const { data: jogoOk } = await supabaseAdmin
            .from('campeonato_jogos')
            .select('id')
            .eq('id', activeJogoId)
            .eq('campeonato_id', id)
            .maybeSingle()
          if (!jogoOk) {
            return NextResponse.json({ error: 'Jogo inválido para este campeonato.' }, { status: 400 })
          }
        }
      }
    }

    if (selectedIds.length) {
      const { data: valid } = await supabaseAdmin
        .from('campeonato_stream_overlays')
        .select('id')
        .eq('campeonato_id', id)
        .eq('ativo', true)
        .in('id', selectedIds)
      const ok = new Set((valid || []).map((r) => r.id))
      selectedIds = selectedIds.filter((x) => ok.has(x))
    }

    if (bgType !== 'none' && !bgUrl) {
      return NextResponse.json({ error: 'Informe a URL do fundo (PNG ou vídeo).' }, { status: 400 })
    }

    // Se active_jogo_id não veio no body, preserva o valor atual
    let previousActive: string | null = null
    if (activeJogoId === undefined) {
      const { data: prev } = await supabaseAdmin
        .from('campeonato_stream_pack')
        .select('active_jogo_id')
        .eq('campeonato_id', id)
        .maybeSingle()
      previousActive = prev?.active_jogo_id || null
    }

    const row: Record<string, unknown> = {
      campeonato_id: id,
      selected_overlay_ids: selectedIds,
      bg_type: bgType === 'none' ? 'none' : bgType,
      bg_url: bgType === 'none' ? null : bgUrl,
      active_jogo_id: activeJogoId === undefined ? previousActive : activeJogoId,
      updated_at: new Date().toISOString(),
      updated_by: user.id,
    }

    const { data, error } = await supabaseAdmin
      .from('campeonato_stream_pack')
      .upsert(row, { onConflict: 'campeonato_id' })
      .select('selected_overlay_ids,bg_type,bg_url,active_jogo_id,updated_at')
      .single()

    if (error) {
      if (missingTable(error)) {
        return NextResponse.json({
          error: 'Rode o SQL: database/migrations/20260719_broadcast_desk_e_pack.sql',
          missing_table: true,
        }, { status: 503 })
      }
      // SQL da coluna ainda não rodado — salva sem active_jogo_id
      if (String(error.message || '').includes('active_jogo_id') || error.code === '42703') {
        const { active_jogo_id: _drop, ...rowWithout } = row
        const retry = await supabaseAdmin
          .from('campeonato_stream_pack')
          .upsert(rowWithout, { onConflict: 'campeonato_id' })
          .select('selected_overlay_ids,bg_type,bg_url,updated_at')
          .single()
        if (retry.error) throw retry.error
        return NextResponse.json({
          pack: {
            selected_overlay_ids: asIdList(retry.data.selected_overlay_ids),
            bg_type: retry.data.bg_type || 'none',
            bg_url: retry.data.bg_url || null,
            active_jogo_id: null,
            updated_at: retry.data.updated_at,
          },
          needs_active_jogo_sql: true,
          warning: 'Rode database/migrations/20260719_stream_active_jogo.sql para gravar o jogo da live.',
        })
      }
      throw error
    }

    return NextResponse.json({
      pack: {
        selected_overlay_ids: asIdList(data.selected_overlay_ids),
        bg_type: data.bg_type || 'none',
        bg_url: data.bg_url || null,
        active_jogo_id: data.active_jogo_id || null,
        updated_at: data.updated_at,
      },
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Erro' }, { status: 400 })
  }
}
