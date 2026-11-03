import { NextRequest, NextResponse } from 'next/server'
import { getAccountsForUser, getBearerUser } from '@backend/auth/server-auth'
import { supabaseAdmin } from '@backend/shared/supabase-admin'
import { readPagedRows, readRowsByIds } from '@backend/shared/paginated-query'

type Context = { params: Promise<{ id: string }> }
async function requireOwner(req: NextRequest, context: Context) {
  const user = await getBearerUser(req)
  const { id } = await context.params
  const accounts = await getAccountsForUser(user)
  if (!accounts.some(account => account.profile_type === 'jogador' && account.id === id && account.auth_user_id === user.id)) {
    throw new Error('Somente o líder do jogador pode gerenciar vice-líderes.')
  }
  return id
}
function failure(error: unknown) {
  return NextResponse.json({ error: error instanceof Error ? error.message : 'Não foi possível atualizar os acessos.' }, { status: 403 })
}

export async function GET(req: NextRequest, context: Context) {
  try {
    const id = await requireOwner(req, context)
    const staff = await readPagedRows<Record<string, any>>(supabaseAdmin.from('manager_jogador')
      .select('id,manager_id,pode_ver,pode_editar,status').eq('jogador_id', id).eq('status', 'ativo').order('id'))
    const managers = await readRowsByIds<Record<string, any>>(staff.map(row => row.manager_id), ids => supabaseAdmin.from('managers')
      .select('id,nome,username,avatar_url').in('id', ids).order('id'))
    return NextResponse.json({ staff: staff.map(row => ({ ...row, manager: managers.find(manager => manager.id === row.manager_id) || null })) }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) { return failure(error) }
}

export async function PATCH(req: NextRequest, context: Context) {
  try {
    const id = await requireOwner(req, context)
    const body = await req.json()
    const managerId = String(body.manager_id || '').trim()
    if (!managerId || typeof body.pode_ver !== 'boolean' || typeof body.pode_editar !== 'boolean') throw new Error('Informe o manager e as funções permitidas.')
    const { data: manager, error: managerError } = await supabaseAdmin.from('managers').select('id').eq('id', managerId).eq('status', 'ativo').maybeSingle()
    if (managerError) throw managerError
    if (!manager) throw new Error('Manager não encontrado ou inativo.')
    const { data: existing, error: existingError } = await supabaseAdmin.from('manager_jogador').select('id').eq('jogador_id', id).eq('manager_id', managerId).maybeSingle()
    if (existingError) throw existingError
    const permissions = { pode_ver: body.pode_ver, pode_editar: body.pode_ver && body.pode_editar, status: 'ativo', updated_at: new Date().toISOString() }
    const result = existing
      ? await supabaseAdmin.from('manager_jogador').update(permissions).eq('id', existing.id).eq('jogador_id', id)
      : await supabaseAdmin.from('manager_jogador').insert({ ...permissions, manager_id: managerId, jogador_id: id })
    if (result.error) throw result.error
    return NextResponse.json({ ok: true })
  } catch (error) { return failure(error) }
}

export async function DELETE(req: NextRequest, context: Context) {
  try {
    const id = await requireOwner(req, context)
    const body = await req.json()
    const managerId = String(body.manager_id || '').trim()
    if (!managerId) throw new Error('Informe o manager.')
    const { error } = await supabaseAdmin.from('manager_jogador').update({ status: 'removido', pode_ver: false, pode_editar: false, updated_at: new Date().toISOString() })
      .eq('jogador_id', id).eq('manager_id', managerId)
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (error) { return failure(error) }
}
