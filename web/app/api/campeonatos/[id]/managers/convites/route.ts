import { NextRequest, NextResponse } from 'next/server'
import { getBearerUser } from '@backend/auth/server-auth'
import {
  listChampionshipManagerInvites,
  createChampionshipManagerInvite,
  cancelChampionshipManagerInvite,
} from '@backend/campeonatos/manager-invite-service'

type Context = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, context: Context) {
  try {
    const user = await getBearerUser(req)
    const { id } = await context.params
    return NextResponse.json(await listChampionshipManagerInvites(id, user.id))
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro ao listar convites.' }, { status: 400 })
  }
}

export async function POST(req: NextRequest, context: Context) {
  try {
    const user = await getBearerUser(req)
    const { id } = await context.params
    return NextResponse.json(await createChampionshipManagerInvite(id, user.id, () => req.json().catch(() => ({}))))
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro ao criar convite.' }, { status: 400 })
  }
}

export async function DELETE(req: NextRequest, context: Context) {
  try {
    const user = await getBearerUser(req)
    const { id } = await context.params
    return NextResponse.json(await cancelChampionshipManagerInvite(id, user.id, () => req.json().catch(() => ({})), req.nextUrl.searchParams.get('convite_id')))
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro ao cancelar convite.' }, { status: 400 })
  }
}
