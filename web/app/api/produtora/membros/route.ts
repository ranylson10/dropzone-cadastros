import { createHash, randomBytes } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { findRegisteredAuthUserByEmail } from '@backend/auth/admin-users'
import { getBearerUser } from '@backend/auth/server-auth'
import { appUrl } from '@backend/shared/env'
import { supabaseAdmin } from '@backend/shared/supabase-admin'
import { requireProducerWorkspaceAccess } from '@backend/produtora/workspace-access'
import {
  normalizeProducerMemberRole,
  producerRolePermissions,
  PRODUCER_ROLE_LABELS,
} from '@/lib/producer-workspace'
import { sendDropZoneActionEmail } from '@/lib/transactional-email'

function hashToken(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

function producerIdFromRequest(req: NextRequest, body?: any) {
  return String(body?.produtora_id || req.nextUrl.searchParams.get('produtora_id') || '').trim()
}

async function loadProducer(produtoraId: string) {
  const { data, error } = await supabaseAdmin
    .from('produtoras')
    .select('id,nome,username,auth_user_id,status')
    .eq('id', produtoraId)
    .maybeSingle()
  if (error) throw error
  if (!data || String(data.status || 'ativo') === 'deletado') throw new Error('Produtora não encontrada.')
  return data
}

export async function GET(req: NextRequest) {
  try {
    const user = await getBearerUser(req)
    const produtoraId = producerIdFromRequest(req)
    if (!produtoraId) throw new Error('Produtora não informada.')
    const access = await requireProducerWorkspaceAccess(user.id, produtoraId, 'ver')
    const produtora = await loadProducer(produtoraId)

    const [{ data: members, error: membersError }, { data: invites, error: invitesError }] = await Promise.all([
      supabaseAdmin
        .from('produtora_membros')
        .select('id,produtora_id,auth_user_id,cargo,status,pode_ver,pode_administrar,pode_operar,pode_pontuar,pode_financeiro,pode_comercial,pode_gerenciar_membros,pode_criar_campeonato,created_at,updated_at')
        .eq('produtora_id', produtoraId)
        .order('created_at', { ascending: true }),
      supabaseAdmin
        .from('produtora_convites')
        .select('id,email,cargo,status,expira_em,created_at,destinatario_auth_user_id')
        .eq('produtora_id', produtoraId)
        .eq('tipo', 'membro')
        .eq('status', 'pendente')
        .order('created_at', { ascending: false }),
    ])
    if (membersError) throw membersError
    if (invitesError) throw invitesError

    const memberUserIds = Array.from(new Set((members || []).map((item: any) => String(item.auth_user_id))))
    const identityMap = new Map<string, any>()
    if (memberUserIds.length) {
      const { data: identities, error: identityError } = await supabaseAdmin
        .from('account_identities')
        .select('auth_user_id,username,display_name,avatar_url')
        .in('auth_user_id', memberUserIds)
      if (identityError && !['42P01', 'PGRST205'].includes(identityError.code || '')) throw identityError
      for (const identity of identities || []) identityMap.set(String(identity.auth_user_id), identity)
    }

    const enrichedMembers = await Promise.all((members || []).map(async (member: any) => {
      const identity = identityMap.get(String(member.auth_user_id)) || null
      const { data: authData } = await supabaseAdmin.auth.admin.getUserById(String(member.auth_user_id))
      return {
        ...member,
        is_owner: String(member.auth_user_id) === String(produtora.auth_user_id),
        identity,
        email: authData.user?.email || null,
      }
    }))

    return NextResponse.json({
      produtora: { id: produtora.id, nome: produtora.nome, username: produtora.username },
      access,
      membros: enrichedMembers,
      convites: invites || [],
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro ao carregar equipe da produtora.' }, { status: 400 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getBearerUser(req)
    const body = await req.json().catch(() => ({}))
    const produtoraId = producerIdFromRequest(req, body)
    if (!produtoraId) throw new Error('Produtora não informada.')
    await requireProducerWorkspaceAccess(user.id, produtoraId, 'gerenciar_membros')
    const produtora = await loadProducer(produtoraId)

    const email = String(body.email || '').trim().toLowerCase()
    const role = normalizeProducerMemberRole(body.cargo)
    if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error('Informe um e-mail válido.')

    const target = await findRegisteredAuthUserByEmail(email)
    if (!target) throw new Error('Este e-mail ainda não possui conta no DropZone.')
    if (String(target.id) === String(produtora.auth_user_id)) throw new Error('O proprietário já possui acesso total à produtora.')

    const { data: existingMember, error: memberError } = await supabaseAdmin
      .from('produtora_membros')
      .select('id,status,cargo')
      .eq('produtora_id', produtoraId)
      .eq('auth_user_id', target.id)
      .maybeSingle()
    if (memberError) throw memberError
    if (existingMember?.status === 'ativo') throw new Error('Esta conta já faz parte da equipe da produtora.')

    const { data: pending, error: pendingError } = await supabaseAdmin
      .from('produtora_convites')
      .select('id,expira_em')
      .eq('tipo', 'membro')
      .eq('produtora_id', produtoraId)
      .eq('destinatario_auth_user_id', target.id)
      .eq('status', 'pendente')
      .maybeSingle()
    if (pendingError) throw pendingError
    if (pending && new Date(pending.expira_em).getTime() > Date.now()) throw new Error('Já existe um convite pendente para este e-mail.')
    if (pending) await supabaseAdmin.from('produtora_convites').update({ status: 'expirado', updated_at: new Date().toISOString() }).eq('id', pending.id)

    const rawToken = randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    const { data: invite, error: inviteError } = await supabaseAdmin
      .from('produtora_convites')
      .insert({
        tipo: 'membro',
        email,
        destinatario_auth_user_id: target.id,
        produtora_id: produtoraId,
        cargo: role,
        token_hash: hashToken(rawToken),
        convidado_por_auth_user_id: user.id,
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
        subject: `Convite para a equipe de ${produtora.nome}`,
        title: `Você foi convidado para ${produtora.nome}`,
        intro: `Você recebeu acesso ao workspace da produtora como ${PRODUCER_ROLE_LABELS[role]}. Entre com este mesmo e-mail para aceitar.`,
        actionLabel: 'Aceitar acesso',
        actionUrl: publicUrl,
        footnote: 'Este convite expira em 7 dias. As permissões podem ser alteradas depois pelo proprietário ou administrador da produtora.',
      })
    } catch (emailError) {
      await supabaseAdmin.from('produtora_convites').delete().eq('id', invite.id)
      throw emailError
    }

    await supabaseAdmin.from('notificacoes').insert({
      destinatario_auth_user_id: target.id,
      remetente_auth_user_id: user.id,
      remetente_profile_type: 'produtora',
      remetente_profile_id: produtoraId,
      tipo: 'convite_membro_produtora',
      titulo: `Convite para ${produtora.nome}`,
      corpo: `Acesso como ${PRODUCER_ROLE_LABELS[role]}.`,
      payload: { public_url: publicUrl, expira_em: expiresAt, cargo: role },
      referencia_tipo: 'produtora_convite',
      referencia_id: invite.id,
    })

    return NextResponse.json({ ok: true, convite_id: invite.id, expira_em: expiresAt })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro ao convidar membro.' }, { status: 400 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await getBearerUser(req)
    const body = await req.json().catch(() => ({}))
    const produtoraId = producerIdFromRequest(req, body)
    const memberId = String(body.membro_id || '').trim()
    if (!produtoraId || !memberId) throw new Error('Membro não informado.')
    await requireProducerWorkspaceAccess(user.id, produtoraId, 'gerenciar_membros')
    const produtora = await loadProducer(produtoraId)
    const role = normalizeProducerMemberRole(body.cargo)

    const { data: current, error: currentError } = await supabaseAdmin
      .from('produtora_membros')
      .select('id,auth_user_id,cargo')
      .eq('id', memberId)
      .eq('produtora_id', produtoraId)
      .maybeSingle()
    if (currentError) throw currentError
    if (!current) throw new Error('Membro não encontrado.')
    if (String(current.auth_user_id) === String(produtora.auth_user_id) || current.cargo === 'proprietario') {
      throw new Error('O cargo do proprietário não pode ser alterado.')
    }

    const permissions = producerRolePermissions(role)
    const { data, error } = await supabaseAdmin
      .from('produtora_membros')
      .update({ cargo: role, ...permissions, status: 'ativo', updated_at: new Date().toISOString() })
      .eq('id', memberId)
      .eq('produtora_id', produtoraId)
      .select('id,cargo,status')
      .single()
    if (error) throw error
    return NextResponse.json({ ok: true, membro: data })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro ao atualizar membro.' }, { status: 400 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getBearerUser(req)
    const produtoraId = producerIdFromRequest(req)
    if (!produtoraId) throw new Error('Produtora não informada.')
    await requireProducerWorkspaceAccess(user.id, produtoraId, 'gerenciar_membros')
    const produtora = await loadProducer(produtoraId)

    const inviteId = String(req.nextUrl.searchParams.get('convite_id') || '').trim()
    if (inviteId) {
      const { data, error } = await supabaseAdmin
        .from('produtora_convites')
        .update({ status: 'cancelado', updated_at: new Date().toISOString() })
        .eq('id', inviteId)
        .eq('produtora_id', produtoraId)
        .eq('tipo', 'membro')
        .eq('status', 'pendente')
        .select('id')
        .maybeSingle()
      if (error) throw error
      if (!data) throw new Error('Convite pendente não encontrado.')
      return NextResponse.json({ ok: true })
    }

    const memberId = String(req.nextUrl.searchParams.get('membro_id') || '').trim()
    if (!memberId) throw new Error('Membro não informado.')
    const { data: current, error: currentError } = await supabaseAdmin
      .from('produtora_membros')
      .select('id,auth_user_id,cargo')
      .eq('id', memberId)
      .eq('produtora_id', produtoraId)
      .maybeSingle()
    if (currentError) throw currentError
    if (!current) throw new Error('Membro não encontrado.')
    if (String(current.auth_user_id) === String(produtora.auth_user_id) || current.cargo === 'proprietario') {
      throw new Error('O proprietário não pode ser removido da própria produtora.')
    }

    const { error } = await supabaseAdmin
      .from('produtora_membros')
      .update({ status: 'inativo', updated_at: new Date().toISOString() })
      .eq('id', memberId)
      .eq('produtora_id', produtoraId)
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Erro ao remover membro.' }, { status: 400 })
  }
}
