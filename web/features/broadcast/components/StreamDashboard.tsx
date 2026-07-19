'use client'

import { useCallback, useEffect, useState } from 'react'
import { Copy, ExternalLink, Plus, Trash2, MonitorPlay } from 'lucide-react'
import { supabase } from '@/lib/supabase-browser'
import '../broadcast.css'
import '@/features/campeonatos/stream/stream.css'

type LinkRow = {
  id: string
  campeonato_id: string
  display_name: string
  scenes_count?: number | null
  campeonato?: { id: string; nome: string; logo_url?: string } | null
}

type Desk = {
  id: string
  campeonato_id?: string | null
  nome: string
  controller_token: string
  obs_token: string
  active_overlay_id?: string | null
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
  const [desk, setDesk] = useState<Desk | null>(null)
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
      setDesk(me.desk || me.sessions?.[0] || null)
      setMissingTable(false)
    } catch (e: any) {
      const msg = String(e?.message || '')
      if (msg.includes('SQL') || msg.includes('broadcasts') || msg.includes('broadcast')) {
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

  function copy(text: string, okMsg: string) {
    void navigator.clipboard.writeText(text).then(
      () => setFeedback(okMsg),
      () => setFeedback(text),
    )
  }

  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const controlUrl = desk ? `${origin}/broadcast/control/${desk.controller_token}` : ''
  const obsUrl = desk ? `${origin}/broadcast/obs/${desk.obs_token}` : ''
  const activeLive = desk?.campeonato_id
    ? links.find((l) => l.campeonato_id === desk.campeonato_id)
    : null

  return (
    <div className="broadcast-page">
      <header>
        <p className="eyebrow" style={{ margin: 0, color: 'var(--brand)', fontSize: 10, fontWeight: 900, letterSpacing: '0.12em' }}>
          BROADCAST · STREAM
        </p>
        <h1>{props.profileName || 'Painel Stream'}</h1>
        <p style={{ margin: 0, color: 'var(--muted)', maxWidth: '60ch' }}>
          Seus links de <strong>Controlador</strong> e <strong>OBS</strong> são únicos e fixos. Monte a lista de
          campeonatos; na mesa você troca a live e as cenas configuradas por cada adm.
        </p>
      </header>

      {missingTable ? (
        <div className="broadcast-card" style={{ borderColor: 'var(--danger, #c44)' }}>
          <p style={{ margin: 0 }}>
            Rode no Supabase:{' '}
            <code>database/migrations/20260718_broadcast_stream.sql</code> e{' '}
            <code>20260719_broadcast_desk_e_pack.sql</code>
          </p>
        </div>
      ) : null}

      {feedback ? <p style={{ margin: 0, color: 'var(--muted)', fontSize: '0.9rem' }}>{feedback}</p> : null}

      {/* Mesa única */}
      <section className="broadcast-card">
        <h2>Minha mesa · OBS</h2>
        <p style={{ margin: 0, color: 'var(--muted)', fontSize: '0.88rem' }}>
          Configure uma vez no OBS. Ao terminar a Copa e ir para a Liga, só troca a live no controlador — o link
          do Browser Source continua o mesmo.
        </p>
        {loading && !desk ? <p style={{ margin: 0, color: 'var(--muted)' }}>Preparando mesa…</p> : null}
        {desk ? (
          <>
            <div className="broadcast-desk-urls">
              <div className="broadcast-desk-url">
                <span>Controlador</span>
                <code>{controlUrl}</code>
                <div className="broadcast-row">
                  <button type="button" className="stream-secondary-btn" onClick={() => copy(controlUrl, 'Link do controlador copiado.')}>
                    <Copy size={14} /> Copiar
                  </button>
                  <a className="stream-primary-btn" href={controlUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink size={14} /> Abrir
                  </a>
                </div>
              </div>
              <div className="broadcast-desk-url">
                <span>Overlay OBS (Browser Source)</span>
                <code>{obsUrl}</code>
                <div className="broadcast-row">
                  <button type="button" className="stream-secondary-btn" onClick={() => copy(obsUrl, 'Link OBS copiado.')}>
                    <Copy size={14} /> Copiar
                  </button>
                  <a className="stream-secondary-btn" href={obsUrl} target="_blank" rel="noopener noreferrer">
                    <MonitorPlay size={14} /> Preview
                  </a>
                </div>
              </div>
            </div>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--muted)' }}>
              Live atual no controlador:{' '}
              <strong style={{ color: 'var(--text)' }}>
                {activeLive?.display_name || activeLive?.campeonato?.nome || 'nenhuma selecionada'}
              </strong>
            </p>
          </>
        ) : null}
      </section>

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
              placeholder="Ex.: Copa Aloe · Liga Aloe · RW Cup"
              required
            />
          </label>
          <button type="submit" className="stream-primary-btn" disabled={busy} style={{ alignSelf: 'end', minHeight: 36 }}>
            <Plus size={15} /> Adicionar
          </button>
        </form>
      </section>

      <section className="broadcast-card">
        <h2>Minhas lives (campeonatos)</h2>
        <p style={{ margin: 0, color: 'var(--muted)', fontSize: '0.88rem' }}>
          No controlador você escolhe qual live está no ar. As cenas de cada uma vêm da aba Stream do campeonato
          (o que o admin configurou).
        </p>
        {loading ? <p style={{ margin: 0, color: 'var(--muted)' }}>Carregando…</p> : null}
        {!loading && !links.length ? (
          <p style={{ margin: 0, color: 'var(--muted)' }}>Nenhum campeonato ainda. Peça a chave à produtora.</p>
        ) : null}
        <ul className="broadcast-list">
          {links.map((link) => {
            const isActive = desk?.campeonato_id === link.campeonato_id
            return (
              <li key={link.id}>
                <div>
                  <strong>
                    {link.display_name}
                    {isActive ? ' · no ar' : ''}
                  </strong>
                  <small>
                    {link.campeonato?.nome || link.campeonato_id}
                    {typeof link.scenes_count === 'number'
                      ? ` · ${link.scenes_count} cena${link.scenes_count === 1 ? '' : 's'} no pack`
                      : ' · pack ainda não configurado (mostra todas as overlays)'}
                  </small>
                </div>
                <div className="broadcast-row">
                  <button type="button" className="stream-secondary-btn" title="Remover" onClick={() => void removeLink(link.id)}>
                    <Trash2 size={14} />
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
