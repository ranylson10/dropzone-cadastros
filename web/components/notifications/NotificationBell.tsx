'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Archive, Bell, Check, CheckCheck, Loader2, X } from 'lucide-react'
import { supabase } from '@/lib/supabase-browser'


const ACTIONABLE_NOTIFICATION_TYPES = new Set([
  'convite_manager_equipe',
  'convite_manager_campeonato',
  'pedido_manager_campeonato',
  'convite_jogador_equipe_direto',
  'pedido_jogador_equipe',
])

type Notif = {
  id: string
  tipo: string
  titulo: string
  corpo?: string | null
  status: string
  payload?: any
  created_at: string
}

export function NotificationBell() {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState<Notif[]>([])
  const [unread, setUnread] = useState(0)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    try {
      const { data } = await supabase.auth.getSession()
      const token = data.session?.access_token
      if (!token) {
        setItems([])
        setUnread(0)
        return
      }
      setLoading(true)
      setError('')
      const res = await fetch('/api/notificacoes?limit=30', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Erro ao carregar correio.')
      setItems(json.items || [])
      setUnread(Number(json.nao_lidas || 0))
    } catch (err: any) {
      setError(err?.message || 'Erro ao carregar correio.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
    const timer = window.setInterval(() => void load(), 45000)
    return () => window.clearInterval(timer)
  }, [load])

  useEffect(() => {
    function closeOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', closeOutside)
    return () => document.removeEventListener('mousedown', closeOutside)
  }, [])

  async function authToken() {
    const { data } = await supabase.auth.getSession()
    if (!data.session?.access_token) throw new Error('Sessão expirada.')
    return data.session.access_token
  }

  async function markRead(id: string) {
    setBusyId(id)
    setError('')
    try {
      const token = await authToken()
      const res = await fetch('/api/notificacoes', {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: 'lida' }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Erro ao marcar notificação como lida.')
      setItems((current) => current.map((item) => item.id === id ? { ...item, status: 'lida' } : item))
      setUnread((current) => Math.max(0, current - 1))
    } catch (err: any) {
      setError(err?.message || 'Erro ao marcar notificação como lida.')
    } finally {
      setBusyId('')
    }
  }

  async function markRoutineNotificationsRead() {
    const routineUnread = items.filter((item) => item.status === 'nao_lida' && !ACTIONABLE_NOTIFICATION_TYPES.has(item.tipo)).length
    if (!routineUnread) return
    setBusyId('all-read')
    setError('')
    try {
      const token = await authToken()
      const res = await fetch('/api/notificacoes', {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ mark_all_read: true }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Erro ao marcar avisos como lidos.')
      setItems((current) => current.map((item) => ACTIONABLE_NOTIFICATION_TYPES.has(item.tipo) ? item : { ...item, status: 'lida' }))
      setUnread((current) => Math.max(0, current - routineUnread))
    } catch (err: any) {
      setError(err?.message || 'Erro ao marcar avisos como lidos.')
    } finally {
      setBusyId('')
    }
  }

  async function toggleInbox() {
    if (open) {
      setOpen(false)
      return
    }
    setOpen(true)
    try {
      const token = await authToken()
      await fetch('/api/notificacoes', {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ mark_all_read: true }),
      })
    } catch {
      // A listagem abaixo continua disponível mesmo se a atualização falhar.
    }
    await load()
  }

  async function archiveReadNotifications() {
    setBusyId('archive-read')
    setError('')
    try {
      const token = await authToken()
      const res = await fetch('/api/notificacoes?all_read=1', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Erro ao arquivar mensagens lidas.')
      await load()
    } catch (err: any) {
      setError(err?.message || 'Erro ao arquivar mensagens lidas.')
    } finally {
      setBusyId('')
    }
  }

  async function archive(id: string) {
    setBusyId(id)
    setError('')
    try {
      const token = await authToken()
      const res = await fetch(`/api/notificacoes?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Erro ao arquivar notificação.')
      await load()
    } catch (err: any) {
      setError(err?.message || 'Erro ao arquivar notificação.')
    } finally {
      setBusyId('')
    }
  }

  async function respond(id: string, action: 'aceitar' | 'recusar') {
    setBusyId(id)
    setError('')
    try {
      const token = await authToken()
      const res = await fetch(`/api/notificacoes/${id}/${action}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || `Erro ao ${action}.`)
      await load()
    } catch (err: any) {
      setError(err?.message || `Erro ao ${action}.`)
    } finally {
      setBusyId('')
    }
  }

  return (
    <div className="notif-bell" ref={ref}>
      <button
        type="button"
        className="notif-bell-trigger"
        aria-label="Correio"
        aria-expanded={open}
        onClick={() => void toggleInbox()}
      >
        <Bell size={18} />
        {unread > 0 ? <span className="notif-bell-badge">{unread > 9 ? '9+' : unread}</span> : null}
      </button>

      {open ? (
        <div className="notif-inbox-panel">
          <header className="notif-inbox-head">
            <div>
              <strong>Correio</strong>
              <small>{unread} não lida(s)</small>
            </div>
            <div className="notif-inbox-head-actions">
              {items.some((item) => item.status === 'nao_lida' && !ACTIONABLE_NOTIFICATION_TYPES.has(item.tipo)) ? (
                <button type="button" className="button secondary small" disabled={busyId === 'all-read'} onClick={() => void markRoutineNotificationsRead()}>
                  <CheckCheck size={14} /> Marcar avisos como lidos
                </button>
              ) : null}
              {items.some((item) => item.status === 'lida') ? (
                <button type="button" className="button secondary small" disabled={busyId === 'archive-read'} onClick={() => void archiveReadNotifications()}>
                  <Archive size={14} /> Arquivar lidas
                </button>
              ) : null}
              <button type="button" className="button secondary small" onClick={() => setOpen(false)} aria-label="Fechar">
                <X size={14} />
              </button>
            </div>
          </header>

          {error ? <div className="message error compact">{error}</div> : null}
          {loading && items.length === 0 ? (
            <p className="empty compact-empty">
              <Loader2 size={14} className="spin" /> Carregando...
            </p>
          ) : null}
          {!loading && items.length === 0 ? (
            <p className="empty compact-empty">Nenhuma mensagem por enquanto.</p>
          ) : null}

          <div className="notif-inbox-list">
            {items.map((item) => {
              const actionable = ACTIONABLE_NOTIFICATION_TYPES.has(item.tipo)
              const unreadItem = item.status === 'nao_lida'
              const perms = item.payload?.permissoes || {}
              const permLine = item.tipo === 'convite_manager_equipe'
                ? [
                    perms.pode_ver ? 'ver' : null,
                    perms.pode_editar ? 'editar' : null,
                    perms.pode_escalar ? 'escalar' : null,
                    perms.pode_gerar_token ? 'tokens' : null,
                  ].filter(Boolean).join(', ')
                : (item.tipo === 'convite_manager_campeonato' || item.tipo === 'pedido_manager_campeonato')
                  ? [
                      perms.gerar_convites_equipe !== false ? 'convites' : null,
                      perms.adicionar_equipes ? 'add equipes' : null,
                      perms.ver_estrutura !== false ? 'estrutura' : null,
                      perms.organizar_grupos ? 'grupos' : null,
                      perms.pontuar_tabela ? 'pontuar' : null,
                    ].filter(Boolean).join(', ')
                  : ''
              const acceptLabel =
                item.tipo === 'pedido_manager_campeonato' ? 'Liberar' : 'Aceitar'
              return (
                <article key={item.id} className={`notif-inbox-item ${unreadItem ? 'is-unread' : ''}`}>
                  <div className="notif-inbox-item-top">
                    <strong>{item.titulo}</strong>
                    <time>{new Date(item.created_at).toLocaleString('pt-BR')}</time>
                  </div>
                  {item.corpo ? <p>{item.corpo}</p> : null}
                  {actionable && permLine ? (
                    <small className="notif-perms">Permissões: {permLine || '—'}</small>
                  ) : null}
                  {item.payload?.limite_vagas != null && Number(item.payload.limite_vagas) > 0 ? (
                    <small className="notif-perms">Limite: {item.payload.limite_vagas} vaga(s)</small>
                  ) : null}
                  <div className="notif-inbox-actions">
                    {actionable && unreadItem ? (
                      <>
                        <button
                          type="button"
                          className="button small"
                          disabled={busyId === item.id}
                          onClick={() => void respond(item.id, 'aceitar')}
                        >
                          <Check size={14} /> {acceptLabel}
                        </button>
                        <button
                          type="button"
                          className="button secondary small"
                          disabled={busyId === item.id}
                          onClick={() => void respond(item.id, 'recusar')}
                        >
                          Recusar
                        </button>
                      </>
                    ) : unreadItem ? (
                      <button type="button" className="button secondary small" disabled={busyId === item.id} onClick={() => void markRead(item.id)}>
                        Marcar como lida
                      </button>
                    ) : null}
                    {!actionable || !unreadItem ? (
                      <button
                        type="button"
                        className="button secondary small"
                        disabled={busyId === item.id}
                        onClick={() => void archive(item.id)}
                        title="Arquivar notificação"
                      >
                        <Archive size={14} /> Arquivar
                      </button>
                    ) : null}
                  </div>
                </article>
              )
            })}
          </div>
        </div>
      ) : null}
    </div>
  )
}
