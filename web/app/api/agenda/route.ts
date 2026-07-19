import { NextRequest, NextResponse } from 'next/server'
import { getBearerUser } from '@backend/auth/server-auth'
import {
  createAgendaEvent,
  deleteAgendaEvent,
  listAgenda,
  updateAgendaEvent,
  type AgendaScope,
} from '@backend/agenda/agenda.service'

function monthBounds(year: number, month: number) {
  const from = `${year}-${String(month).padStart(2, '0')}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const to = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  return { from, to }
}

async function optionalUser(req: NextRequest) {
  try {
    return await getBearerUser(req)
  } catch {
    return null
  }
}

export async function GET(req: NextRequest) {
  try {
    const scope = String(req.nextUrl.searchParams.get('scope') || 'me').trim() as AgendaScope
    const scopeId = req.nextUrl.searchParams.get('id') || req.nextUrl.searchParams.get('scope_id')
    const year = Number(req.nextUrl.searchParams.get('year') || new Date().getFullYear())
    const month = Number(req.nextUrl.searchParams.get('month') || new Date().getMonth() + 1)
    const fromParam = req.nextUrl.searchParams.get('from')
    const toParam = req.nextUrl.searchParams.get('to')

    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      throw new Error('Ano inválido.')
    }
    if (!Number.isInteger(month) || month < 1 || month > 12) {
      throw new Error('Mês inválido.')
    }

    const bounds = monthBounds(year, month)
    const from = fromParam || bounds.from
    const to = toParam || bounds.to

    let authUserId: string | null = null
    if (scope === 'me') {
      const user = await getBearerUser(req)
      authUserId = user.id
    } else {
      const user = await optionalUser(req)
      authUserId = user?.id || null
    }

    if (!['me', 'campeonato', 'equipe'].includes(scope)) {
      throw new Error('Escopo inválido. Use me, campeonato ou equipe.')
    }

    const result = await listAgenda({
      scope,
      scopeId,
      from,
      to,
      authUserId,
    })

    return NextResponse.json({
      items: result.items,
      setup_required: result.setup_required,
      range: { from, to, year, month },
      scope,
      scope_id: scopeId || null,
    })
  } catch (error: any) {
    const message = error?.message || 'Erro ao listar agenda.'
    const status = /sess[aã]o|autorizado|login/i.test(message) ? 401 : 400
    return NextResponse.json({ error: message }, { status })
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getBearerUser(req)
    const body = await req.json().catch(() => ({}))
    const created = await createAgendaEvent(user.id, body)
    return NextResponse.json({ item: created }, { status: 201 })
  } catch (error: any) {
    const message = error?.message || 'Erro ao criar evento.'
    const status = /sess[aã]o|autorizado/i.test(message) ? 401 : 400
    return NextResponse.json({ error: message }, { status })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await getBearerUser(req)
    const body = await req.json().catch(() => ({}))
    const id = String(body.id || '').trim()
    if (!id) throw new Error('ID do evento é obrigatório.')
    const updated = await updateAgendaEvent(user.id, id, body)
    return NextResponse.json({ item: updated })
  } catch (error: any) {
    const message = error?.message || 'Erro ao atualizar evento.'
    const status = /sess[aã]o|autorizado/i.test(message) ? 401 : 400
    return NextResponse.json({ error: message }, { status })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getBearerUser(req)
    const id = String(req.nextUrl.searchParams.get('id') || '').trim()
    if (!id) {
      const body = await req.json().catch(() => ({}))
      const bodyId = String(body.id || '').trim()
      if (!bodyId) throw new Error('ID do evento é obrigatório.')
      await deleteAgendaEvent(user.id, bodyId)
      return NextResponse.json({ ok: true })
    }
    await deleteAgendaEvent(user.id, id)
    return NextResponse.json({ ok: true })
  } catch (error: any) {
    const message = error?.message || 'Erro ao excluir evento.'
    const status = /sess[aã]o|autorizado/i.test(message) ? 401 : 400
    return NextResponse.json({ error: message }, { status })
  }
}
