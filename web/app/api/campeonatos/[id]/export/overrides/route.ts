import { NextRequest, NextResponse } from 'next/server'
import { getBearerUser } from '@backend/auth/server-auth'
import { getCampeonatoPermission } from '@backend/campeonatos/campeonato-permissions'
import { supabaseAdmin } from '@backend/shared/supabase-admin'

function canExport(permission: Awaited<ReturnType<typeof getCampeonatoPermission>>) {
  return (
    permission.role === 'owner'
    || permission.canManage
    || permission.canOrganizeGroups
    || permission.canManageGames
    || permission.canScore
  )
}

const EMPTY = {
  logo_bg_url: null as string | null,
  photo_bg_url: null as string | null,
  logo_margin: { top: 24, right: 24, bottom: 24, left: 24 },
  photo_margin: { top: 30, right: 30, bottom: 30, left: 30 },
  equipes: {} as Record<string, unknown>,
  jogadores: {} as Record<string, unknown>,
  logos: {} as Record<string, unknown>,
  fotos: {} as Record<string, unknown>,
  nation_source: 'funcao',
  role_color: '#000000',
  team_color: '#000000',
  text_colors: null as unknown,
}

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await getBearerUser(req)
    const { id } = await context.params
    const permission = await getCampeonatoPermission(user.id, id)
    if (!canExport(permission)) {
      return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 })
    }

    const { data, error } = await supabaseAdmin
      .from('campeonato_export_overrides')
      .select('*')
      .eq('campeonato_id', id)
      .maybeSingle()

    if (error) {
      // tabela ainda não criada
      if (['42P01', 'PGRST205'].includes(error.code || '')) {
        return NextResponse.json({ overrides: EMPTY, missing_table: true })
      }
      throw error
    }

    if (!data) return NextResponse.json({ overrides: EMPTY })

    return NextResponse.json({
      overrides: {
        logo_bg_url: data.logo_bg_url || null,
        photo_bg_url: data.photo_bg_url || null,
        logo_margin: data.logo_margin || EMPTY.logo_margin,
        photo_margin: data.photo_margin || EMPTY.photo_margin,
        equipes: data.equipes || {},
        jogadores: data.jogadores || {},
        logos: data.logos || {},
        fotos: data.fotos || {},
        nation_source: data.nation_source || 'funcao',
        role_color: data.role_color || '#000000',
        team_color: data.team_color || '#000000',
        text_colors: data.text_colors || null,
        updated_at: data.updated_at || null,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao carregar overrides.'
    const status = message.toLowerCase().includes('autoriza') || message.toLowerCase().includes('token') ? 401 : 400
    return NextResponse.json({ error: message }, { status })
  }
}

/**
 * PATCH body:
 * {
 *   merge: true, // default true — mescla objetos
 *   logo_bg_url?, photo_bg_url?, logo_margin?, photo_margin?,
 *   equipes?, jogadores?, logos?, fotos?,
 *   nation_source?, role_color?, team_color?, text_colors?,
 *   // remoções
 *   remove_logo_keys?: string[],
 *   remove_foto_keys?: string[],
 *   remove_jogador_keys?: string[],
 *   remove_equipe_ids?: string[],
 * }
 */
export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await getBearerUser(req)
    const { id } = await context.params
    const permission = await getCampeonatoPermission(user.id, id)
    if (!canExport(permission)) {
      return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 })
    }

    const body = await req.json().catch(() => ({}))
    const merge = body.merge !== false

    const { data: current, error: readError } = await supabaseAdmin
      .from('campeonato_export_overrides')
      .select('*')
      .eq('campeonato_id', id)
      .maybeSingle()

    if (readError && ['42P01', 'PGRST205'].includes(readError.code || '')) {
      return NextResponse.json(
        {
          error: 'Tabela campeonato_export_overrides não existe. Rode a migration 20260717_campeonato_export_overrides.sql no Supabase.',
          missing_table: true,
        },
        { status: 400 },
      )
    }
    if (readError) throw readError

    const prev = current || {
      campeonato_id: id,
      ...EMPTY,
    }

    const mergeObj = (base: any, patch: any) => {
      if (!patch || typeof patch !== 'object') return base || {}
      if (!merge) return patch
      return { ...(base || {}), ...patch }
    }

    let equipes = mergeObj(prev.equipes, body.equipes)
    let jogadores = mergeObj(prev.jogadores, body.jogadores)
    let logos = mergeObj(prev.logos, body.logos)
    let fotos = mergeObj(prev.fotos, body.fotos)

    for (const k of body.remove_logo_keys || []) delete logos[k]
    for (const k of body.remove_foto_keys || []) delete fotos[k]
    for (const k of body.remove_jogador_keys || []) delete jogadores[k]
    for (const k of body.remove_equipe_ids || []) delete equipes[k]

    // se enviar logos_replace = true, substitui o mapa inteiro (lista final salva)
    if (body.logos_replace === true && body.logos && typeof body.logos === 'object') {
      logos = body.logos
    }
    if (body.fotos_replace === true && body.fotos && typeof body.fotos === 'object') {
      fotos = body.fotos
    }

    const row = {
      campeonato_id: id,
      logo_bg_url: body.logo_bg_url !== undefined ? body.logo_bg_url : prev.logo_bg_url ?? null,
      photo_bg_url: body.photo_bg_url !== undefined ? body.photo_bg_url : prev.photo_bg_url ?? null,
      logo_margin: body.logo_margin || prev.logo_margin || EMPTY.logo_margin,
      photo_margin: body.photo_margin || prev.photo_margin || EMPTY.photo_margin,
      equipes,
      jogadores,
      logos,
      fotos,
      nation_source: body.nation_source || prev.nation_source || 'funcao',
      role_color: body.role_color || prev.role_color || '#000000',
      team_color: body.team_color || prev.team_color || '#000000',
      text_colors: body.text_colors !== undefined ? body.text_colors : prev.text_colors ?? null,
      updated_at: new Date().toISOString(),
      updated_by: user.id,
    }

    const { data: saved, error } = await supabaseAdmin
      .from('campeonato_export_overrides')
      .upsert(row, { onConflict: 'campeonato_id' })
      .select('*')
      .single()

    if (error) throw error

    return NextResponse.json({ ok: true, overrides: saved })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao salvar overrides.'
    const status = message.toLowerCase().includes('autoriza') || message.toLowerCase().includes('token') ? 401 : 400
    return NextResponse.json({ error: message }, { status })
  }
}
