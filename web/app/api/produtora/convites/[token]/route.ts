import { createHash } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getBearerUser } from '@backend/auth/server-auth'
import { supabaseAdmin } from '@backend/shared/supabase-admin'
import { producerRolePermissions, PRODUCER_ROLE_LABELS, type ProducerMemberRole } from '@/lib/producer-workspace'

function hashToken(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

function maskEmail(value: string) {
  const [local, domain] = String(value || '').split('@')
  if (!local || !domain) return ''
  const visible = local.slice(0, Math.min(2, local.length))
  return `${visible}${'*'.repeat(Math.max(2, local.length - visible.length))}@${domain}`
}

function usernameBase(value: string) {
  const clean = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '')
    .slice(0, 24)
  return clean || 'produtora'
}

async function availableProducerUsername(name: string) {
  const base = usernameBase(name)
  for (let index = 0; index < 100; index += 1) {
    const candidate = index === 0 ? base : `${base}.${index + 1}`.slice(0, 30)
    const { data, error } = await supabaseAdmin.from('produtoras').select('id').ilike('username', candidate).maybeSingle()
    if (error) throw error
    if (!data) return candidate
  }
  return `${base.slice(0, 20)}.${Date.now().toString().slice(-6)}`
}

async function getInvite(rawToken: string) {
  const { data, error } = await supabaseAdmin
    .from('produtora_convites')
    .select('id,tipo,email,destinatario_auth_user_id,produtora_id,nome_produtora,cargo,status,expira_em,convidado_por_auth_user_id,created_at')
    .eq('token_hash', hashToken(rawToken))
    .maybeSingle()
  if (error) throw error
  return data
}

export async function GET(_req: NextRequest, context: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await context.params
    const invite = await getInvite(String(token || ''))
    if (!invite) throw new Error('Convite inválido ou não encontrado.')

    let producerName = invite.nome_produtora || ''
    if (invite.produtora_id) {
      const { data: producer, error } = await supabaseAdmin
        .from('produtoras')
        .select('nome')
        .eq('id', invite.produtora_id)
        .maybeSingle()
      if (error) throw error
      producerName = producer?.nome || 'Produtora'
    }

    const expired = new Date(invite.expira_em).getTime() <= Date.now()
    return NextResponse.json({
      convite: {
        tipo: invite.tipo,
        produtora_nome: producerName,
        cargo: invite.cargo,
        cargo_label: invite.cargo ? PRODUCER_ROLE_LABELS[invite.cargo as ProducerMemberRole] : null,
        email_mascarado: maskEmail(invite.email),
        status: expired && invite.status === 'pendente' ? 'expirado' : invite.status,
        expira_em: invite.expira_em,
      },
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro ao carregar convite.' }, { status: 400 })
  }
}

export async function POST(req: NextRequest, context: { params: Promise<{ token: string }> }) {
  try {
    const user = await getBearerUser(req)
    const { token } = await context.params
    const invite = await getInvite(String(token || ''))
    if (!invite) throw new Error('Convite inválido ou não encontrado.')
    if (invite.status !== 'pendente') throw new Error('Este convite não está mais disponível.')
    if (new Date(invite.expira_em).getTime() <= Date.now()) {
      await supabaseAdmin.from('produtora_convites').update({ status: 'expirado', updated_at: new Date().toISOString() }).eq('id', invite.id)
      throw new Error('Este convite expirou. Solicite um novo convite.')
    }
    if (String(invite.destinatario_auth_user_id) !== String(user.id)) {
      throw new Error('Este convite pertence a outra conta. Entre com o e-mail que recebeu o convite.')
    }

    let workspace: any = null
    if (invite.tipo === 'criacao') {
      const { data: existing, error: existingError } = await supabaseAdmin
        .from('produtoras')
        .select('id,nome,username,status')
        .eq('auth_user_id', user.id)
        .maybeSingle()
      if (existingError) throw existingError

      if (existing) {
        workspace = existing
      } else {
        const username = await availableProducerUsername(String(invite.nome_produtora || 'Produtora'))
        const { data: created, error: createError } = await supabaseAdmin
          .from('produtoras')
          .insert({
            auth_user_id: user.id,
            username,
            nome: String(invite.nome_produtora || 'Produtora').trim(),
            email_contato: String(user.email || invite.email || '').trim().toLowerCase() || null,
            email_verificado: true,
            status: 'ativo',
            aprovacao_status: 'aprovado',
            aprovado_em: new Date().toISOString(),
            aprovado_por: invite.convidado_por_auth_user_id,
          })
          .select('id,nome,username,status')
          .single()
        if (createError) throw createError
        workspace = created
      }
    } else if (invite.tipo === 'membro') {
      const role = String(invite.cargo || 'visualizacao') as ProducerMemberRole
      const permissions = producerRolePermissions(role)
      const { data: producer, error: producerError } = await supabaseAdmin
        .from('produtoras')
        .select('id,nome,username,status')
        .eq('id', invite.produtora_id)
        .maybeSingle()
      if (producerError) throw producerError
      if (!producer || String(producer.status || 'ativo') === 'deletado') throw new Error('A produtora deste convite não está disponível.')

      const { error: memberError } = await supabaseAdmin
        .from('produtora_membros')
        .upsert({
          produtora_id: invite.produtora_id,
          auth_user_id: user.id,
          cargo: role,
          ...permissions,
          status: 'ativo',
          convidado_por_auth_user_id: invite.convidado_por_auth_user_id,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'produtora_id,auth_user_id' })
      if (memberError) throw memberError
      workspace = producer
    } else {
      throw new Error('Tipo de convite inválido.')
    }

    const now = new Date().toISOString()
    const { error: updateError } = await supabaseAdmin
      .from('produtora_convites')
      .update({ status: 'aceito', respondido_em: now, updated_at: now })
      .eq('id', invite.id)
      .eq('status', 'pendente')
    if (updateError) throw updateError

    await supabaseAdmin
      .from('notificacoes')
      .update({ status: 'lida', read_at: now })
      .eq('destinatario_auth_user_id', user.id)
      .eq('referencia_tipo', 'produtora_convite')
      .eq('referencia_id', invite.id)

    return NextResponse.json({ ok: true, workspace })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro ao aceitar convite.' }, { status: 400 })
  }
}
