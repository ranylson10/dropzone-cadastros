import { NextRequest, NextResponse } from 'next/server'
import { getBearerUser } from '@backend/auth/server-auth'
import { getCampeonatoPermission } from '@backend/campeonatos/campeonato-permissions'
import { supabaseAdmin } from '@backend/shared/supabase-admin'

function canManage(permission: Awaited<ReturnType<typeof getCampeonatoPermission>>) {
  return permission.role === 'owner' || permission.role === 'manager' || permission.canManage
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string; assetId: string }> }) {
  try {
    const user = await getBearerUser(req)
    const { id, assetId } = await context.params
    const permission = await getCampeonatoPermission(user.id, id)
    if (!canManage(permission)) return NextResponse.json({ error: 'Sem permissão para alterar a biblioteca deste campeonato.' }, { status: 403 })
    const { error } = await supabaseAdmin.from('campeonato_asset_library').delete().eq('id', assetId).eq('campeonato_id', id)
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro ao remover imagem da biblioteca.' }, { status: 400 })
  }
}
