import { NextRequest, NextResponse } from 'next/server'
import { getAccountsForUser, getBearerUser } from '@backend/auth/server-auth'
import { supabaseAdmin } from '@backend/shared/supabase-admin'

function normalizeWhatsapp(value: unknown) {
  const raw = String(value || '').trim()
  if (!raw) return null
  if (/^https:\/\/(wa\.me|api\.whatsapp\.com)\//i.test(raw)) return raw
  const digits = raw.replace(/\D/g, '')
  if (digits.length < 10) throw new Error('Informe um WhatsApp válido com DDD.')
  return `https://wa.me/${digits}`
}

async function requireOwnManager(req: NextRequest, managerId: string) {
  const user = await getBearerUser(req)
  const accounts = await getAccountsForUser(user)
  const account = accounts.find((item) => item.profile_type === 'manager' && item.id === managerId)
  if (!account) throw new Error('Acesso negado.')
  return account
}

export async function GET(req: NextRequest, context: { params: Promise<{ managerId: string }> }) {
  try {
    const { managerId } = await context.params
    await requireOwnManager(req, managerId)
    const { data, error } = await supabaseAdmin
      .from('managers')
      .select('id,nome,username,avatar_url,whatsapp_url,nome_publico_vendas,portfolio_anuncios,status')
      .eq('id', managerId)
      .maybeSingle()
    if (error && (error.code === 'PGRST204' || /column/i.test(error.message || ''))) {
      const fallback = await supabaseAdmin
        .from('managers')
        .select('id,nome,username,avatar_url,status')
        .eq('id', managerId)
        .maybeSingle()
      if (fallback.error) throw fallback.error
      return NextResponse.json({ manager: { ...fallback.data, whatsapp_url: null, nome_publico_vendas: null, portfolio_anuncios: [] } })
    }
    if (error) throw error
    return NextResponse.json({ manager: data })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro ao carregar perfil.' }, { status: 400 })
  }
}

/** Atualiza WhatsApp / nome público / quais campeonatos anunciar. */
export async function PATCH(req: NextRequest, context: { params: Promise<{ managerId: string }> }) {
  try {
    const { managerId } = await context.params
    await requireOwnManager(req, managerId)
    const body = await req.json().catch(() => ({}))

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (body.whatsapp_url !== undefined) {
      const url = normalizeWhatsapp(body.whatsapp_url)
      if (!url) throw new Error('Informe um WhatsApp válido.')
      patch.whatsapp_url = url
    }
    if (body.nome_publico_vendas !== undefined) {
      patch.nome_publico_vendas = String(body.nome_publico_vendas || '').trim() || null
    }
    if (body.portfolio_anuncios !== undefined) {
      const ids = Array.isArray(body.portfolio_anuncios)
        ? body.portfolio_anuncios.map((id: unknown) => String(id || '').trim()).filter(Boolean)
        : []
      patch.portfolio_anuncios = ids
    }

    let { data, error } = await supabaseAdmin.from('managers').update(patch).eq('id', managerId).select('*').single()
    if (error && (error.code === 'PGRST204' || /column|whatsapp|portfolio|nome_publico/i.test(error.message || ''))) {
      // migration ainda não aplicada: tenta só campos básicos e espelha no campeonato_vendedores
      const basic: Record<string, unknown> = { updated_at: new Date().toISOString() }
      if (body.nome_publico_vendas !== undefined) basic.nome = String(body.nome_publico_vendas || '').trim() || undefined
      const retry = await supabaseAdmin.from('managers').update(basic).eq('id', managerId).select('*').single()
      data = retry.data
      error = retry.error
    }
    if (error) throw error

    // Espelha WhatsApp nos vínculos de venda
    if (patch.whatsapp_url || patch.nome_publico_vendas) {
      const mirror: Record<string, unknown> = { updated_at: new Date().toISOString() }
      if (patch.whatsapp_url) mirror.whatsapp_url = patch.whatsapp_url
      if (patch.nome_publico_vendas) mirror.nome_publico = patch.nome_publico_vendas
      await supabaseAdmin.from('campeonato_vendedores').update(mirror).eq('manager_id', managerId).eq('status', 'ativo')
      await supabaseAdmin.from('produtora_vendedores').update(mirror).eq('manager_id', managerId).eq('status', 'ativo')
    }

    return NextResponse.json({ ok: true, manager: data })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro ao salvar perfil.' }, { status: 400 })
  }
}
