import { NextRequest, NextResponse } from 'next/server'
import { getAccountsForUser, getBearerUser } from '@backend/auth/server-auth'
import { supabaseAdmin } from '@backend/shared/supabase-admin'

function missingRelation(error: any) {
  return ['42P01', '42703', 'PGRST205', 'PGRST204'].includes(error?.code || '')
}

function normalizeWhatsapp(value: unknown) {
  const raw = String(value || '').trim()
  if (!raw) return null
  if (/^https:\/\/(wa\.me|api\.whatsapp\.com)\//i.test(raw)) return raw
  const digits = raw.replace(/\D/g, '')
  if (digits.length < 10) throw new Error('Informe um WhatsApp válido.')
  return `https://wa.me/${digits}`
}

const INVITE_TYPES = ['manager_invite', 'manager_invite_produtora']

async function carregar(token: string) {
  const { data: convite, error } = await supabaseAdmin
    .from('tokens')
    .select('*')
    .eq('token', token)
    .in('tipo', INVITE_TYPES)
    .maybeSingle()
  if (error) throw error
  if (!convite) throw new Error('Convite não encontrado.')

  const [{ data: campeonato, error: campeonatoError }, { data: produtora, error: produtoraError }] = await Promise.all([
    convite.campeonato_id
      ? supabaseAdmin.from('campeonatos').select('id,nome,logo_url,status,produtora_id').eq('id', convite.campeonato_id).maybeSingle()
      : Promise.resolve({ data: null, error: null } as any),
    convite.produtora_id
      ? supabaseAdmin.from('produtoras').select('id,nome,logo_url').eq('id', convite.produtora_id).maybeSingle()
      : Promise.resolve({ data: null, error: null } as any),
  ])
  if (campeonatoError) throw campeonatoError
  if (produtoraError) throw produtoraError

  return {
    ...convite,
    campeonatos: campeonato,
    produtoras: produtora,
    modo: convite.campeonato_id ? 'campeonato' : 'produtora',
  }
}

async function upsertSellerContact(campeonatoId: string | null, account: any, body: any, whatsappUrl: string) {
  if (!campeonatoId) return
  const { data: config, error } = await supabaseAdmin
    .from('campeonato_configuracoes')
    .select('id,contatos_whatsapp')
    .eq('campeonato_id', campeonatoId)
    .maybeSingle()
  if (error && !missingRelation(error)) throw error
  if (error || !config) return

  const current = Array.isArray(config.contatos_whatsapp) ? config.contatos_whatsapp : []
  const contact = {
    id: `manager-${account.id}`,
    manager_id: account.id,
    nome: String(body.nome_publico || '').trim() || account.name,
    pais: String(body.pais || 'Brasil'),
    bandeira: String(body.bandeira || '🇧🇷'),
    ddi: String(body.ddi || '+55'),
    telefone: String(body.telefone || '').replace(/[^0-9 ()-]/g, ''),
    url: whatsappUrl,
    origem: 'manager_invite',
  }
  const next = [...current.filter((item: any) => item?.manager_id !== account.id && item?.id !== contact.id), contact]
  const { error: updateError } = await supabaseAdmin
    .from('campeonato_configuracoes')
    .update({ contatos_whatsapp: next })
    .eq('id', config.id)
  if (updateError && !missingRelation(updateError)) throw updateError
}

async function upsertProdutoraRoster(convite: any, account: any, body: any, whatsappUrl: string | null, userId: string) {
  if (!convite.produtora_id) return
  const payload = {
    produtora_id: convite.produtora_id,
    manager_id: account.id,
    manager_auth_user_id: userId,
    nome_publico: String(body.nome_publico || '').trim() || account.name,
    whatsapp_url: whatsappUrl || null,
    status: 'ativo',
    token_aceite: convite.token,
    criado_por: convite.criado_por || null,
    aceito_em: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
  const { error } = await supabaseAdmin
    .from('produtora_vendedores')
    .upsert(payload, { onConflict: 'produtora_id,manager_id' })
  if (error && !missingRelation(error)) {
    // fallback insert se unique diferente
    const existing = await supabaseAdmin
      .from('produtora_vendedores')
      .select('id')
      .eq('produtora_id', convite.produtora_id)
      .eq('manager_id', account.id)
      .maybeSingle()
    if (existing.data?.id) {
      await supabaseAdmin.from('produtora_vendedores').update(payload).eq('id', existing.data.id)
    } else {
      const ins = await supabaseAdmin.from('produtora_vendedores').insert(payload)
      if (ins.error && !missingRelation(ins.error)) throw ins.error
    }
  }
}

async function upsertSellerLink(convite: any, account: any, body: any, whatsappUrl: string | null, userId: string) {
  if (!convite.campeonato_id) return
  const payload = {
    token: convite.token,
    campeonato_id: convite.campeonato_id,
    produtora_id: convite.produtora_id,
    manager_id: account.id,
    manager_auth_user_id: userId,
    nome_publico: String(body.nome_publico || '').trim() || account.name,
    whatsapp_url: whatsappUrl || null,
    status: 'ativo',
    limite_vagas: Number(convite.manager_limite_vagas || 0),
    permissoes: convite.manager_permissoes || {
      vendedor_vagas: true,
      adicionar_equipes: true,
      remover_proprias_equipes: true,
      gerar_convites_equipe: true,
    },
    criado_por: convite.criado_por || null,
    aceito_em: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
  const { error } = await supabaseAdmin.from('campeonato_vendedores').upsert(payload, { onConflict: 'token' })
  if (error && !missingRelation(error)) {
    const existing = await supabaseAdmin
      .from('campeonato_vendedores')
      .select('id')
      .eq('campeonato_id', convite.campeonato_id)
      .eq('manager_id', account.id)
      .maybeSingle()
    if (existing.data?.id) {
      const up = await supabaseAdmin.from('campeonato_vendedores').update(payload).eq('id', existing.data.id)
      if (up.error) throw up.error
    } else {
      const ins = await supabaseAdmin.from('campeonato_vendedores').insert(payload)
      if (ins.error) throw ins.error
    }
  }
}

async function updateManagerProfile(accountId: string, body: any, whatsappUrl: string | null) {
  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }
  // WhatsApp é opcional no aceite — preenchido depois no painel do manager
  if (whatsappUrl) patch.whatsapp_url = whatsappUrl
  const nome = String(body.nome_publico || '').trim()
  if (nome) patch.nome_publico_vendas = nome
  if (Object.keys(patch).length <= 1) return
  const { error } = await supabaseAdmin.from('managers').update(patch).eq('id', accountId)
  if (error && (error.code === 'PGRST204' || /whatsapp_url|nome_publico/i.test(error.message || ''))) {
    return
  }
  if (error) throw error
}

export async function GET(req: NextRequest, context: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await context.params
    const convite = await carregar(String(token || '').trim())
    let autenticado = false
    let manager = null as any
    try {
      const user = await getBearerUser(req)
      const accounts = await getAccountsForUser(user)
      const account = accounts.find((item) => item.profile_type === 'manager')
      autenticado = true
      manager = account
        ? { id: account.id, nome: account.name, username: account.username, avatar_url: account.data?.avatar_url || account.data?.foto_url || null }
        : null
    } catch {
      // guest
    }
    return NextResponse.json({
      convite,
      autenticado,
      manager,
      modo: convite.modo,
      valido: convite.status === 'ativo' && (!convite.usado || convite.manager_id === manager?.id),
    })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Convite inválido.' }, { status: 404 })
  }
}

export async function POST(req: NextRequest, context: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await context.params
    const user = await getBearerUser(req)
    const accounts = await getAccountsForUser(user)
    const account = accounts.find((item) => item.profile_type === 'manager')
    if (!account) throw new Error('Entre ou crie uma conta de manager para aceitar este convite.')

    const body = await req.json().catch(() => ({}))
    const convite = await carregar(String(token || '').trim())
    if (convite.status !== 'ativo') throw new Error('Este convite não está mais disponível.')
    if (convite.usado && convite.manager_id && convite.manager_id !== account.id) {
      throw new Error('Este convite já foi aceito por outro manager.')
    }
    if (convite.usado && convite.manager_id === account.id) {
      return NextResponse.json({
        ok: true,
        modo: convite.modo,
        painel_url: '/',
        mensagem: 'Convite já aceito. Configure seu WhatsApp no painel do manager.',
      })
    }

    // WhatsApp opcional no aceite (preenche depois no painel). Usa o que já tiver no perfil.
    let whatsappUrl: string | null = null
    try {
      if (body.whatsapp_url) whatsappUrl = normalizeWhatsapp(body.whatsapp_url)
    } catch {
      whatsappUrl = null
    }
    if (!whatsappUrl) {
      const existing = account.data?.whatsapp_url || null
      whatsappUrl = existing || null
    }

    const acceptBody = {
      ...body,
      nome_publico: String(body.nome_publico || '').trim() || account.name,
    }

    const { data, error } = await supabaseAdmin
      .from('tokens')
      .update({
        manager_id: account.id,
        usado: true,
        usado_em: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', convite.id)
      .select('*')
      .single()
    if (error) throw error

    await updateManagerProfile(account.id, acceptBody, whatsappUrl)
    await upsertProdutoraRoster(convite, account, acceptBody, whatsappUrl || '', user.id)
    await upsertSellerLink(convite, account, acceptBody, whatsappUrl || '', user.id)
    if (whatsappUrl && convite.campeonato_id) {
      await upsertSellerContact(convite.campeonato_id, account, acceptBody, whatsappUrl)
    }

    return NextResponse.json({
      ok: true,
      vendedor: data,
      modo: convite.modo,
      // Painel do manager no app (perfil manager), não a página pública de vendas
      painel_url: '/',
      mensagem:
        convite.modo === 'produtora'
          ? 'Você entrou na lista de vendedores da produtora. Configure o WhatsApp no painel e aguarde o produtor liberar os campeonatos.'
          : 'Convite aceito. Configure o WhatsApp no painel do manager para vender.',
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao aceitar convite.' },
      { status: 400 },
    )
  }
}
