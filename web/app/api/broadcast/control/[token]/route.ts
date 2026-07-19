import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@backend/shared/supabase-admin'

function asIdList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw.map((x) => String(x || '').trim()).filter(Boolean)
}

async function loadPackOverlays(campeonatoId: string | null) {
  if (!campeonatoId) {
    return { pack: null as any, overlays: [] as any[] }
  }

  const [{ data: pack }, { data: allOverlays }] = await Promise.all([
    supabaseAdmin
      .from('campeonato_stream_pack')
      .select('selected_overlay_ids,bg_type,bg_url,updated_at')
      .eq('campeonato_id', campeonatoId)
      .maybeSingle(),
    supabaseAdmin
      .from('campeonato_stream_overlays')
      .select('id,nome,template,share_token,updated_at,ativo')
      .eq('campeonato_id', campeonatoId)
      .eq('ativo', true)
      .order('updated_at', { ascending: false }),
  ])

  const all = allOverlays || []
  const byId = new Map(all.map((o) => [o.id, o]))
  const selectedIds = asIdList(pack?.selected_overlay_ids)

  // Se o admin ainda não configurou o pack, não mostra nada (força composição).
  // Se pack existe com lista, só as selecionadas na ordem.
  let ordered = selectedIds.map((id) => byId.get(id)).filter(Boolean) as typeof all

  // fallback legado: pack vazio mas table inexistente / nunca salva → todas
  // (pack null = SQL/pack ainda não usado; lista vazia = escolha consciente de zero)
  if (!pack) {
    ordered = all
  }

  return {
    pack: pack
      ? {
          selected_overlay_ids: selectedIds,
          bg_type: pack.bg_type || 'none',
          bg_url: pack.bg_url || null,
          updated_at: pack.updated_at,
        }
      : null,
    overlays: ordered.map((o) => ({
      id: o.id,
      name: o.nome,
      template: o.template,
      share_token: o.share_token,
      updated_at: o.updated_at,
    })),
  }
}

async function loadLives(broadcastId: string) {
  const { data: links } = await supabaseAdmin
    .from('broadcast_campeonato_links')
    .select('id,campeonato_id,display_name,created_at')
    .eq('broadcast_id', broadcastId)
    .order('created_at', { ascending: false })

  const champIds = (links || []).map((l) => l.campeonato_id)
  let champs: any[] = []
  if (champIds.length) {
    const { data } = await supabaseAdmin
      .from('campeonatos')
      .select('id,nome,logo_url,status')
      .in('id', champIds)
    champs = data || []
  }
  const byId = new Map(champs.map((c) => [c.id, c]))

  return (links || []).map((l) => ({
    id: l.id,
    campeonato_id: l.campeonato_id,
    display_name: l.display_name,
    campeonato: byId.get(l.campeonato_id) || null,
  }))
}

/**
 * Controlador de live (token público único do Stream).
 * GET — lives da lista + cenas do campeonato selecionado
 * POST — { campeonato_id } troca a live | { active_overlay_id } troca a cena
 */
export async function GET(_req: NextRequest, context: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await context.params
    const clean = String(token || '').trim()
    if (!clean || clean.length < 16) {
      return NextResponse.json({ error: 'Token inválido.' }, { status: 400 })
    }

    const { data: session, error } = await supabaseAdmin
      .from('broadcast_live_sessions')
      .select('id,broadcast_id,nome,campeonato_id,active_overlay_id,controller_token,obs_token,ativo,updated_at')
      .eq('controller_token', clean)
      .eq('ativo', true)
      .maybeSingle()

    if (error) {
      if (['42P01', 'PGRST205'].includes(error.code || '')) {
        return NextResponse.json({ error: 'Broadcast não configurado no banco.' }, { status: 503 })
      }
      throw error
    }
    if (!session) return NextResponse.json({ error: 'Sessão não encontrada.' }, { status: 404 })

    const [lives, packData, champ] = await Promise.all([
      loadLives(session.broadcast_id),
      loadPackOverlays(session.campeonato_id),
      session.campeonato_id
        ? supabaseAdmin
            .from('campeonatos')
            .select('id,nome,logo_url')
            .eq('id', session.campeonato_id)
            .maybeSingle()
            .then((r) => r.data)
        : Promise.resolve(null),
    ])

    return NextResponse.json({
      session: {
        id: session.id,
        nome: session.nome,
        campeonato_id: session.campeonato_id,
        active_overlay_id: session.active_overlay_id,
        obs_token: session.obs_token,
        updated_at: session.updated_at,
      },
      lives,
      campeonato: champ || null,
      pack: packData.pack,
      overlays: packData.overlays,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Erro' }, { status: 400 })
  }
}

export async function POST(req: NextRequest, context: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await context.params
    const clean = String(token || '').trim()
    if (!clean || clean.length < 16) {
      return NextResponse.json({ error: 'Token inválido.' }, { status: 400 })
    }

    const body = await req.json().catch(() => ({}))

    const { data: session, error: sErr } = await supabaseAdmin
      .from('broadcast_live_sessions')
      .select('id,broadcast_id,campeonato_id')
      .eq('controller_token', clean)
      .eq('ativo', true)
      .maybeSingle()

    if (sErr) throw sErr
    if (!session) return NextResponse.json({ error: 'Sessão não encontrada.' }, { status: 404 })

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }

    // Trocar live (campeonato)
    if (Object.prototype.hasOwnProperty.call(body, 'campeonato_id')) {
      const nextChamp =
        body.campeonato_id === null || body.campeonato_id === ''
          ? null
          : String(body.campeonato_id || '').trim() || null

      if (nextChamp) {
        const { data: link } = await supabaseAdmin
          .from('broadcast_campeonato_links')
          .select('id')
          .eq('broadcast_id', session.broadcast_id)
          .eq('campeonato_id', nextChamp)
          .maybeSingle()
        if (!link) {
          return NextResponse.json({ error: 'Campeonato não está na lista deste Stream.' }, { status: 403 })
        }
      }

      patch.campeonato_id = nextChamp
      // ao trocar a live, limpa a overlay no ar (OBS fica em espera até escolher cena)
      patch.active_overlay_id = null
    }

    // Trocar overlay/cena no ar
    if (Object.prototype.hasOwnProperty.call(body, 'active_overlay_id')) {
      const overlayId =
        body.active_overlay_id === null || body.active_overlay_id === ''
          ? null
          : String(body.active_overlay_id || '').trim() || null

      const champId = (patch.campeonato_id as string | null | undefined) !== undefined
        ? (patch.campeonato_id as string | null)
        : session.campeonato_id

      if (overlayId) {
        if (!champId) {
          return NextResponse.json({ error: 'Selecione uma live (campeonato) antes da cena.' }, { status: 400 })
        }

        const { data: ov } = await supabaseAdmin
          .from('campeonato_stream_overlays')
          .select('id')
          .eq('id', overlayId)
          .eq('campeonato_id', champId)
          .eq('ativo', true)
          .maybeSingle()
        if (!ov) {
          return NextResponse.json({ error: 'Overlay não pertence a este campeonato.' }, { status: 400 })
        }

        // se pack existe, só permite overlays selecionadas
        const { data: pack } = await supabaseAdmin
          .from('campeonato_stream_pack')
          .select('selected_overlay_ids')
          .eq('campeonato_id', champId)
          .maybeSingle()

        if (pack) {
          const allowed = asIdList(pack.selected_overlay_ids)
          if (allowed.length > 0 && !allowed.includes(overlayId)) {
            return NextResponse.json(
              { error: 'Esta overlay não está na composição da live do campeonato.' },
              { status: 400 },
            )
          }
        }
      }

      patch.active_overlay_id = overlayId
    }

    if (Object.keys(patch).length <= 1) {
      return NextResponse.json({ error: 'Nada para atualizar. Envie campeonato_id ou active_overlay_id.' }, { status: 400 })
    }

    const { data: updated, error } = await supabaseAdmin
      .from('broadcast_live_sessions')
      .update(patch)
      .eq('id', session.id)
      .select('id,campeonato_id,active_overlay_id,updated_at,nome')
      .single()

    if (error) throw error

    const packData = await loadPackOverlays(updated.campeonato_id)
    const champ = updated.campeonato_id
      ? (
          await supabaseAdmin
            .from('campeonatos')
            .select('id,nome,logo_url')
            .eq('id', updated.campeonato_id)
            .maybeSingle()
        ).data
      : null

    return NextResponse.json({
      session: updated,
      campeonato: champ,
      pack: packData.pack,
      overlays: packData.overlays,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Erro' }, { status: 400 })
  }
}
