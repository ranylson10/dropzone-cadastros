'use client'

import { useCallback, useEffect, useState } from 'react'
import { Copy, ExternalLink, Plus, Trash2, Radio } from 'lucide-react'
import { supabase } from '@/lib/supabase-browser'
import '../broadcast.css'
import '@/features/campeonatos/stream/stream.css'

type LinkRow = {
  id: string
  campeonato_id: string
  display_name: string
  campeonato?: { id: string; nome: string; logo_url?: string } | null
}

type SessionRow = {
  id: string
  campeonato_id: string
  nome: string
  controller_token: string
  obs_token: string
  active_overlay_id?: string | null
  updated_at?: string
}

async function authFetch(url: string, options?: RequestInit) {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  const res = await fetch(url, {
    cache: 'no-store',
    ...options,
    headers: {
      ...(options?.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options?.headers || {}),
    },
  })
  const payload = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(payload.error || 'Falha na requisição.')
  return payload
}

export function StreamDashboard(props: { profileName?: string }) {
  const [links, setLinks] = useState<LinkRow[]>([])
  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [keyToken, setKeyToken] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [missingTable, setMissingTable] = useState(false)

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const me = await authFetch('/api/broadcast/me')
      setLinks(me.links || [])
      setSessions(me.sessions || [])
      setMissingTable(false)
    } catch (e: any) {
      if (String(e?.message || '').includes('SQL') || String(e?.message || '').includes('broadcasts')) {
        setMissingTable(true)
      }
      setFeedback(e?.message || 'Erro ao carregar.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  async function addChampionship(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setFeedback('')
    try {
      await authFetch('/api/broadcast/links', {
        method: 'POST',
        body: JSON.stringify({ key_token: keyToken.trim(), display_name: displayName.trim() }),
      })
      setKeyToken('')
      setDisplayName('')
      setFeedback('Campeonato adicionado à sua lista.')
      await reload()
    } catch (err: any) {
      setFeedback(err?.message || 'Falha ao resgatar chave.')
    } finally {
      setBusy(false)
    }
  }

  async function removeLink(id: string) {
    if (!window.confirm('Remover este campeonato da sua lista?')) return
    setBusy(true)
    try {
      await authFetch(`/api/broadcast/links/${id}`, { method: 'DELETE' })
      await reload()
    } catch (err: any) {
      setFeedback(err?.message || 'Erro ao remover.')
    } finally {
      setBusy(false)
    }
  }

  async function createLive(campeonatoId: string, label: string) {
    setBusy(true)
    setFeedback('')
    try {
      const res = await authFetch('/api/broadcast/sessions', {
        method: 'POST',
        body: JSON.stringify({ campeonato_id: campeonatoId, nome: `Live · ${label}` }),
      })
      setFeedback('Live criada. Copie os links de Controlador e OBS.')
      await reload()
      return res.session as SessionRow
    } catch (err: any) {
      setFeedback(err?.message || 'Erro ao criar live.')
      return null
    } finally {
      setBusy(false)
    }
  }

  function copy(text: string, okMsg: string) {
    void navigator.clipboard.writeText(text).then(
      () => setFeedback(okMsg),
      () => setFeedback(text),
    )
  }

  const origin = typeof window !== 'undefined' ? window.location.origin : ''

  return (
    <div className="broadcast-page">
      <header>
        <p className="eyebrow" style={{ margin: 0, color: 'var(--brand)', fontSize: 10, fontWeight: 900, letterSpacing: '0.12em' }}>
          BROADCAST · STREAM
        </p>
        <h1>{props.profileName || 'Painel Stream'}</h1>
        <p style={{ margin: 0, color: 'var(--muted)', maxWidth: '56ch' }}>
          Cole a chave do campeonato, monte sua lista e gere o controlador + overlay OBS.
        </p>
      </header>

      {missingTable ? (
        <div className="broadcast-card" style={{ borderColor: 'var(--danger, #c44)' }}>
          <p style={{ margin: 0 }}>
            Rode no Supabase: <code>database/migrations/20260718_broadcast_stream.sql</code>
          </p>
        </div>
      ) : null}

      {feedback ? <p style={{ margin: 0, color: 'var(--muted)', fontSize: '0.9rem' }}>{feedback}</p> : null}

      <section className="broadcast-card">
        <h2>Adicionar campeonato</h2>
        <form className="broadcast-row" onSubmit={(e) => void addChampionship(e)}>
          <label className="broadcast-field">
            <span>Chave Stream</span>
            <input
              value={keyToken}
              onChange={(e) => setKeyToken(e.target.value)}
              placeholder="Cole a chave enviada pela produtora"
              autoComplete="off"
              required
            />
          </label>
          <label className="broadcast-field">
            <span>Nome na sua lista</span>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Ex.: Copa Finals — PC 1"
              required
            />
          </label>
          <button type="submit" className="stream-primary-btn" disabled={busy} style={{ alignSelf: 'end', minHeight: 36 }}>
            <Plus size={15} /> Adicionar
          </button>
        </form>
      </section>

      <section className="broadcast-card">
        <h2>Meus campeonatos</h2>
        {loading ? <p style={{ margin: 0, color: 'var(--muted)' }}>Carregando…</p> : null}
        {!loading && !links.length ? (
          <p style={{ margin: 0, color: 'var(--muted)' }}>Nenhum campeonato ainda. Peça a chave à produtora.</p>
        ) : null}
        <ul className="broadcast-list">
          {links.map((link) => (
            <li key={link.id}>
              <div>
                <strong>{link.display_name}</strong>
                <small>{link.campeonato?.nome || link.campeonato_id}</small>
              </div>
              <div className="broadcast-row">
                <button
                  type="button"
                  className="stream-primary-btn"
                  disabled={busy}
                  onClick={() => void createLive(link.campeonato_id, link.display_name)}
                >
                  <Radio size={14} /> Abrir live
                </button>
                <button type="button" className="stream-secondary-btn" title="Remover" onClick={() => void removeLink(link.id)}>
                  <Trash2 size={14} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="broadcast-card">
        <h2>Lives ativas</h2>
        {!sessions.length ? (
          <p style={{ margin: 0, color: 'var(--muted)' }}>Nenhuma live. Use “Abrir live” em um campeonato.</p>
        ) : null}
        <ul className="broadcast-list">
          {sessions.map((s) => {
            const controlUrl = `${origin}/broadcast/control/${s.controller_token}`
            const obsUrl = `${origin}/broadcast/obs/${s.obs_token}`
            const champLabel = links.find((l) => l.campeonato_id === s.campeonato_id)?.display_name || s.nome
            return (
              <li key={s.id} style={{ gridTemplateColumns: '1fr' }}>
                <div className="broadcast-row" style={{ justifyContent: 'space-between' }}>
                  <div>
                    <strong>{s.nome}</strong>
                    <small>{champLabel}</small>
                  </div>
                  <a className="stream-secondary-btn" href={controlUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink size={14} /> Controlador
                  </a>
                </div>
                <div className="broadcast-row">
                  <button type="button" className="stream-secondary-btn" onClick={() => copy(controlUrl, 'Link do controlador copiado.')}>
                    <Copy size={14} /> Controlador
                  </button>
                  <button type="button" className="stream-secondary-btn" onClick={() => copy(obsUrl, 'Link OBS copiado.')}>
                    <Copy size={14} /> Overlay OBS
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}
