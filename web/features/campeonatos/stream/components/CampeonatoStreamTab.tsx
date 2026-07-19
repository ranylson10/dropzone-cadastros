'use client'

import { useCallback, useEffect, useState } from 'react'
import { Copy, ExternalLink, KeyRound, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { StreamSpreadsheetPanel } from './StreamSpreadsheetPanel'
import {
  deleteOverlayRemote,
  listOverlays,
} from '../services/stream-data.service'
import { TEMPLATE_LABEL } from '../templates/stream-templates'
import type { StreamOverlay } from '../types/stream.types'
import { supabase } from '@/lib/supabase-browser'
import '../stream.css'

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
  if (!res.ok) throw new Error(payload.error || 'Falha')
  return payload
}

function openInNewTab(path: string) {
  window.open(path, '_blank', 'noopener,noreferrer')
}

/**
 * Aba Stream do campeonato (etapa 2):
 * overlays, chave para Broadcast/Stream, planilha e workspace.
 */
export function CampeonatoStreamTab(props: { campeonatoId: string }) {
  const workspaceUrl = `/campeonatos/${props.campeonatoId}/stream`
  const base = workspaceUrl
  const [sheetOpen, setSheetOpen] = useState(false)
  const [overlays, setOverlays] = useState<StreamOverlay[]>([])
  const [loading, setLoading] = useState(true)
  const [keyToken, setKeyToken] = useState<string | null>(null)
  const [keyLoading, setKeyLoading] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [missingBroadcastSql, setMissingBroadcastSql] = useState(false)

  const reloadOverlays = useCallback(async () => {
    setLoading(true)
    try {
      const result = await listOverlays(props.campeonatoId)
      setOverlays(result.overlays)
    } finally {
      setLoading(false)
    }
  }, [props.campeonatoId])

  const reloadKey = useCallback(async () => {
    try {
      const res = await authFetch(`/api/campeonatos/${props.campeonatoId}/stream/key`)
      setKeyToken(res.key?.key_token || null)
      setMissingBroadcastSql(false)
    } catch (e: any) {
      if (String(e?.message || '').includes('broadcast') || String(e?.message || '').includes('SQL')) {
        setMissingBroadcastSql(true)
      }
    }
  }, [props.campeonatoId])

  useEffect(() => {
    void reloadOverlays()
    void reloadKey()
    const onFocus = () => {
      void reloadOverlays()
      void reloadKey()
    }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [reloadOverlays, reloadKey])

  async function ensureKey(regenerate = false) {
    setKeyLoading(true)
    setFeedback('')
    try {
      const res = await authFetch(`/api/campeonatos/${props.campeonatoId}/stream/key`, {
        method: 'POST',
        body: JSON.stringify({ regenerate }),
      })
      setKeyToken(res.key?.key_token || null)
      setFeedback(regenerate ? 'Nova chave gerada. Streams já vinculados permanecem.' : 'Chave pronta para copiar.')
      setMissingBroadcastSql(false)
    } catch (e: any) {
      setFeedback(e?.message || 'Erro ao gerar chave')
      if (String(e?.message || '').includes('SQL')) setMissingBroadcastSql(true)
    } finally {
      setKeyLoading(false)
    }
  }

  function copyKey() {
    if (!keyToken) {
      void ensureKey(false)
      return
    }
    void navigator.clipboard.writeText(keyToken).then(
      () => setFeedback('Chave Stream copiada. Envie ao perfil Broadcast → Stream.'),
      () => setFeedback(keyToken),
    )
  }

  async function handleDelete(id: string, name: string) {
    if (!window.confirm(`Excluir overlay "${name}"?`)) return
    await deleteOverlayRemote(props.campeonatoId, id)
    await reloadOverlays()
  }

  return (
    <div className="stream-tab">
      <header className="stream-tab-head">
        <div>
          <p className="eyebrow">Produção · transmissão</p>
          <h3>Stream</h3>
          <p>
            Crie overlays no editor, monte a cena do campeonato e envie a <strong>chave Stream</strong> para o
            perfil Broadcast operar a live no OBS.
          </p>
        </div>
        <div className="stream-panel-actions">
          <StreamSpreadsheetPanel
            campeonatoId={props.campeonatoId}
            asModal
            open={sheetOpen}
            onOpenChange={setSheetOpen}
            showTrigger
            triggerLabel="Planilha"
          />
          <a className="stream-secondary-btn" href={workspaceUrl} target="_blank" rel="noopener noreferrer">
            <ExternalLink size={15} /> Workspace
          </a>
        </div>
      </header>

      {feedback ? <p className="stream-hint">{feedback}</p> : null}
      {missingBroadcastSql ? (
        <div className="stream-error">
          Para chaves e painel Broadcast, rode:{' '}
          <code>database/migrations/20260718_broadcast_stream.sql</code>
        </div>
      ) : null}

      {/* Acesso Stream */}
      <section className="stream-panel" aria-label="Chave Stream">
        <div className="stream-panel-title">
          <div>
            <h4>Acesso Stream</h4>
            <p className="stream-hint">
              Gere uma chave e envie ao perfil <strong>Broadcast → Stream</strong>. Ele adiciona o campeonato na
              lista e gera o controlador + overlay OBS.
            </p>
          </div>
        </div>
        <div className="stream-panel-actions" style={{ flexWrap: 'wrap' }}>
          <code
            style={{
              flex: '1 1 200px',
              minHeight: 36,
              display: 'flex',
              alignItems: 'center',
              padding: '0 12px',
              border: '1px solid var(--line)',
              background: 'var(--surface-soft)',
              fontWeight: 700,
              letterSpacing: '0.04em',
            }}
          >
            {keyToken || '— nenhuma chave ainda —'}
          </code>
          <button type="button" className="stream-primary-btn" disabled={keyLoading} onClick={() => void (keyToken ? copyKey() : ensureKey(false))}>
            <KeyRound size={15} /> {keyToken ? 'Copiar chave' : 'Gerar chave'}
          </button>
          {keyToken ? (
            <button type="button" className="stream-secondary-btn" disabled={keyLoading} onClick={() => void ensureKey(true)}>
              <RefreshCw size={15} /> Regenerar
            </button>
          ) : null}
        </div>
      </section>

      {/* Overlays / cenas */}
      <section className="stream-panel" aria-label="Overlays do campeonato">
        <div className="stream-panel-title">
          <div>
            <h4>Overlays · composição</h4>
            <p className="stream-hint">
              Todas as overlays ativas ficam disponíveis no controlador do Stream. Use o editor para criar e
              ajustar.
            </p>
          </div>
          <div className="stream-panel-actions">
            <button
              type="button"
              className="stream-primary-btn"
              onClick={() => openInNewTab(`${base}/overlays/novo`)}
            >
              <Plus size={15} /> Nova overlay
            </button>
          </div>
        </div>

        {loading && !overlays.length ? <p className="stream-hint">Carregando…</p> : null}
        {!loading && !overlays.length ? (
          <div className="stream-empty-list">
            <strong>Nenhuma overlay</strong>
            <p>Crie a partir do catálogo ou em branco no workspace.</p>
          </div>
        ) : null}

        {overlays.length > 0 ? (
          <div className="stream-overlay-table-wrap">
            <table className="stream-overlay-table">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Modelo</th>
                  <th>Blocos</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {overlays.map((ov) => (
                  <tr key={ov.id}>
                    <td>
                      <strong>{ov.name}</strong>
                    </td>
                    <td>{TEMPLATE_LABEL[ov.template] || ov.template}</td>
                    <td>{ov.blocks?.length ?? 0}</td>
                    <td>
                      <div className="stream-panel-actions">
                        <button
                          type="button"
                          className="stream-secondary-btn"
                          title="Editar"
                          onClick={() => openInNewTab(`${base}/overlays/${ov.id}`)}
                        >
                          <Pencil size={14} />
                        </button>
                        {ov.share_token ? (
                          <button
                            type="button"
                            className="stream-secondary-btn"
                            title="Copiar link live direto"
                            onClick={() => {
                              const url = `${window.location.origin}/stream/live/${ov.share_token}`
                              void navigator.clipboard.writeText(url).then(() => setFeedback('Link live copiado.'))
                            }}
                          >
                            <Copy size={14} />
                          </button>
                        ) : null}
                        <button
                          type="button"
                          className="stream-secondary-btn"
                          title="Excluir"
                          onClick={() => void handleDelete(ov.id, ov.name)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </div>
  )
}
