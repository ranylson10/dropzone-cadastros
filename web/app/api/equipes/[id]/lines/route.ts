import { NextRequest, NextResponse } from 'next/server'
import { getAccountsForUser, getBearerUser } from '@backend/auth/server-auth'
import { requireEquipeAccess } from '@backend/equipes/manager-team-access'
import { supabaseAdmin } from '@backend/shared/supabase-admin'

export async function GET(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: equipeId } = await context.params
    const [
      { data: team, error: teamError },
      { data: lines, error: linesError },
      { data: memberships, error: membershipsError },
      { data: roster, error: rosterError },
      { data: parts, error: partsError },
    ] = await Promise.all([
      supabaseAdmin
        .from('equipes')
        .select('id,nome,username,logo_url,tag,public_id,status,localidade,cidade,estado,pais')
        .eq('id', equipeId)
        .eq('status', 'ativo')
        .maybeSingle(),
      supabaseAdmin
        .from('equipe_lines')
        .select('id,equipe_id,nome,tag,logo_url,status,created_at,updated_at')
        .eq('equipe_id', equipeId)
        .neq('status', 'inativo')
        .order('created_at', { ascending: true }),
      supabaseAdmin
        .from('equipe_line_jogadores')
        .select('line_id,equipe_jogador_id,status')
        .eq('equipe_id', equipeId)
        .eq('status', 'ativo'),
      supabaseAdmin
        .from('equipe_jogadores')
        .select('id,equipe_id,nick,id_jogo,funcao,foto_url,localidade,status,jogador_auth_user_id')
        .eq('equipe_id', equipeId)
        .eq('status', 'ativo')
        .order('nick'),
      supabaseAdmin
        .from('campeonato_equipes')
        .select('id,line_id,campeonato_id,status,nome_exibicao')
        .eq('equipe_id', equipeId)
        .eq('status', 'ativo'),
    ])
    if (teamError) throw teamError
    if (!team) throw new Error('Equipe não encontrada.')
    if (linesError) throw linesError
    if (membershipsError) throw membershipsError
    if (rosterError) throw rosterError
    if (partsError) throw partsError

    const campIds = [...new Set((parts || []).map((p) => p.campeonato_id).filter(Boolean))]
    const playerAuthIds = [...new Set((roster || []).map((p:any) => p.jogador_auth_user_id).filter(Boolean))]
    const { data: camps, error: campsError } = campIds.length
      ? await supabaseAdmin
          .from('campeonatos')
          .select('id,nome,logo_url,status,aprovacao_status')
          .in('id', campIds)
          .eq('aprovacao_status', 'aprovado')
          .is('deleted_at', null)
      : { data: [] as any[], error: null }
    if (campsError) throw campsError

    const { data: playerProfiles, error: playerProfilesError } = playerAuthIds.length
      ? await supabaseAdmin.from('jogadores').select('id,auth_user_id').in('auth_user_id', playerAuthIds).eq('status', 'ativo')
      : { data: [] as any[], error: null }
    if (playerProfilesError) throw playerProfilesError
    const profileByAuth = new Map((playerProfiles || []).map((profile:any) => [profile.auth_user_id, profile.id]))

    const campMap = new Map((camps || []).map((c) => [c.id, c]))
    const rosterMap = new Map((roster || []).map((player:any) => {
      const { jogador_auth_user_id: authId, ...publicPlayer } = player
      return [player.id, { ...publicPlayer, jogador_id: authId ? profileByAuth.get(authId) || null : null }]
    }))
    const membersByLine = new Map<string, any[]>()
    for (const membership of memberships || []) {
      const player = rosterMap.get(membership.equipe_jogador_id)
      if (!player) continue
      const list = membersByLine.get(membership.line_id) || []
      list.push(player)
      membersByLine.set(membership.line_id, list)
    }

    const partsByLine = new Map<string, any[]>()
    for (const participation of parts || []) {
      if (!participation.line_id) continue
      const championship = campMap.get(participation.campeonato_id)
      if (!championship) continue
      const list = partsByLine.get(participation.line_id) || []
      list.push({
        participacao_id: participation.id,
        campeonato_id: participation.campeonato_id,
        nome: championship.nome || participation.nome_exibicao || 'Campeonato',
        logo_url: championship.logo_url || null,
        status: championship.status || participation.status,
      })
      partsByLine.set(participation.line_id, list)
    }

    return NextResponse.json({
      team,
      lines: (lines || []).map((line) => ({
        ...line,
        jogadores: membersByLine.get(line.id) || [],
        campeonatos: partsByLine.get(line.id) || [],
      })),
      participacoes: (parts || []).flatMap((participation) => {
        const championship = campMap.get(participation.campeonato_id)
        return championship ? [{ ...participation, campeonato: championship }] : []
      }),
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro ao listar lines.' }, { status: 400 })
  }
}

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await getBearerUser(req)
    const accounts = await getAccountsForUser(user)
    const { id: equipeId } = await context.params
    await requireEquipeAccess(user.id, accounts, equipeId, 'editar')

    const body = await req.json().catch(() => ({}))
    const nome = String(body.nome || '').trim()
    const tag = String(body.tag || '').trim() || null
    const logoUrl = String(body.logo_url || '').trim() || null
    if (!nome) throw new Error('Informe o nome da line.')

    const { data: equipe } = await supabaseAdmin
      .from('equipes')
      .select('id,logo_url,tag')
      .eq('id', equipeId)
      .maybeSingle()

    const { data, error } = await supabaseAdmin
      .from('equipe_lines')
      .insert({
        equipe_id: equipeId,
        nome,
        tag: tag || equipe?.tag || null,
        logo_url: logoUrl || equipe?.logo_url || null,
        status: 'ativo',
      })
      .select('*')
      .single()
    if (error?.code === '23505') throw new Error('Já existe uma line com esse nome nesta equipe.')
    if (error) throw error
    return NextResponse.json({ ok: true, line: data }, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro ao criar line.' }, { status: 400 })
  }
}

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await getBearerUser(req)
    const accounts = await getAccountsForUser(user)
    const { id: equipeId } = await context.params
    await requireEquipeAccess(user.id, accounts, equipeId, 'editar')

    const body = await req.json().catch(() => ({}))
    const lineId = String(body.line_id || body.id || '').trim()
    if (!lineId) throw new Error('line_id obrigatório.')

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (body.nome !== undefined) {
      const nome = String(body.nome || '').trim()
      if (!nome) throw new Error('Nome inválido.')
      patch.nome = nome
    }
    if (body.tag !== undefined) patch.tag = String(body.tag || '').trim() || null
    if (body.logo_url !== undefined) patch.logo_url = String(body.logo_url || '').trim() || null
    if (body.status !== undefined) patch.status = String(body.status || 'ativo')
    // logo_url já tratado acima

    const { data, error } = await supabaseAdmin
      .from('equipe_lines')
      .update(patch)
      .eq('id', lineId)
      .eq('equipe_id', equipeId)
      .select('*')
      .single()
    if (error?.code === '23505') throw new Error('Já existe uma line com esse nome nesta equipe.')
    if (error) throw error
    return NextResponse.json({ ok: true, line: data })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro ao editar line.' }, { status: 400 })
  }
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await getBearerUser(req)
    const accounts = await getAccountsForUser(user)
    const { id: equipeId } = await context.params
    await requireEquipeAccess(user.id, accounts, equipeId, 'editar')

    const lineId = String(req.nextUrl.searchParams.get('line_id') || '').trim()
    if (!lineId) throw new Error('line_id obrigatório.')

    const { count } = await supabaseAdmin
      .from('campeonato_equipes')
      .select('id', { count: 'exact', head: true })
      .eq('line_id', lineId)
      .eq('status', 'ativo')
    if (Number(count || 0) > 0) {
      throw new Error('Não é possível apagar: line ainda inscrita em campeonato ativo. Remova a inscrição antes.')
    }

    const { error } = await supabaseAdmin
      .from('equipe_lines')
      .update({ status: 'inativo', updated_at: new Date().toISOString() })
      .eq('id', lineId)
      .eq('equipe_id', equipeId)
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro ao apagar line.' }, { status: 400 })
  }
}
