import { NextRequest, NextResponse } from 'next/server'
import { getBearerUser } from '@backend/auth/server-auth'
import { getCampeonatoPermission } from '@backend/campeonatos/campeonato-permissions'
import { publishRulebook } from '@backend/campeonatos/rulebook'

function canManageRulebook(permission: Awaited<ReturnType<typeof getCampeonatoPermission>>) {
  return permission.role === 'owner' || permission.canManage || permission.canOrganizeGroups
}

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await getBearerUser(req)
    const { id } = await context.params
    const permission = await getCampeonatoPermission(user.id, id)

    if (!canManageRulebook(permission)) {
      return NextResponse.json(
        { error: 'Sem permissão para publicar o regulamento.' },
        { status: 403 },
      )
    }

    let forceConfirmAlerts: Record<string, boolean> | undefined
    try {
      const body = await req.json()
      forceConfirmAlerts = body?.confirmacoes_alertas
    } catch {
      forceConfirmAlerts = undefined
    }

    const result = await publishRulebook({
      campeonatoId: id,
      userId: user.id,
      forceConfirmAlerts,
    })

    return NextResponse.json({ ok: true, ...result })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Erro ao publicar regulamento.' },
      { status: 400 },
    )
  }
}
