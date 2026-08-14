'use client'

import { useEffect, useState } from 'react'
import { Copy, ExternalLink, KeyRound, RefreshCw } from 'lucide-react'
import { StreamSpreadsheetPanel } from './StreamSpreadsheetPanel'
import { supabase } from '@/lib/supabase-browser'
import '../stream.css'

async function authenticatedFetch(url: string, init?: RequestInit) {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('Entre novamente para usar a chave Stream.')
  const response = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...(init?.headers || {}) },
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error || 'Não foi possível acessar a chave Stream.')
  return payload
}

export function CampeonatoStreamTab(props: { campeonatoId: string }) {
  const [keyToken, setKeyToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [feedback, setFeedback] = useState('')

  async function loadKey() {
    setLoading(true)
    try {
      const data = await authenticatedFetch(`/api/campeonatos/${props.campeonatoId}/stream/key`)
      setKeyToken(data.key?.key_token || null)
    } catch (error: any) {
      setFeedback(error?.message || 'Não foi possível carregar a chave.')
    } finally { setLoading(false) }
  }

  useEffect(() => { void loadKey() }, [props.campeonatoId])

  async function createOrRenew() {
    setLoading(true); setFeedback('')
    try {
      const data = await authenticatedFetch(`/api/campeonatos/${props.campeonatoId}/stream/key`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ regenerate: Boolean(keyToken) }),
      })
      setKeyToken(data.key?.key_token || null)
      setFeedback(keyToken ? 'Chave renovada.' : 'Chave Stream criada.')
    } catch (error: any) { setFeedback(error?.message || 'Não foi possível gerar a chave.') }
    finally { setLoading(false) }
  }

  async function copyKey() {
    if (!keyToken) return
    await navigator.clipboard.writeText(keyToken)
    setFeedback('Chave copiada.')
  }

  return (
    <div className="stream-tab">
      <header className="stream-tab-head">
        <div><p className="eyebrow">Transmissão</p><h3>Chave Stream</h3><p>Use esta chave para vincular uma transmissão ao campeonato. O editor de artes e overlays permanece no app local.</p></div>
        <div className="stream-panel-actions"><StreamSpreadsheetPanel campeonatoId={props.campeonatoId} asModal showTrigger triggerLabel="Dados" /><a className="stream-primary-btn" href={`/campeonatos/${props.campeonatoId}/stream`} target="_blank" rel="noopener noreferrer"><ExternalLink size={15} /> App local</a></div>
      </header>
      <section className="stream-panel"><div className="stream-panel-title"><div><h4><KeyRound size={17} /> Chave do campeonato</h4><p className="stream-hint">Somente dono e equipe autorizada podem criar ou renovar esta chave.</p></div><button type="button" className="stream-primary-btn" disabled={loading} onClick={() => void createOrRenew()}><RefreshCw size={15} /> {keyToken ? 'Renovar' : 'Gerar chave'}</button></div>{keyToken ? <div className="broadcast-row"><code style={{ flex: 1, overflowWrap: 'anywhere' }}>{keyToken}</code><button type="button" className="stream-secondary-btn" onClick={() => void copyKey()}><Copy size={15} /> Copiar</button></div> : <p className="stream-hint">{loading ? 'Carregando…' : 'Nenhuma chave ativa.'}</p>}{feedback ? <p className="stream-hint">{feedback}</p> : null}</section>
    </div>
  )
}
