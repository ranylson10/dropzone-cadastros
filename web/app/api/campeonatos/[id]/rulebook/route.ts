import { NextRequest, NextResponse } from 'next/server'
import { getBearerUser } from '@backend/auth/server-auth'
import { getCampeonatoPermission } from '@backend/campeonatos/campeonato-permissions'
import {
  getOrCreateRulebook,
  getPublishedRulebook,
  getRulebook,
  saveRulebook,
} from '@backend/campeonatos/rulebook'
import type { RulebookSaveInput } from '@backend/campeonatos/rulebook'

function canManageRulebook(permission: Awaited<ReturnType<typeof getCampeonatoPermission>>) {
  return permission.role === 'owner' || permission.canManage || permission.canOrganizeGroups
}

/**
 * GET — rulebook do campeonato (admin) ou público se ?public=1 e publicado
 */
export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const url = new URL(req.url)
    const isPublic = url.searchParams.get('public') === '1'

    if (isPublic) {
      const published = await getPublishedRulebook(id)
      if (!published) {
        return NextResponse.json({ error: 'Regulamento não publicado.' }, { status: 404 })
      }
      return NextResponse.json({ ok: true, ...published })
    }

    const user = await getBearerUser(req)
    const permission = await getCampeonatoPermission(user.id, id)
    if (!permission.canView && !canManageRulebook(permission)) {
      return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 })
    }

    let result = await getRulebook(id)
    if (!result && canManageRulebook(permission)) {
      result = await getOrCreateRulebook({ campeonatoId: id, userId: user.id })
    }
    if (!result) {
      return NextResponse.json({ error: 'Rulebook não encontrado.' }, { status: 404 })
    }

    return NextResponse.json({ ok: true, ...result })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Erro ao carregar rulebook.' },
      { status: 500 },
    )
  }
}

/**
 * PUT — salva respostas / perfil / infrações e regenera documento
 */
export async function PUT(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await getBearerUser(req)
    const { id } = await context.params
    const permission = await getCampeonatoPermission(user.id, id)

    if (!canManageRulebook(permission)) {
      return NextResponse.json(
        { error: 'Sem permissão para editar o regulamento.' },
        { status: 403 },
      )
    }

    const body = (await req.json()) as RulebookSaveInput
    const result = await saveRulebook({
      campeonatoId: id,
      userId: user.id,
      payload: body || {},
    })

    return NextResponse.json({ ok: true, ...result })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Erro ao salvar rulebook.' },
      { status: 500 },
    )
  }
}

/**
 * POST — cria rulebook se não existir (com perfil opcional)
 */
export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await getBearerUser(req)
    const { id } = await context.params
    const permission = await getCampeonatoPermission(user.id, id)

    if (!canManageRulebook(permission)) {
      return NextResponse.json(
        { error: 'Sem permissão para criar o regulamento.' },
        { status: 403 },
      )
    }

    let perfil: any
    try {
      const body = await req.json()
      perfil = body?.perfil
    } catch {
      perfil = undefined
    }

    const result = await getOrCreateRulebook({
      campeonatoId: id,
      userId: user.id,
      perfil,
    })

    return NextResponse.json({ ok: true, ...result })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Erro ao criar rulebook.' },
      { status: 500 },
    )
  }
}
