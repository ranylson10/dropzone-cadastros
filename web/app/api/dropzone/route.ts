import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath, revalidateTag } from 'next/cache'
import { getActiveAccount, getBearerUser } from '@backend/auth/server-auth'
import { listEntities } from '@backend/dropzone/entities/list-entities'
import { createEntity } from '@backend/dropzone/entities/create-entity'
import { updateEntity } from '@backend/dropzone/entities/update-entity'
import { removeEntity } from '@backend/dropzone/entities/remove-entity'
import type { EntityContext } from '@backend/dropzone/entities/context'

async function contextFor(req: NextRequest): Promise<EntityContext> {
  const user = await getBearerUser(req)
  const account = await getActiveAccount(req, user)
  return { user, account, origin: req.nextUrl.origin, invalidateTag: tag => revalidateTag(tag, { expire: 0 }), invalidatePath: revalidatePath }
}

export async function GET(req: NextRequest) {
  try {
    const context = await contextFor(req)
    return NextResponse.json(await listEntities(context, new URL(req.url).searchParams))
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro ao listar.' }, { status: 400 })
  }
}

export async function POST(req: NextRequest) {
  let requestEntityType = ''
  try {
    const context = await contextFor(req)
    const body = await req.json()
    requestEntityType = String(body.entity_type || '').trim()
    return NextResponse.json(await createEntity(context, body))
  } catch (error: any) {
    console.error('[dropzone POST]', { entity_type: requestEntityType || null, code: error?.code || null, message: error?.message || String(error) })
    return NextResponse.json({ error: error?.message || 'Erro ao salvar.' }, { status: error?.code === '23505' ? 409 : 400 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const context = await contextFor(req)
    return NextResponse.json(await updateEntity(context, await req.json()))
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro ao editar.' }, { status: 400 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const context = await contextFor(req)
    return NextResponse.json(await removeEntity(context, await req.json()))
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro ao excluir.' }, { status: 400 })
  }
}
