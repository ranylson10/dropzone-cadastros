'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Bell, Check, Loader2, X } from 'lucide-react'
import { supabase } from '@/lib/supabase-browser'

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
    const token = await authToken()
    await fetch('/api/notificacoes', {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status: 'lida' }),
    })
    await load()
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
        onClick={() => {
          setOpen((v) => !v)
          if (!open) void load()
        }}
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
            <button type="button" className="button secondary small" onClick={() => setOpen(false)} aria-label="Fechar">
              <X size={14} />
            </button>
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
              const actionable =
                item.tipo === 'convite_manager_equipe'
                || item.tipo === 'convite_manager_campeonato'
                || item.tipo === 'pedido_manager_campeonato'
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
                      <button type="button" className="button secondary small" onClick={() => void markRead(item.id)}>
                        Marcar como lida
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
