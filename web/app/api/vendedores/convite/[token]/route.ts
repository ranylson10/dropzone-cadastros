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

async function carregar(token: string) {
  const { data: convite, error } = await supabaseAdmin
    .from('tokens')
    .select('*')
    .eq('token', token)
    .eq('tipo', 'manager_invite')
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

  return { ...convite, campeonatos: campeonato, produtoras: produtora }
}

async function upsertSellerContact(convite: any, account: any, body: any, whatsappUrl: string) {
  const { data: config, error } = await supabaseAdmin
    .from('campeonato_configuracoes')
    .select('id,contatos_whatsapp')
    .eq('campeonato_id', convite.campeonato_id)
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

async function upsertSellerLink(convite: any, account: any, body: any, whatsappUrl: string, userId: string) {
  const { error } = await supabaseAdmin
    .from('campeonato_vendedores')
    .upsert({
      token: convite.token,
      campeonato_id: convite.campeonato_id,
      produtora_id: convite.produtora_id,
      manager_id: account.id,
      manager_auth_user_id: userId,
      nome_publico: String(body.nome_publico || '').trim() || account.name,
      whatsapp_url: whatsappUrl,
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
    }, { onConflict: 'token' })
  if (error && !missingRelation(error)) throw error
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
      manager = account ? { id: account.id, nome: account.name, username: account.username, avatar_url: account.data?.avatar_url || account.data?.foto_url || null } : null
    } catch {}
    return NextResponse.json({
      convite,
      autenticado,
      manager,
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
    if (convite.manager_id && convite.manager_id !== account.id) throw new Error('Este convite já foi aceito por outro manager.')

    const whatsappUrl = normalizeWhatsapp(body.whatsapp_url)
    if (!whatsappUrl) throw new Error('Informe seu WhatsApp de venda.')

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
    await upsertSellerLink(convite, account, body, whatsappUrl, user.id)
    await upsertSellerContact(convite, account, body, whatsappUrl)
    return NextResponse.json({ vendedor: data, painel_url: `/vendedores/${account.id}` })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro ao aceitar convite.' }, { status: 400 })
  }
}
