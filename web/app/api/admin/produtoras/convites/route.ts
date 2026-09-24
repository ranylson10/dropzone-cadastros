import { createHash, randomBytes } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { requireSystemAdmin } from '@backend/admin/admin-auth'
import { findRegisteredAuthUserByEmail } from '@backend/auth/admin-users'
import { appUrl } from '@backend/shared/env'
import { supabaseAdmin } from '@backend/shared/supabase-admin'
import { sendDropZoneActionEmail } from '@/lib/transactional-email'

function normalizeEmail(value: unknown) {
  return String(value || '').trim().toLowerCase()
}

function hashToken(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

export async function GET(req: NextRequest) {
  try {
    await requireSystemAdmin(req)
    const { data, error } = await supabaseAdmin
      .from('produtora_convites')
      .select('id,tipo,email,nome_produtora,status,expira_em,created_at,destinatario_auth_user_id')
      .eq('tipo', 'criacao')
      .order('created_at', { ascending: false })
      .limit(100)
    if (error) throw error
    return NextResponse.json({ convites: data || [] })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro ao carregar convites de produtora.' }, { status: 403 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireSystemAdmin(req)
    const body = await req.json().catch(() => ({}))
    const email = normalizeEmail(body.email)
    const nomeProdutora = String(body.nome_produtora || '').trim()

    if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error('Informe um e-mail válido.')
    if (nomeProdutora.length < 2 || nomeProdutora.length > 120) throw new Error('Informe o nome da produtora.')

    const target = await findRegisteredAuthUserByEmail(email)
    if (!target) throw new Error('Este e-mail ainda não possui conta no DropZone.')

    const { data: existingProducer, error: existingProducerError } = await supabaseAdmin
      .from('produtoras')
      .select('id,nome')
      .eq('auth_user_id', target.id)
      .maybeSingle()
    if (existingProducerError) throw existingProducerError
    if (existingProducer) throw new Error(`Esta conta já é proprietária da produtora ${existingProducer.nome}.`)

    const { data: pending, error: pendingError } = await supabaseAdmin
      .from('produtora_convites')
      .select('id,expira_em')
      .eq('tipo', 'criacao')
      .eq('destinatario_auth_user_id', target.id)
      .eq('status', 'pendente')
      .maybeSingle()
    if (pendingError) throw pendingError
    if (pending && new Date(pending.expira_em).getTime() > Date.now()) {
      throw new Error('Já existe um convite de produtora pendente para este e-mail.')
    }
    if (pending) {
      await supabaseAdmin.from('produtora_convites').update({ status: 'expirado', updated_at: new Date().toISOString() }).eq('id', pending.id)
    }

    const rawToken = randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    const { data: invite, error: inviteError } = await supabaseAdmin
      .from('produtora_convites')
      .insert({
        tipo: 'criacao',
        email,
        destinatario_auth_user_id: target.id,
        nome_produtora: nomeProdutora,
        token_hash: hashToken(rawToken),
        convidado_por_auth_user_id: admin.id,
        status: 'pendente',
        expira_em: expiresAt,
      })
      .select('id')
      .single()
    if (inviteError) throw inviteError

    const publicUrl = `${appUrl()}/convite/produtora/${rawToken}`
    try {
      await sendDropZoneActionEmail({
        to: email,
        subject: `Convite para criar ${nomeProdutora} no DropZone`,
        title: `Sua produtora foi liberada: ${nomeProdutora}`,
        intro: 'A administração do DropZone autorizou esta conta a criar um workspace privado de produtora. Entre com este mesmo e-mail e aceite o convite.',
        actionLabel: 'Aceitar convite',
        actionUrl: publicUrl,
        footnote: 'Este convite é pessoal, expira em 7 dias e só pode ser aceito pela conta vinculada a este e-mail.',
      })
    } catch (emailError) {
      await supabaseAdmin.from('produtora_convites').delete().eq('id', invite.id)
      throw emailError
    }

    await supabaseAdmin.from('notificacoes').insert({
      destinatario_auth_user_id: target.id,
      remetente_auth_user_id: admin.id,
      tipo: 'convite_produtora',
      titulo: `Convite para criar ${nomeProdutora}`,
      corpo: 'A Central DropZone liberou um workspace privado de produtora para sua conta.',
      payload: { public_url: publicUrl, expira_em: expiresAt },
      referencia_tipo: 'produtora_convite',
      referencia_id: invite.id,
    })

    return NextResponse.json({ ok: true, convite_id: invite.id, expira_em: expiresAt })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro ao enviar convite de produtora.' }, { status: 400 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    await requireSystemAdmin(req)
    const id = String(req.nextUrl.searchParams.get('id') || '').trim()
    if (!id) throw new Error('Convite não informado.')
    const { data, error } = await supabaseAdmin
      .from('produtora_convites')
      .update({ status: 'cancelado', updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('tipo', 'criacao')
      .eq('status', 'pendente')
      .select('id')
      .maybeSingle()
    if (error) throw error
    if (!data) throw new Error('Convite pendente não encontrado.')
    return NextResponse.json({ ok: true })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro ao cancelar convite.' }, { status: 400 })
  }
}
