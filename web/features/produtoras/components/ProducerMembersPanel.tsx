'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { MailPlus, RefreshCw, ShieldCheck, Trash2, UserRoundCheck, Users } from 'lucide-react'
import { supabase } from '@/lib/supabase-browser'
import {
  PRODUCER_MEMBER_ROLES,
  PRODUCER_ROLE_DESCRIPTIONS,
  PRODUCER_ROLE_LABELS,
  type ProducerMemberRole,
  type ProducerWorkspaceRole,
} from '@/lib/producer-workspace'

type WorkspaceAccess = {
  role: ProducerWorkspaceRole
  isOwner: boolean
  pode_gerenciar_membros: boolean
}

type Member = {
  id: string
  auth_user_id: string
  cargo: ProducerWorkspaceRole
  status: string
  is_owner: boolean
  email?: string | null
  identity?: { display_name?: string | null; username?: string | null; avatar_url?: string | null } | null
}

type PendingInvite = {
  id: string
  email: string
  cargo: ProducerMemberRole
  status: string
  expira_em: string
}

export function ProducerMembersPanel({ producerId }: { producerId: string }) {
  const [members, setMembers] = useState<Member[]>([])
  const [invites, setInvites] = useState<PendingInvite[]>([])
  const [access, setAccess] = useState<WorkspaceAccess | null>(null)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<ProducerMemberRole>('operacao')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const request = useCallback(async (path: string, options?: RequestInit) => {
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    if (!token) throw new Error('Sessão expirada. Entre novamente.')
    const response = await fetch(path, {
      ...options,
      cache: 'no-store',
      headers: {
        ...(options?.body ? { 'Content-Type': 'application/json' } : {}),
        Authorization: `Bearer ${token}`,
        ...(options?.headers || {}),
      },
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(payload.error || 'Não foi possível concluir a operação.')
    return payload
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const payload = await request(`/api/produtora/membros?produtora_id=${encodeURIComponent(producerId)}`)
      setMembers(payload.membros || [])
      setInvites(payload.convites || [])
      setAccess(payload.access || null)
    } catch (cause: any) {
      setError(cause?.message || 'Não foi possível carregar a equipe da produtora.')
    } finally {
      setLoading(false)
    }
  }, [producerId, request])

  useEffect(() => { void load() }, [load])

  const canManage = Boolean(access?.pode_gerenciar_membros)
  const memberCount = useMemo(() => members.filter((item) => item.status === 'ativo').length, [members])

  async function inviteMember() {
    if (!email.trim()) {
      setError('Informe o e-mail cadastrado no DropZone.')
      return
    }
    setBusy('invite')
    setError('')
    setMessage('')
    try {
      await request('/api/produtora/membros', {
        method: 'POST',
        body: JSON.stringify({ produtora_id: producerId, email, cargo: role }),
      })
      setEmail('')
      setMessage('Convite enviado por e-mail. O acesso só será liberado depois do aceite.')
      await load()
    } catch (cause: any) {
      setError(cause?.message || 'Não foi possível enviar o convite.')
    } finally {
      setBusy('')
    }
  }

  async function changeRole(member: Member, nextRole: ProducerMemberRole) {
    setBusy(member.id)
    setError('')
    try {
      await request('/api/produtora/membros', {
        method: 'PATCH',
        body: JSON.stringify({ produtora_id: producerId, membro_id: member.id, cargo: nextRole }),
      })
      await load()
    } catch (cause: any) {
      setError(cause?.message || 'Não foi possível alterar o cargo.')
    } finally {
      setBusy('')
    }
  }

  async function removeMember(member: Member) {
    const label = member.identity?.display_name || member.identity?.username || member.email || 'este membro'
    if (!window.confirm(`Remover ${label} da equipe da produtora?`)) return
    setBusy(member.id)
    setError('')
    try {
      await request(`/api/produtora/membros?produtora_id=${encodeURIComponent(producerId)}&membro_id=${encodeURIComponent(member.id)}`, { method: 'DELETE' })
      await load()
    } catch (cause: any) {
      setError(cause?.message || 'Não foi possível remover o membro.')
    } finally {
      setBusy('')
    }
  }

  async function cancelInvite(invite: PendingInvite) {
    if (!window.confirm(`Cancelar o convite enviado para ${invite.email}?`)) return
    setBusy(invite.id)
    setError('')
    try {
      await request(`/api/produtora/membros?produtora_id=${encodeURIComponent(producerId)}&convite_id=${encodeURIComponent(invite.id)}`, { method: 'DELETE' })
      await load()
    } catch (cause: any) {
      setError(cause?.message || 'Não foi possível cancelar o convite.')
    } finally {
      setBusy('')
    }
  }

  return (
    <section className="producer-team-workspace">
      <header className="producer-team-head">
        <div><p className="eyebrow">Workspace privado</p><h2>Equipe interna</h2><small>{memberCount} membro{memberCount === 1 ? '' : 's'} com acesso</small></div>
        <button type="button" onClick={() => void load()} disabled={loading} aria-label="Atualizar equipe"><RefreshCw size={17} className={loading ? 'spin' : ''} /></button>
      </header>

      {error ? <div className="message error">{error}</div> : null}
      {message ? <div className="message">{message}</div> : null}

      {canManage ? (
        <div className="producer-member-invite">
          <div>
            <MailPlus size={20} />
            <span><strong>Convidar por e-mail</strong><small>Somente contas já cadastradas no DropZone podem entrar no workspace.</small></span>
          </div>
          <div className="producer-member-invite-form">
            <label><span>E-mail cadastrado</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="usuario@email.com" /></label>
            <label><span>Cargo</span><select value={role} onChange={(event) => setRole(event.target.value as ProducerMemberRole)}>{PRODUCER_MEMBER_ROLES.map((item) => <option key={item} value={item}>{PRODUCER_ROLE_LABELS[item]}</option>)}</select></label>
            <button type="button" disabled={busy === 'invite'} onClick={() => void inviteMember()}><MailPlus size={15} /> {busy === 'invite' ? 'Enviando…' : 'Enviar convite'}</button>
          </div>
          <p>{PRODUCER_ROLE_DESCRIPTIONS[role]}</p>
        </div>
      ) : (
        <div className="producer-member-readonly"><ShieldCheck size={18} /><span><strong>Seu acesso é {PRODUCER_ROLE_LABELS[access?.role || 'visualizacao']}</strong><small>Somente proprietário e administradores podem convidar ou alterar a equipe.</small></span></div>
      )}

      <div className="producer-members-list">
        {loading ? <p className="empty">Carregando membros…</p> : null}
        {!loading && members.length === 0 ? <p className="empty">Nenhum membro encontrado.</p> : null}
        {members.map((member) => {
          const title = member.identity?.display_name || member.identity?.username || member.email || 'Conta DropZone'
          const username = member.identity?.username ? `@${member.identity.username}` : member.email || ''
          return (
            <article key={member.id} className={member.is_owner ? 'owner' : ''}>
              <span className="producer-member-avatar">{member.identity?.avatar_url ? <img src={member.identity.avatar_url} alt="" /> : <UserRoundCheck size={18} />}</span>
              <span className="producer-member-identity"><strong>{title}</strong><small>{username}</small></span>
              <span className="producer-member-role">
                {member.is_owner ? <b><ShieldCheck size={13} /> Proprietário</b> : canManage ? (
                  <select value={member.cargo} disabled={busy === member.id} onChange={(event) => void changeRole(member, event.target.value as ProducerMemberRole)}>
                    {PRODUCER_MEMBER_ROLES.map((item) => <option key={item} value={item}>{PRODUCER_ROLE_LABELS[item]}</option>)}
                  </select>
                ) : <b>{PRODUCER_ROLE_LABELS[member.cargo] || member.cargo}</b>}
              </span>
              {canManage && !member.is_owner ? <button type="button" className="producer-member-remove" disabled={busy === member.id} onClick={() => void removeMember(member)} aria-label={`Remover ${title}`}><Trash2 size={15} /></button> : <span />}
            </article>
          )
        })}
      </div>

      {invites.length ? (
        <section className="producer-pending-members">
          <header><Users size={16} /><span><strong>Convites pendentes</strong><small>Acesso ainda não liberado</small></span></header>
          <div>{invites.map((invite) => <article key={invite.id}><span><strong>{invite.email}</strong><small>{PRODUCER_ROLE_LABELS[invite.cargo]} · expira {new Date(invite.expira_em).toLocaleDateString('pt-BR')}</small></span>{canManage ? <button type="button" disabled={busy === invite.id} onClick={() => void cancelInvite(invite)}>Cancelar</button> : null}</article>)}</div>
        </section>
      ) : null}
    </section>
  )
}
