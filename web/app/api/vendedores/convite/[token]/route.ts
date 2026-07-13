import { NextRequest, NextResponse } from 'next/server'
import { getAccountsForUser, getBearerUser } from '@backend/auth/server-auth'
import { supabaseAdmin } from '@backend/shared/supabase-admin'

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
    .from('campeonato_vendedores')
    .select('*, campeonatos(id,nome,logo_url,status), produtoras(id,nome,logo_url)')
    .eq('token', token)
    .maybeSingle()
  if (error) throw error
  if (!convite) throw new Error('Convite não encontrado.')
  return convite
}

export async function GET(req: NextRequest, context: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await context.params
    const convite = await carregar(String(token || '').trim().toUpperCase())
    let autenticado = false
    let manager = null as any
    try {
      const user = await getBearerUser(req)
      const accounts = await getAccountsForUser(user)
      const account = accounts.find((item) => item.profile_type === 'manager')
      autenticado = true
      manager = account ? { id: account.id, nome: account.name, username: account.username, avatar_url: account.data?.avatar_url || account.data?.foto_url || null } : null
    } catch {}
    return NextResponse.json({ convite, autenticado, manager, valido: convite.status === 'pendente' || convite.status === 'ativo' })
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
    const convite = await carregar(String(token || '').trim().toUpperCase())
    if (convite.status === 'cancelado' || convite.status === 'suspenso') throw new Error('Este convite não está mais disponível.')
    if (convite.manager_id && convite.manager_id !== account.id) throw new Error('Este convite já foi aceito por outro manager.')

    const whatsappUrl = normalizeWhatsapp(body.whatsapp_url) || convite.whatsapp_url
    if (!whatsappUrl) throw new Error('Informe seu WhatsApp de venda.')

    const { data, error } = await supabaseAdmin
      .from('campeonato_vendedores')
      .update({
        manager_id: account.id,
        manager_auth_user_id: user.id,
        nome_publico: String(body.nome_publico || '').trim() || account.name,
        whatsapp_url: whatsappUrl,
        status: 'ativo',
        aceito_em: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', convite.id)
      .select('*, campeonatos(id,nome,logo_url,status)')
      .single()

    if (error) throw error
    return NextResponse.json({ vendedor: data, painel_url: `/vendedores/${account.id}` })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro ao aceitar convite.' }, { status: 400 })
  }
}
