import { NextRequest, NextResponse } from 'next/server'
import { getBearerUser } from '@backend/auth/server-auth'
import {
  isMissingRelation,
  requireEquipeOwner,
} from '@backend/equipes/manager-invites'
import { supabaseAdmin } from '@backend/shared/supabase-admin'

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await getBearerUser(req)
    const { id: equipeId } = await context.params
    await requireEquipeOwner(equipeId, user.id)

    const [{ data: staff, error: staffError }, convitesResult] = await Promise.all([
      supabaseAdmin
        .from('manager_equipe')
        .select('id,manager_id,pode_ver,pode_editar,pode_escalar,pode_gerar_token,status,created_at')
        .eq('equipe_id', equipeId)
        .eq('status', 'ativo')
        .order('created_at', { ascending: true }),
      supabaseAdmin
        .from('equipe_manager_convites')
        .select('*')
        .eq('equipe_id', equipeId)
        .order('created_at', { ascending: false })
        .limit(50),
    ])

    if (staffError) throw staffError

    let convites = convitesResult.data || []
    if (convitesResult.error && !isMissingRelation(convitesResult.error)) throw convitesResult.error
    if (convitesResult.error && isMissingRelation(convitesResult.error)) convites = []

    const managerIds = [
      ...new Set([
        ...(staff || []).map((s) => s.manager_id).filter(Boolean),
        ...convites.map((c: any) => c.manager_id).filter(Boolean),
      ]),
    ] as string[]

    const { data: managers } = managerIds.length
      ? await supabaseAdmin
          .from('managers')
          .select('id,username,nome,avatar_url,public_id,public_id_prefix,status')
          .in('id', managerIds)
      : { data: [] as any[] }

    const managerMap = new Map((managers || []).map((m) => [m.id, m]))

    return NextResponse.json({
      staff: (staff || []).map((row) => ({
        ...row,
        manager: managerMap.get(row.manager_id) || null,
      })),
      convites: convites.map((row: any) => ({
        ...row,
        manager: row.manager_id ? managerMap.get(row.manager_id) || null : null,
      })),
    })
  } catch (error: any) {
    const msg = error?.message || 'Erro ao listar staff.'
    const status = /dono da equipe|não encontrada|nao encontrada/i.test(msg) ? 403 : 400
    return NextResponse.json({ error: msg }, { status })
  }
}

/** Atualiza permissões de um manager no staff. */
export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await getBearerUser(req)
    const { id: equipeId } = await context.params
    await requireEquipeOwner(equipeId, user.id)

    const body = await req.json().catch(() => ({}))
    const managerId = String(body.manager_id || '').trim()
    if (!managerId) throw new Error('manager_id obrigatório.')

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (body.pode_ver !== undefined) patch.pode_ver = Boolean(body.pode_ver)
    if (body.pode_editar !== undefined) patch.pode_editar = Boolean(body.pode_editar)
    if (body.pode_escalar !== undefined) patch.pode_escalar = Boolean(body.pode_escalar)
    if (body.pode_gerar_token !== undefined) patch.pode_gerar_token = Boolean(body.pode_gerar_token)

    const { data, error } = await supabaseAdmin
      .from('manager_equipe')
      .update(patch)
      .eq('equipe_id', equipeId)
      .eq('manager_id', managerId)
      .eq('status', 'ativo')
      .select('id,manager_id,pode_ver,pode_editar,pode_escalar,pode_gerar_token,status')
      .maybeSingle()
    if (error) throw error
    if (!data) throw new Error('Vínculo de staff não encontrado.')

    return NextResponse.json({ ok: true, staff: data })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro ao atualizar staff.' }, { status: 400 })
  }
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await getBearerUser(req)
    const { id: equipeId } = await context.params
    await requireEquipeOwner(equipeId, user.id)

    const body = await req.json().catch(() => ({}))
    const managerId = String(body.manager_id || '').trim()
    if (!managerId) throw new Error('manager_id obrigatório.')

    const { data, error } = await supabaseAdmin
      .from('manager_equipe')
      .update({ status: 'removido', updated_at: new Date().toISOString() })
      .eq('equipe_id', equipeId)
      .eq('manager_id', managerId)
      .eq('status', 'ativo')
      .select('id')
      .maybeSingle()
    if (error) throw error
    if (!data) throw new Error('Vínculo de staff não encontrado.')

    return NextResponse.json({ ok: true })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro ao remover staff.' }, { status: 400 })
  }
}
