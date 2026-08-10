import { randomBytes } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getBearerUser } from '@backend/auth/server-auth'
import { requireCampeonatoManage } from '@backend/campeonatos/campeonato-permissions'
import { supabaseAdmin } from '@backend/shared/supabase-admin'

function novoToken() {
  return randomBytes(18).toString('base64url').toUpperCase()
}

function missingRelation(error: any) {
  return ['42P01', '42703', 'PGRST205', 'PGRST204'].includes(error?.code || '')
}

function sellerLimit(value: unknown) {
  const limit = Number(value || 0)
  return Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 0
}

function sellerCommissionBps(value: unknown) {
  if (value === undefined || value === null || value === '') return null
  const percent = Number(value)
  if (!Number.isFinite(percent) || percent < 0) throw new Error('Comissão inválida.')
  if (percent > 20) throw new Error('A comissão do vendedor pode ser no máximo 20%.')
  return Math.round(percent * 100)
}

function normalizePerms(raw: unknown) {
  const value = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  return {
    vendedor_vagas: value.vendedor_vagas !== false,
    adicionar_equipes: value.adicionar_equipes === true,
    remover_proprias_equipes: value.remover_proprias_equipes === true,
    gerar_convites_equipe: value.gerar_convites_equipe !== false,
    ver_estrutura: value.ver_estrutura !== false,
    organizar_grupos: value.organizar_grupos === true,
    pontuar_tabela: value.pontuar_tabela === true,
  }
}

async function requireOwner(req: NextRequest, campeonatoId: string) {
  const user = await getBearerUser(req)
  const permission = await requireCampeonatoManage(user.id, campeonatoId)
  if (permission.role !== 'owner') {
    throw new Error('Somente o dono da produtora pode gerenciar vendedores.')
  }
  return { user, permission }
}

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const user = await getBearerUser(req)
    await requireCampeonatoManage(user.id, id)

    const { data, error } = await supabaseAdmin
      .from('tokens')
      .select('*')
      .eq('tipo', 'manager_invite')
      .eq('campeonato_id', id)
      .neq('status', 'cancelado')
      .order('created_at', { ascending: false })

    if (error) throw error

    const rows = data || []
    const managerIds = Array.from(new Set(rows.map((row) => row.manager_id).filter(Boolean)))
    let managersById = new Map<string, any>()
    if (managerIds.length) {
      const { data: managers, error: managersError } = await supabaseAdmin
        .from('managers')
        .select('id,nome,username,avatar_url')
        .in('id', managerIds)
      if (managersError) throw managersError
      managersById = new Map((managers || []).map((manager) => [manager.id, manager]))
    }

    let contactsByManagerId = new Map<string, any>()
    let sellersByManagerId = new Map<string, any>()
    const { data: config, error: configError } = await supabaseAdmin
      .from('campeonato_configuracoes')
      .select('contatos_whatsapp')
      .eq('campeonato_id', id)
      .maybeSingle()
    if (configError && !missingRelation(configError)) throw configError
    if (Array.isArray(config?.contatos_whatsapp)) {
      contactsByManagerId = new Map(config.contatos_whatsapp.filter((contact: any) => contact?.manager_id).map((contact: any) => [contact.manager_id, contact]))
    }
    if (managerIds.length) {
      const { data: sellerLinks, error: sellerLinksError } = await supabaseAdmin
        .from('campeonato_vendedores')
        .select('manager_id,limite_vagas,permissoes,status,comissao_bps')
        .eq('campeonato_id', id)
        .in('manager_id', managerIds)
      if (sellerLinksError && !missingRelation(sellerLinksError)) throw sellerLinksError
      sellersByManagerId = new Map((sellerLinks || []).map((seller: any) => [seller.manager_id, seller]))
    }

    return NextResponse.json({
      vendedores: rows.map((row) => {
        const manager = row.manager_id ? managersById.get(row.manager_id) || null : null
        const contact = row.manager_id ? contactsByManagerId.get(row.manager_id) || null : null
        const sellerLink = row.manager_id ? sellersByManagerId.get(row.manager_id) || null : null
        return {
          ...row,
          limite_vagas: sellerLink?.limite_vagas || row.manager_limite_vagas || 0,
          comissao_bps: sellerLink?.comissao_bps ?? row.manager_comissao_bps ?? null,
          permissoes: sellerLink?.permissoes || row.manager_permissoes || {},
          status: row.manager_id ? 'ativo' : 'pendente',
          nome_publico: contact?.nome || manager?.nome || manager?.username || null,
          whatsapp_url: contact?.url || null,
          managers: manager,
        }
      }),
    })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro ao listar vendedores.' }, { status: 400 })
  }
}

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const user = await getBearerUser(req)
    const permission = await requireCampeonatoManage(user.id, id)
    if (permission.role !== 'owner') throw new Error('Somente o dono da produtora pode convidar vendedores.')

    const body = await req.json().catch(() => ({}))
    const limiteVagas = sellerLimit(body.limite_vagas)
    const comissaoBps = sellerCommissionBps(body.comissao_percentual ?? body.comissao_bps_percentual ?? body.comissao)
    const token = novoToken()
    const { data: convite, error } = await supabaseAdmin
      .from('tokens')
      .insert({
        token,
        tipo: 'manager_invite',
        campeonato_id: id,
        produtora_id: permission.produtoraId,
        status: 'ativo',
        usado: false,
        criado_por: user.id,
        manager_limite_vagas: limiteVagas,
        manager_comissao_bps: comissaoBps,
        manager_permissoes: {
          vendedor_vagas: true,
          adicionar_equipes: false,
          remover_proprias_equipes: false,
          gerar_convites_equipe: true,
          ver_estrutura: true,
          organizar_grupos: false,
          pontuar_tabela: false,
        },
      })
      .select('*')
      .single()

    if (error) throw error

    const { data: campeonato } = await supabaseAdmin.from('campeonatos').select('nome').eq('id', id).maybeSingle()
    const nomeSugerido = String(body.nome_publico || '').trim()
    const link = `${req.nextUrl.origin}/vendedor/${token}`
    const textoWhatsapp = [
      `Voce recebeu um convite para vender vagas${campeonato?.nome ? ` do campeonato ${campeonato.nome}` : ''}.`,
      nomeSugerido ? `Nome publico sugerido: ${nomeSugerido}.` : '',
      limiteVagas ? `Limite de vendas: ${limiteVagas} vaga(s).` : '',
      'Acesse o link, entre ou crie seu perfil de manager e cadastre seu WhatsApp de venda.',
      link,
    ].filter(Boolean).join('\n\n')

    return NextResponse.json({ convite, link, texto_whatsapp: textoWhatsapp, whatsapp_url: `https://wa.me/?text=${encodeURIComponent(textoWhatsapp)}` }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro ao criar convite de vendedor.' }, { status: 400 })
  }
}


/** Atualiza limite, permissões e status de um vendedor já vinculado ao campeonato. */
export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    await requireOwner(req, id)
    const body = await req.json().catch(() => ({}))
    const managerId = String(body.manager_id || '').trim()
    const vinculoId = String(body.vinculo_id || '').trim()

    if (!managerId && !vinculoId) {
      throw new Error('Informe manager_id ou vinculo_id.')
    }

    const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if ('limite_vagas' in body) update.limite_vagas = sellerLimit(body.limite_vagas)
    if ('comissao_percentual' in body || 'comissao_bps_percentual' in body || 'comissao' in body) {
      update.comissao_bps = sellerCommissionBps(body.comissao_percentual ?? body.comissao_bps_percentual ?? body.comissao)
    }
    if ('permissoes' in body) update.permissoes = normalizePerms(body.permissoes)
    if ('status' in body) {
      const status = String(body.status || '').trim().toLowerCase()
      if (!['ativo', 'inativo', 'cancelado'].includes(status)) {
        throw new Error('Status inválido.')
      }
      update.status = status
    }

    let query = supabaseAdmin
      .from('campeonato_vendedores')
      .update(update)
      .eq('campeonato_id', id)
    query = vinculoId ? query.eq('id', vinculoId) : query.eq('manager_id', managerId)

    const { data, error } = await query.select('*').maybeSingle()
    if (error) throw error
    if (!data) throw new Error('Vendedor não encontrado neste campeonato.')

    return NextResponse.json({ ok: true, vendedor: data })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao atualizar vendedor.' },
      { status: 400 },
    )
  }
}

/** Cancela convite pendente ou remove o vínculo ativo do vendedor deste campeonato. */
export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    await requireOwner(req, id)
    const body = await req.json().catch(() => ({}))
    const managerId = String(body.manager_id || '').trim()
    const vinculoId = String(body.vinculo_id || '').trim()
    const tokenId = String(body.token_id || '').trim()

    if (!managerId && !vinculoId && !tokenId) {
      throw new Error('Informe manager_id, vinculo_id ou token_id.')
    }

    if (tokenId) {
      const { data, error } = await supabaseAdmin
        .from('tokens')
        .update({ status: 'cancelado', usado: true })
        .eq('id', tokenId)
        .eq('campeonato_id', id)
        .eq('tipo', 'manager_invite')
        .select('id')
        .maybeSingle()
      if (error) throw error
      if (!data) throw new Error('Convite pendente não encontrado.')
      return NextResponse.json({ ok: true, tipo: 'convite', id: data.id })
    }

    let query = supabaseAdmin
      .from('campeonato_vendedores')
      .update({ status: 'cancelado', updated_at: new Date().toISOString() })
      .eq('campeonato_id', id)
    query = vinculoId ? query.eq('id', vinculoId) : query.eq('manager_id', managerId)

    const { data, error } = await query.select('id,manager_id').maybeSingle()
    if (error) throw error
    if (!data) throw new Error('Vendedor não encontrado neste campeonato.')

    await supabaseAdmin
      .from('tokens')
      .update({ status: 'cancelado', usado: true })
      .eq('campeonato_id', id)
      .eq('manager_id', data.manager_id)
      .eq('tipo', 'manager_invite')
      .eq('usado', false)

    return NextResponse.json({ ok: true, tipo: 'vinculo', id: data.id })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao remover vendedor.' },
      { status: 400 },
    )
  }
}
