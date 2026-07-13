import { NextRequest, NextResponse } from 'next/server'
import { getAccountsForUser, getBearerUser } from '@backend/auth/server-auth'
import { supabaseAdmin } from '@backend/shared/supabase-admin'

function missingRelation(error: any) {
  return ['42P01', '42703', 'PGRST205', 'PGRST204'].includes(error?.code || '')
}

async function resolveManager(managerId: string) {
  const { data: manager, error: managerError } = await supabaseAdmin
    .from('managers')
    .select('id,nome,username,avatar_url,bio,status')
    .eq('id', managerId)
    .maybeSingle()
  if (managerError) throw managerError
  if (manager) return manager

  const { data: fallbackManager, error: fallbackError } = await supabaseAdmin
    .from('managers')
    .select('id,nome,username,avatar_url,bio,status')
    .eq('auth_user_id', managerId)
    .maybeSingle()
  if (fallbackError) throw fallbackError
  return fallbackManager
}

export async function GET(_req: Request, context: { params: Promise<{ managerId: string }> }) {
  try {
    const { managerId } = await context.params
    const manager = await resolveManager(managerId)
    const { data: vínculos, error: vínculosError } = await supabaseAdmin
      .from('tokens')
      .select('id,campeonato_id,produtora_id,manager_id,status,created_at')
      .eq('tipo', 'manager_invite')
      .eq('manager_id', manager?.id)
      .order('created_at', { ascending: false })

    if (vínculosError) throw vínculosError
    if (!manager || ['suspenso', 'banido', 'excluido'].includes(String(manager.status || 'ativo'))) throw new Error('Vendedor não encontrado.')

    const campeonatoIds = Array.from(new Set([...(vínculos || []).map((item) => item.campeonato_id), ...[]].filter(Boolean)))
    const produtoraIds = Array.from(new Set((vínculos || []).map((item) => item.produtora_id).filter(Boolean)))

    const [
      { data: campeonatos, error: campeonatosError },
      { data: produtoras, error: produtorasError },
      { data: configs, error: configsError },
    ] = await Promise.all([
      campeonatoIds.length ? supabaseAdmin.from('campeonatos').select('id,nome,logo_url,status').in('id', campeonatoIds) : Promise.resolve({ data: [] as any[], error: null } as any),
      produtoraIds.length ? supabaseAdmin.from('produtoras').select('id,nome,logo_url').in('id', produtoraIds) : Promise.resolve({ data: [] as any[], error: null } as any),
      campeonatoIds.length ? supabaseAdmin.from('campeonato_configuracoes').select('campeonato_id,contatos_whatsapp').in('campeonato_id', campeonatoIds) : Promise.resolve({ data: [] as any[], error: null } as any),
    ])

    if (campeonatosError) throw campeonatosError
    if (produtorasError) throw produtorasError
    if (configsError && !missingRelation(configsError)) throw configsError

    const campeonatosById = new Map((campeonatos || []).map((item: any) => [item.id, item]))
    const produtorasById = new Map((produtoras || []).map((item: any) => [item.id, item]))
    const contactsByChampId = new Map((configs || []).map((config: any) => [
      config.campeonato_id,
      Array.isArray(config.contatos_whatsapp) ? config.contatos_whatsapp.find((contact: any) => contact?.manager_id === managerId) || null : null,
    ]))

    return NextResponse.json({
      manager,
      campeonatos: (vínculos || []).map((item: any) => {
        const contact = (contactsByChampId.get(item.campeonato_id) || null) as any
        return {
          id: item.id,
          campeonato_id: item.campeonato_id,
          nome_publico: contact?.nome || manager.nome || manager.username,
          whatsapp_url: contact?.url || null,
          status: item.status,
          campeonatos: campeonatosById.get(item.campeonato_id) || null,
          produtoras: produtorasById.get(item.produtora_id) || null,
        }
      }),
    })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro ao carregar vendedor.' }, { status: 404 })
  }
}

async function requireManagerAccount(req: NextRequest, managerId: string) {
  const user = await getBearerUser(req)
  const accounts = await getAccountsForUser(user)
  const account = accounts.find((item) => item.profile_type === 'manager' && item.id === managerId)
  if (!account) throw new Error('Acesso negado.')
  return account
}

export async function PATCH(req: NextRequest, context: { params: Promise<{ managerId: string }> }) {
  try {
    const { managerId } = await context.params
    await requireManagerAccount(req, managerId)
    const body = await req.json().catch(() => ({}))
    const campeonatoId = String(body.campeonatoId || '').trim()
    const publish = Boolean(body.publish)

    if (!campeonatoId) throw new Error('Informe o campeonato a ser atualizado.')

    const { data: tokenRow, error: tokenError } = await supabaseAdmin
      .from('tokens')
      .select('id')
      .eq('tipo', 'manager_invite')
      .eq('manager_id', managerId)
      .eq('campeonato_id', campeonatoId)
      .maybeSingle()
    if (tokenError) throw tokenError
    if (!tokenRow) throw new Error('Convite de venda não encontrado para este manager.')

    const newStatus = publish ? 'ativo' : 'cancelado'
    const updates = [
      supabaseAdmin.from('tokens').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', tokenRow.id),
      supabaseAdmin.from('campeonato_vendedores').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('manager_id', managerId).eq('campeonato_id', campeonatoId),
    ]
    const [{ error: tokenUpdateError }, { error: sellerUpdateError }] = await Promise.all(updates)
    if (tokenUpdateError) throw tokenUpdateError
    if (sellerUpdateError && !missingRelation(sellerUpdateError)) throw sellerUpdateError

    return NextResponse.json({ success: true, published: publish, campeonatoId })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro ao atualizar publicação.' }, { status: 400 })
  }
}
