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
    .select('id, vaga_id')
    .eq('campeonato_id', campeonatoId)
    .eq('tipo', 'convite_equipe_campeonato')
    .eq('status', 'ativo')
    .eq('usado', false)
    .lte('expira_em', agora)

  if (!expirados?.length) return
  const ids = expirados.map((item) => item.id)
  const vagas = expirados.map((item) => item.vaga_id).filter(Boolean)
  await supabaseAdmin.from('tokens').update({ status: 'expirado' }).in('id', ids)
  if (vagas.length) {
    await supabaseAdmin.from('campeonato_vagas').update({
      status: 'livre', reservada_por_token_id: null, reservada_em: null,
      reserva_expira_em: null, nome_equipe_reservada: null, nome_line_reservada: null,
    }).in('id', vagas).eq('status', 'reservada')
  }
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
      // if user is a seller for this championship and was invited by the produtora
      // allow management actions (so UI can show add-team controls)
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
      // A listagem de participantes é pública; ações continuam protegidas.
    }

    await liberarExpirados(id)
    const [{ data: campeonato, error: campError }, { data: vagas, error: vagasError }] = await Promise.all([
      supabaseAdmin.from('campeonatos').select('id, nome, logo_url').eq('id', id).is('deleted_at', null).single(),
      supabaseAdmin.from('campeonato_vagas').select('*').eq('campeonato_id', id).order('numero_vaga'),
    ])
    if (campError) throw campError
    if (vagasError) throw vagasError

    const participacaoIds = (vagas || []).map((v) => v.campeonato_equipe_id).filter(Boolean)
    const tokenIds = (vagas || []).map((v) => v.reservada_por_token_id).filter(Boolean)

    const [{ data: participacoes }, { data: convites }] = await Promise.all([
      participacaoIds.length ? supabaseAdmin.from('campeonato_equipes').select('*').in('id', participacaoIds) : Promise.resolve({ data: [] as any[] }),
      tokenIds.length ? supabaseAdmin.from('tokens').select('id, token, expira_em, status, usado, nome_equipe_reservada, nome_line_reservada, vaga_id').in('id', tokenIds) : Promise.resolve({ data: [] as any[] }),
    ])

    const equipeIds = (participacoes || []).map((p) => p.equipe_id).filter(Boolean)
    const lineIds = (participacoes || []).map((p) => p.line_id).filter(Boolean)
    const [{ data: equipes }, { data: lines }] = await Promise.all([
      equipeIds.length ? supabaseAdmin.from('equipes').select('id, nome, tag, logo_url').in('id', equipeIds) : Promise.resolve({ data: [] as any[] }),
      lineIds.length ? supabaseAdmin.from('equipe_lines').select('id, nome, tag, logo_url').in('id', lineIds) : Promise.resolve({ data: [] as any[] }),
    ])

    const equipesMap = new Map((equipes || []).map((e) => [e.id, e]))
    const linesMap = new Map((lines || []).map((l) => [l.id, l]))
    const partMap = new Map((participacoes || []).map((p) => [p.id, { ...p, equipe: equipesMap.get(p.equipe_id) || null, line: p.line_id ? linesMap.get(p.line_id) || null : null }]))
    const tokenMap = new Map((convites || []).map((t) => [t.id, t]))

    return NextResponse.json({
      campeonato,
      permission: { canView: permission.canView, canManage: permission.canManage, canGenerateToken: permission.canGenerateToken, role: permission.role },
      vagas: (vagas || []).map((vaga) => ({
        ...vaga,
        campeonato_equipe: vaga.campeonato_equipe_id ? partMap.get(vaga.campeonato_equipe_id) || null : null,
        convite: vaga.reservada_por_token_id ? tokenMap.get(vaga.reservada_por_token_id) || null : null,
      })),
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
    const vagaId = String(body.vaga_id || '')
    const equipeId = String(body.equipe_id || '')
    let lineId = body.line_id ? String(body.line_id) : null
    const nomeLine = String(body.nome_line || '').trim()
    if (!vagaId || !equipeId) throw new Error('Selecione a vaga e a equipe.')

    const { data: vaga } = await supabaseAdmin.from('campeonato_vagas').select('*').eq('id', vagaId).eq('campeonato_id', id).single()
    if (!vaga || vaga.status !== 'livre') throw new Error('Esta vaga não está mais livre.')

    const { data: equipe } = await supabaseAdmin.from('equipes').select('id, nome, tag, logo_url').eq('id', equipeId).single()
    if (!equipe) throw new Error('Equipe não encontrada.')

    if (!lineId) {
      if (!nomeLine) throw new Error('Informe o nome da line.')
      const { data: criada, error: lineError } = await supabaseAdmin.from('equipe_lines').insert({ equipe_id: equipeId, nome: nomeLine, tag: equipe.tag, logo_url: equipe.logo_url }).select('*').single()
      if (lineError) throw lineError
      lineId = criada.id
    } else {
      const { data: line } = await supabaseAdmin.from('equipe_lines').select('id, equipe_id, nome').eq('id', lineId).eq('equipe_id', equipeId).single()
      if (!line) throw new Error('A line selecionada não pertence à equipe.')
    }

    const { data: lineFinal } = await supabaseAdmin.from('equipe_lines').select('id, nome').eq('id', lineId).single()
    const { data: participacaoExistente } = await supabaseAdmin
      .from('campeonato_equipes')
      .select('id, vaga_id')
      .eq('campeonato_id', id)
      .eq('line_id', lineId)
      .eq('status', 'ativo')
      .maybeSingle()
    if (participacaoExistente) throw new Error('Esta line já está inscrita neste campeonato.')

    const origem = permission.role === 'seller' ? 'vendedor' : 'organizador'
    const { data: participacao, error: partError } = await supabaseAdmin.from('campeonato_equipes').insert({
      campeonato_id: id, equipe_id: equipeId, vaga_id: vagaId, line_id: lineId,
      nome_exibicao: lineFinal?.nome || equipe.nome, origem_entrada: origem, criado_por: user.id, status: 'ativo',
    }).select('*').single()
    if (partError) throw partError

    const { error: vagaError } = await supabaseAdmin.from('campeonato_vagas').update({ status: 'ocupada', campeonato_equipe_id: participacao.id, ocupada_em: new Date().toISOString() }).eq('id', vagaId).eq('status', 'livre')
    if (vagaError) {
      await supabaseAdmin.from('campeonato_equipes').delete().eq('id', participacao.id)
      throw vagaError
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
    const { data: participacao } = await supabaseAdmin.from('campeonato_equipes').select('id, vaga_id, criado_por, origem_entrada').eq('id', participacaoId).eq('campeonato_id', id).single()
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
    await supabaseAdmin.from('campeonato_equipes').update({ status: 'removido', vaga_id: null }).eq('id', participacaoId)
    if (participacao.vaga_id) {
      await supabaseAdmin.from('campeonato_vagas').update({ status: 'livre', campeonato_equipe_id: null, ocupada_em: null }).eq('id', participacao.vaga_id)
    }
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro ao remover equipe.' }, { status: 400 })
  }
}
