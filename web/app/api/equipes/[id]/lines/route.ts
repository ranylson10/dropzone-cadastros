import { NextRequest, NextResponse } from 'next/server'
import { getAccountsForUser, getBearerUser } from '@backend/auth/server-auth'
import { requireEquipeAccess } from '@backend/equipes/manager-team-access'
import { supabaseAdmin } from '@backend/shared/supabase-admin'

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await getBearerUser(req)
    const accounts = await getAccountsForUser(user)
    const { id: equipeId } = await context.params
    await requireEquipeAccess(user.id, accounts, equipeId, 'ver')

    const [{ data: lines, error }, { data: parts, error: partsError }] = await Promise.all([
      supabaseAdmin
        .from('equipe_lines')
        .select('id,equipe_id,nome,tag,logo_url,status,created_at,updated_at')
        .eq('equipe_id', equipeId)
        .neq('status', 'inativo')
        .order('created_at', { ascending: true }),
      supabaseAdmin
        .from('campeonato_equipes')
        .select('id,line_id,campeonato_id,status,nome_exibicao')
        .eq('equipe_id', equipeId)
        .eq('status', 'ativo'),
    ])
    if (error) throw error
    if (partsError) throw partsError

    const campIds = [...new Set((parts || []).map((p) => p.campeonato_id).filter(Boolean))]
    const { data: camps } = campIds.length
      ? await supabaseAdmin.from('campeonatos').select('id,nome,logo_url,status').in('id', campIds)
      : { data: [] as any[] }
    const campMap = new Map((camps || []).map((c) => [c.id, c]))

    const partsByLine = new Map<string, any[]>()
    for (const p of parts || []) {
      if (!p.line_id) continue
      const list = partsByLine.get(p.line_id) || []
      list.push(p)
      partsByLine.set(p.line_id, list)
    }

    return NextResponse.json({
      lines: (lines || []).map((line) => ({
        ...line,
        campeonatos: (partsByLine.get(line.id) || []).map((p) => {
          const c = campMap.get(p.campeonato_id)
          return {
            participacao_id: p.id,
            campeonato_id: p.campeonato_id,
            nome: c?.nome || p.nome_exibicao || 'Campeonato',
            logo_url: c?.logo_url || null,
            status: c?.status || p.status,
          }
        }),
      })),
      participacoes: (parts || []).map((p) => {
        const c = campMap.get(p.campeonato_id)
        return {
          ...p,
          campeonato: c || null,
        }
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
