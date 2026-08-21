import { NextRequest, NextResponse } from 'next/server'
import { getBearerUser } from '@backend/auth/server-auth'
import { requireCampeonatoTokenPermission } from '@backend/campeonatos/campeonato-permissions'

/** Convites com slot reservado foram substituídos por links de inscrição do grupo. */
export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const user = await getBearerUser(req)
    await requireCampeonatoTokenPermission(user.id, id)
    return NextResponse.json(
      { error: 'Convites diretos por slot foram descontinuados. Gere um link de inscrição do grupo.' },
      { status: 410 },
    )
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Não foi possível verificar a permissão.' },
      { status: 400 },
    )
  }
}
