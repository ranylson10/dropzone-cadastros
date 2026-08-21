import { NextRequest, NextResponse } from 'next/server'
import { getBearerUser } from '@backend/auth/server-auth'
import {
  createAgendaEvent,
  deleteAgendaEvent,
  listAgenda,
  type AgendaScope,
  updateAgendaEvent,
} from '@backend/agenda/agenda.service'
import { getCampeonatoPermission } from '@backend/campeonatos/campeonato-permissions'
import { supabaseAdmin } from '@backend/shared/supabase-admin'

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
    const all = req.nextUrl.searchParams.get('list') === 'all'

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
      all,
    })

    return NextResponse.json({
      items: result.items,
      unscheduled: result.unscheduled,
      setup_required: result.setup_required,
      can_manage: result.can_manage,
      managed_championships: result.managed_championships,
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
    const item = await createAgendaEvent(user.id, await req.json().catch(() => ({})))
    return NextResponse.json({ ok: true, item })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro ao criar compromisso.' }, { status: 400 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await getBearerUser(req)
    const body = await req.json().catch(() => ({}))
    if (!body.jogo_id) {
      const item = await updateAgendaEvent(user.id, String(body.id || ''), body)
      return NextResponse.json({ ok: true, item })
    }
    const jogoId = String(body.jogo_id || '').trim()
    const dataJogo = String(body.data_jogo || '').trim()
    const horario = String(body.horario || '').trim()
    if (!jogoId || !/^\d{4}-\d{2}-\d{2}$/.test(dataJogo) || !/^\d{2}:\d{2}$/.test(horario)) {
      throw new Error('Informe jogo, data e horário válidos.')
    }
    const { data: jogo, error: findError } = await supabaseAdmin
      .from('campeonato_jogos').select('id,campeonato_id').eq('id', jogoId).maybeSingle()
    if (findError) throw findError
    if (!jogo) throw new Error('Jogo não encontrado.')
    const permission = await getCampeonatoPermission(user.id, jogo.campeonato_id)
    if (!permission.canManageGames && permission.role !== 'owner') throw new Error('Você não pode reorganizar os jogos deste campeonato.')
    const { data, error } = await supabaseAdmin
      .from('campeonato_jogos')
      .update({ data_jogo: dataJogo, horario, updated_at: new Date().toISOString() })
      .eq('id', jogoId).select('id,data_jogo,horario').single()
    if (error) throw error
    return NextResponse.json({ ok: true, jogo: data })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro ao atualizar jogo.' }, { status: 400 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getBearerUser(req)
    const id = String(req.nextUrl.searchParams.get('id') || '').trim()
    await deleteAgendaEvent(user.id, id)
    return NextResponse.json({ ok: true })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro ao excluir compromisso.' }, { status: 400 })
  }
}
