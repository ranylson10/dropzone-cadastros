import { NextRequest, NextResponse } from 'next/server'
import { getBearerUser, getAccountsForUser } from '@backend/auth/server-auth'
import { getCampeonatoPermission, type CampeonatoPermission } from '@backend/campeonatos/campeonato-permissions'
import { supabaseAdmin } from '@backend/shared/supabase-admin'

function hasSellerPermission(seller: any, key: string) {
  return seller?.permissoes?.[key] !== false
}

async function liberarExpirados(campeonatoId: string) {
  const agora = new Date().toISOString()
  const { data: expirados } = await supabaseAdmin
    .from('tokens')
    .select('id')
    .eq('campeonato_id', campeonatoId)
    .eq('tipo', 'convite_equipe_campeonato')
    .eq('status', 'ativo')
    .eq('usado', false)
    .lte('expira_em', agora)

  if (!expirados?.length) return
  const ids = expirados.map((item) => item.id)
  await supabaseAdmin.from('tokens').update({ status: 'expirado' }).in('id', ids)
}

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    let permission: CampeonatoPermission = { canView: true, canManage: false, canGenerateToken: false, role: 'none', produtoraId: null }
    let bearerUser: any = null
    try {
      const user = await getBearerUser(req)
      bearerUser = user
      permission = await getCampeonatoPermission(user.id, id) as typeof permission
      if (permission.role === 'seller') {
        const { data: sellerRow, error: sellerErr } = await supabaseAdmin
          .from('campeonato_vendedores')
          .select('id')
          .eq('campeonato_id', id)
          .eq('manager_auth_user_id', user.id)
          .eq('status', 'ativo')
          .maybeSingle()
        if (sellerErr) throw sellerErr
        if (sellerRow) permission.canManage = true
      }
    } catch {
    }

    await liberarExpirados(id)
    const [{ data: campeonato, error: campError }, { data: slots, error: slotsError }] = await Promise.all([
      supabaseAdmin.from('campeonatos').select('id, nome, logo_url').eq('id', id).is('deleted_at', null).single(),
      supabaseAdmin
        .from('campeonato_slots')
        .select('id,campeonato_id,fase_id,grupo_id,slot_numero,slot_letra,equipe_id,line_id,status,equipes:equipe_id(id,nome,tag,logo_url),equipe_lines:line_id(id,nome,tag,logo_url),grupos:grupo_id(id,nome)')
        .eq('campeonato_id', id)
        .order('slot_numero'),
    ])
    if (campError) throw campError
    if (slotsError) throw slotsError

    const { data: participacoes } = await supabaseAdmin.from('campeonato_equipes').select('*').eq('campeonato_id', id).eq('status', 'ativo')

    const equipeIds = [
      ...(slots || []).map((s) => s.equipe_id).filter(Boolean),
      ...(participacoes || []).map((p) => p.equipe_id).filter(Boolean),
    ]
    const lineIds = [
      ...(slots || []).map((s) => s.line_id).filter(Boolean),
      ...(participacoes || []).map((p) => p.line_id).filter(Boolean),
    ]

    const [{ data: equipes }, { data: lines }] = await Promise.all([
      equipeIds.length ? supabaseAdmin.from('equipes').select('id, nome, tag, logo_url').in('id', Array.from(new Set(equipeIds))) : Promise.resolve({ data: [] as any[] }),
      lineIds.length ? supabaseAdmin.from('equipe_lines').select('id, nome, tag, logo_url').in('id', Array.from(new Set(lineIds))) : Promise.resolve({ data: [] as any[] }),
    ])

    const equipesMap = new Map((equipes || []).map((e) => [e.id, e]))
    const linesMap = new Map((lines || []).map((l) => [l.id, l]))
    const partMap = new Map((participacoes || []).map((p) => [p.id, { ...p, equipe: equipesMap.get(p.equipe_id) || null, line: p.line_id ? linesMap.get(p.line_id) || null : null }]))

    const slotsWithParticipations = (slots || []).map((slot: any) => {
      const participation = (participacoes || []).find((p: any) =>
        p.grupo_id === slot.grupo_id &&
        Number(p.slot_numero) === Number(slot.slot_numero) &&
        (!slot.line_id || p.line_id === slot.line_id)
      )
      return {
        ...slot,
        equipe_id: slot.equipe_id || participation?.equipe_id || null,
        line_id: slot.line_id || participation?.line_id || null,
        status: participation ? 'ocupada' : slot.status,
        campeonato_equipe: participation ? partMap.get(participation.id) || null : null,
        grupo: slot.grupos,
      }
    })

    return NextResponse.json({
      campeonato,
      permission: { canView: permission.canView, canManage: permission.canManage, canGenerateToken: permission.canGenerateToken, role: permission.role },
      vagas: slotsWithParticipations,
    })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro ao carregar equipes.' }, { status: 400 })
  }
}

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const user = await getBearerUser(req)
    const permission = await getCampeonatoPermission(user.id, id)
    let allowedToManage = Boolean(permission.canManage)
    let sellerPermission: any = null
    if (!allowedToManage && permission.role === 'seller') {
      const accounts = await getAccountsForUser(user)
      const account = accounts.find((item) => item.profile_type === 'manager')
      if (account) {
        const { data: seller, error: sellerErr } = await supabaseAdmin
          .from('campeonato_vendedores')
          .select('id,limite_vagas,permissoes')
          .eq('campeonato_id', id)
          .eq('manager_auth_user_id', user.id)
          .eq('status', 'ativo')
          .maybeSingle()
        if (sellerErr) throw sellerErr
        if (seller) {
          sellerPermission = seller
          allowedToManage = true
        }
      }
    }
    if (!allowedToManage) throw new Error('Você não tem permissão para gerenciar este campeonato.')
    if (permission.role === 'seller') {
      if (!sellerPermission) throw new Error('Permissão de vendedor não encontrada para este campeonato.')
      if (!hasSellerPermission(sellerPermission, 'adicionar_equipes')) throw new Error('Este vendedor não pode adicionar equipes.')
      const limiteVagas = Number(sellerPermission.limite_vagas || 0)
      if (limiteVagas > 0) {
        const { count, error: countError } = await supabaseAdmin
          .from('campeonato_equipes')
          .select('id', { count: 'exact', head: true })
          .eq('campeonato_id', id)
          .eq('criado_por', user.id)
          .eq('origem_entrada', 'vendedor')
          .eq('status', 'ativo')
        if (countError) throw countError
        if (Number(count || 0) >= limiteVagas) throw new Error(`Este vendedor atingiu o limite de ${limiteVagas} vaga(s).`)
      }
    }
    const body = await req.json()
    const slotId = String(body.slot_id || '')
    const equipeId = String(body.equipe_id || '')
    let lineId = body.line_id ? String(body.line_id) : null
    const nomeLine = String(body.nome_line || '').trim()
    if (!slotId || !equipeId) throw new Error('Selecione o slot e a equipe.')

    const { data: slot } = await supabaseAdmin.from('campeonato_slots').select('*').eq('id', slotId).eq('campeonato_id', id).single()
    if (!slot) throw new Error('Slot não encontrado.')
    if (slot.equipe_id) throw new Error('Este slot já está ocupado.')

    const { data: equipe } = await supabaseAdmin.from('equipes').select('id, nome, tag, logo_url').eq('id', equipeId).single()
    if (!equipe) throw new Error('Equipe não encontrada.')

    if (!lineId) {
      if (!nomeLine) throw new Error('Informe o nome da line.')
      const { data: criada, error: lineError } = await supabaseAdmin.from('equipe_lines').insert({ equipe_id: equipeId, nome: nomeLine, tag: equipe.tag, logo_url: equipe.logo_url, status: 'ativo' }).select('*').single()
      if (lineError) throw lineError
      lineId = criada.id
    } else {
      const { data: line } = await supabaseAdmin.from('equipe_lines').select('id, equipe_id, nome').eq('id', lineId).eq('equipe_id', equipeId).single()
      if (!line) throw new Error('A line selecionada não pertence à equipe.')
    }

    const { data: lineFinal } = await supabaseAdmin.from('equipe_lines').select('id, nome').eq('id', lineId).single()
    const { data: participacaoExistente } = await supabaseAdmin
      .from('campeonato_equipes')
      .select('id')
      .eq('campeonato_id', id)
      .eq('line_id', lineId)
      .eq('status', 'ativo')
      .maybeSingle()
    if (participacaoExistente) throw new Error('Esta line já está inscrita neste campeonato.')

    const origem = permission.role === 'seller' ? 'vendedor' : 'organizador'
    const { data: participacao, error: partError } = await supabaseAdmin.from('campeonato_equipes').insert({
      campeonato_id: id, equipe_id: equipeId, grupo_id: slot.grupo_id, slot_numero: slot.slot_numero, line_id: lineId,
      nome_exibicao: lineFinal?.nome || equipe.nome, origem_entrada: origem, criado_por: user.id, status: 'ativo',
    }).select('*').single()
    if (partError) throw partError

    const { error: slotError } = await supabaseAdmin.from('campeonato_slots').update({ equipe_id: equipeId, line_id: lineId, status: 'ocupado', updated_at: new Date().toISOString() }).eq('id', slotId).is('equipe_id', null)
    if (slotError) {
      await supabaseAdmin.from('campeonato_equipes').delete().eq('id', participacao.id)
      throw new Error('O slot foi preenchido por outra equipe. Atualize e tente novamente.')
    }
    return NextResponse.json({ ok: true, participacao }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro ao adicionar equipe.' }, { status: 400 })
  }
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const user = await getBearerUser(req)
    const permission = await getCampeonatoPermission(user.id, id)
    const participacaoId = req.nextUrl.searchParams.get('participacao_id') || ''
    const { data: participacao } = await supabaseAdmin.from('campeonato_equipes').select('id, grupo_id, slot_numero, line_id, criado_por, origem_entrada').eq('id', participacaoId).eq('campeonato_id', id).single()
    if (!participacao) throw new Error('Participação não encontrada.')
    if (!permission.canManage) {
      if (permission.role !== 'seller') throw new Error('Você não tem permissão para gerenciar este campeonato.')
      const { data: seller, error: sellerError } = await supabaseAdmin
        .from('campeonato_vendedores')
        .select('id,permissoes')
        .eq('campeonato_id', id)
        .eq('manager_auth_user_id', user.id)
        .eq('status', 'ativo')
        .maybeSingle()
      if (sellerError) throw sellerError
      if (!seller || !hasSellerPermission(seller, 'remover_proprias_equipes')) throw new Error('Este vendedor não pode remover equipes.')
      if (participacao.criado_por !== user.id || participacao.origem_entrada !== 'vendedor') throw new Error('O vendedor só pode remover equipes que ele adicionou.')
    }
    await supabaseAdmin.from('campeonato_equipes').update({ status: 'removido' }).eq('id', participacaoId)
    if (participacao.grupo_id && participacao.slot_numero && participacao.line_id) {
      await supabaseAdmin.from('campeonato_slots').update({ equipe_id: null, line_id: null, status: 'livre', updated_at: new Date().toISOString() }).eq('campeonato_id', id).eq('grupo_id', participacao.grupo_id).eq('slot_numero', participacao.slot_numero).eq('line_id', participacao.line_id)
    }
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro ao remover equipe.' }, { status: 400 })
  }
}
