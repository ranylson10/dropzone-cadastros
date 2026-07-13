import { randomBytes } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getBearerUser } from '@backend/auth/server-auth'
import { requireCampeonatoManage } from '@backend/campeonatos/campeonato-permissions'
import { supabaseAdmin } from '@backend/shared/supabase-admin'

function novoToken() {
  return randomBytes(18).toString('base64url').toUpperCase()
}

function normalizeWhatsapp(value: unknown) {
  const raw = String(value || '').trim()
  if (!raw) return null
  if (/^https:\/\/(wa\.me|api\.whatsapp\.com)\//i.test(raw)) return raw
  const digits = raw.replace(/\D/g, '')
  if (digits.length < 10) throw new Error('Informe um WhatsApp válido.')
  return `https://wa.me/${digits}`
}

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const user = await getBearerUser(req)
    await requireCampeonatoManage(user.id, id)

    const { data, error } = await supabaseAdmin
      .from('campeonato_vendedores')
      .select('*, managers(id,nome,username,avatar_url,foto_url)')
      .eq('campeonato_id', id)
      .neq('status', 'cancelado')
      .order('created_at', { ascending: false })

    if (error) throw error
    return NextResponse.json({ vendedores: data || [] })
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
    const token = novoToken()
    const { data: convite, error } = await supabaseAdmin
      .from('campeonato_vendedores')
      .insert({
        campeonato_id: id,
        produtora_id: permission.produtoraId,
        token,
        nome_publico: String(body.nome_publico || '').trim() || null,
        whatsapp_url: normalizeWhatsapp(body.whatsapp_url),
        status: 'pendente',
        criado_por: user.id,
      })
      .select('*')
      .single()

    if (error) throw error
    return NextResponse.json({ convite, link: `${req.nextUrl.origin}/vendedor/${token}` }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro ao criar convite de vendedor.' }, { status: 400 })
  }
}
