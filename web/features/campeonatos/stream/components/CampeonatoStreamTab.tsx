'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronUp, Copy, ExternalLink, KeyRound, Pencil, Plus, RefreshCw, Save, Trash2 } from 'lucide-react'
import { StreamSpreadsheetPanel } from './StreamSpreadsheetPanel'
import {
  deleteOverlayRemote,
  listOverlays,
} from '../services/stream-data.service'
import { TEMPLATE_LABEL } from '../templates/stream-templates'
import type { StreamOverlay } from '../types/stream.types'
import { supabase } from '@/lib/supabase-browser'
import { uploadPublicMedia } from '@/lib/upload-public'
import '../stream.css'
import '@/features/broadcast/broadcast.css'

async function fileToPngFile(file: File): Promise<File> {
  if (/image\/png/i.test(file.type)) return file
  const bitmap = await createImageBitmap(file)
  const canvas = document.createElement('canvas')
  canvas.width = bitmap.width
  canvas.height = bitmap.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas indisponível.')
  ctx.drawImage(bitmap, 0, 0)
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
  if (!blob) throw new Error('Falha ao converter PNG.')
  return new File([blob], (file.name || 'fundo').replace(/\.\w+$/, '') + '.png', { type: 'image/png' })
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
  if (!res.ok) throw new Error(payload.error || 'Falha')
  return payload
}

function openInNewTab(path: string) {
  window.open(path, '_blank', 'noopener,noreferrer')
}

/**
 * Aba Stream do campeonato:
 * · overlays (editor)
 * · composição da live (quais cenas o Stream vê + BG)
 * · chave Stream
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
  const [missingPackSql, setMissingPackSql] = useState(false)

  // pack / composição
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [bgType, setBgType] = useState<'none' | 'image' | 'video'>('none')
  const [bgUrl, setBgUrl] = useState('')
  const [packBusy, setPackBusy] = useState(false)
  const [packDirty, setPackDirty] = useState(false)
  const [bgUploading, setBgUploading] = useState(false)

  const overlayById = useMemo(() => {
    const m = new Map<string, StreamOverlay>()
    for (const o of overlays) m.set(o.id, o)
    return m
  }, [overlays])

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

  const reloadPack = useCallback(async () => {
    try {
      const res = await authFetch(`/api/campeonatos/${props.campeonatoId}/stream/pack`)
      setSelectedIds(Array.isArray(res.pack?.selected_overlay_ids) ? res.pack.selected_overlay_ids : [])
      setBgType((res.pack?.bg_type as any) || 'none')
      setBgUrl(res.pack?.bg_url || '')
      setPackDirty(false)
      setMissingPackSql(false)
    } catch (e: any) {
      const msg = String(e?.message || '')
      if (msg.includes('20260719') || msg.includes('pack') || msg.includes('SQL')) {
        setMissingPackSql(true)
      }
    }
  }, [props.campeonatoId])

  useEffect(() => {
    void reloadOverlays()
    void reloadKey()
    void reloadPack()
    const onFocus = () => {
      void reloadOverlays()
      void reloadKey()
      void reloadPack()
    }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [reloadOverlays, reloadKey, reloadPack])

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
    setSelectedIds((prev) => prev.filter((x) => x !== id))
    setPackDirty(true)
    await reloadOverlays()
  }

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id)
      return [...prev, id]
    })
    setPackDirty(true)
  }

  function moveSelected(id: string, dir: -1 | 1) {
    setSelectedIds((prev) => {
      const i = prev.indexOf(id)
      if (i < 0) return prev
      const j = i + dir
      if (j < 0 || j >= prev.length) return prev
      const next = [...prev]
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })
    setPackDirty(true)
  }

  async function savePack(next?: {
    selected_overlay_ids?: string[]
    bg_type?: 'none' | 'image' | 'video'
    bg_url?: string | null
  }) {
    setPackBusy(true)
    setFeedback('')
    try {
      const body = {
        selected_overlay_ids: next?.selected_overlay_ids ?? selectedIds,
        bg_type: next?.bg_type ?? bgType,
        bg_url:
          (next?.bg_type ?? bgType) === 'none'
            ? null
            : (next?.bg_url !== undefined ? next.bg_url : bgUrl.trim() || null),
      }
      await authFetch(`/api/campeonatos/${props.campeonatoId}/stream/pack`, {
        method: 'PUT',
        body: JSON.stringify(body),
      })
      setPackDirty(false)
      setMissingPackSql(false)
      setFeedback(
        (body.selected_overlay_ids?.length || 0)
          ? `Composição salva: ${body.selected_overlay_ids.length} cena(s) no controlador do Stream.`
          : 'Composição salva: nenhuma cena (Stream verá lista vazia até marcar overlays).',
      )
    } catch (e: any) {
      setFeedback(e?.message || 'Erro ao salvar composição')
      if (String(e?.message || '').includes('SQL') || String(e?.message || '').includes('20260719')) {
        setMissingPackSql(true)
      }
    } finally {
      setPackBusy(false)
    }
  }

  async function onPickBg(file: File | null) {
    if (!file) return
    setBgUploading(true)
    setFeedback('')
    try {
      const name = String(file.name || '').toLowerCase()
      const isVideo =
        /^video\//i.test(file.type)
        || /\.(mp4|webm|mov)$/i.test(name)

      let uploadedUrl = ''
      let nextType: 'image' | 'video' = 'image'

      if (isVideo) {
        if (!/\.(mp4|webm|mov)$/i.test(name) && !/mp4|webm|quicktime/i.test(file.type)) {
          throw new Error('Use vídeo MP4 ou WebM (até 40 MB).')
        }
        if (file.size > 40 * 1024 * 1024) {
          throw new Error('Vídeo muito pesado. Limite: 40 MB.')
        }
        // upload assinado direto no Storage (vídeo não passa pelo body da API)
        const res = await uploadPublicMedia(file, 'campeonato', 'produtora')
        uploadedUrl = res.url
        nextType = 'video'
      } else {
        if (file.size > 8 * 1024 * 1024) {
          throw new Error('Imagem muito pesada. Use até ~5–8 MB.')
        }
        const png = await fileToPngFile(file)
        const res = await uploadPublicMedia(png, 'campeonato', 'produtora')
        uploadedUrl = res.url
        nextType = 'image'
      }

      if (!uploadedUrl) throw new Error('Upload concluído sem URL pública.')

      setBgType(nextType)
      setBgUrl(uploadedUrl)
      setPackDirty(true)
      await savePack({
        selected_overlay_ids: selectedIds,
        bg_type: nextType,
        bg_url: uploadedUrl,
      })
      setFeedback(
        nextType === 'video'
          ? 'Vídeo de fundo enviado e salvo na live (aparece no preview e no OBS).'
          : 'Imagem de fundo enviada e salva na live (aparece no preview e no OBS).',
      )
    } catch (e: any) {
      setFeedback(e?.message || 'Falha no upload do fundo.')
    } finally {
      setBgUploading(false)
    }
  }

  function clearBg() {
    setBgType('none')
    setBgUrl('')
    setPackDirty(true)
    void savePack({ selected_overlay_ids: selectedIds, bg_type: 'none', bg_url: null })
  }

  const orderedSelected = selectedIds
    .map((id) => overlayById.get(id))
    .filter(Boolean) as StreamOverlay[]

  const unselected = overlays.filter((o) => !selectedIds.includes(o.id))

  return (
    <div className="stream-tab">
      <header className="stream-tab-head">
        <div>
          <p className="eyebrow">Produção · transmissão</p>
          <h3>Stream</h3>
          <p>
            Crie overlays no editor, monte a <strong>composição da live</strong> (quais cenas o Stream usa) e envie a
            chave para o perfil Broadcast operar no OBS com um único link.
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
      {missingPackSql ? (
        <div className="stream-error">
          Para composição da live, rode:{' '}
          <code>database/migrations/20260719_broadcast_desk_e_pack.sql</code>
          {' '}(também em Downloads do PC).
        </div>
      ) : null}

      {/* Composição da live */}
      <section className="stream-panel" aria-label="Composição da live">
        <div className="stream-panel-title">
          <div>
            <h4>Composição da live</h4>
            <p className="stream-hint">
              Marque as overlays que o Stream verá como botões no controlador (ex.: 10 criadas, só 5 na live).
              Ordene com as setas. Fundo PNG/vídeo é para você pré-visualizar o encaixe.
            </p>
          </div>
          <div className="stream-panel-actions">
            <button
              type="button"
              className="stream-primary-btn"
              disabled={packBusy || !packDirty}
              onClick={() => void savePack()}
            >
              <Save size={15} /> {packBusy ? 'Salvando…' : packDirty ? 'Salvar composição' : 'Salvo'}
            </button>
          </div>
        </div>

        <div className="broadcast-row" style={{ alignItems: 'start' }}>
          <div style={{ flex: '1 1 280px', display: 'grid', gap: 10 }}>
            <p className="stream-hint" style={{ margin: 0 }}>
              Na live ({selectedIds.length} selecionada{selectedIds.length === 1 ? '' : 's'})
            </p>
            {!orderedSelected.length ? (
              <p className="stream-hint">Nenhuma cena marcada. Clique nas overlays abaixo para adicionar.</p>
            ) : (
              <ul className="stream-pack-list">
                {orderedSelected.map((ov, index) => (
                  <li key={ov.id} className="stream-pack-item is-on">
                    <input
                      type="checkbox"
                      checked
                      onChange={() => toggleSelected(ov.id)}
                      aria-label={`Remover ${ov.name}`}
                    />
                    <label>
                      <strong>
                        {index + 1}. {ov.name}
                      </strong>
                      <small>{TEMPLATE_LABEL[ov.template] || ov.template}</small>
                    </label>
                    <div className="stream-pack-order">
                      <button
                        type="button"
                        className="stream-secondary-btn"
                        disabled={index === 0}
                        title="Subir"
                        onClick={() => moveSelected(ov.id, -1)}
                      >
                        <ChevronUp size={14} />
                      </button>
                      <button
                        type="button"
                        className="stream-secondary-btn"
                        disabled={index === orderedSelected.length - 1}
                        title="Descer"
                        onClick={() => moveSelected(ov.id, 1)}
                      >
                        <ChevronDown size={14} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {unselected.length ? (
              <>
                <p className="stream-hint" style={{ margin: '8px 0 0' }}>
                  Disponíveis no editor (não vão pro controlador até marcar)
                </p>
                <ul className="stream-pack-list">
                  {unselected.map((ov) => (
                    <li key={ov.id} className="stream-pack-item">
                      <input
                        type="checkbox"
                        checked={false}
                        onChange={() => toggleSelected(ov.id)}
                        aria-label={`Incluir ${ov.name}`}
                      />
                      <label onClick={() => toggleSelected(ov.id)}>
                        <strong>{ov.name}</strong>
                        <small>{TEMPLATE_LABEL[ov.template] || ov.template}</small>
                      </label>
                      <span />
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </div>

          <div style={{ flex: '1 1 260px', display: 'grid', gap: 10 }}>
            <label className="broadcast-field">
              <span>Fundo de pré-visualização (upload)</span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/jpg,video/mp4,video/webm"
                disabled={bgUploading || packBusy}
                onChange={(e) => {
                  const f = e.target.files?.[0] || null
                  e.target.value = ''
                  void onPickBg(f)
                }}
              />
            </label>
            <div className="broadcast-row">
              {bgUrl ? (
                <button type="button" className="stream-secondary-btn" disabled={bgUploading} onClick={clearBg}>
                  Remover fundo
                </button>
              ) : null}
              {bgUploading ? <span className="stream-hint">Enviando fundo…</span> : null}
            </div>

            <div className="stream-pack-preview" aria-label="Pré-visualização do fundo">
              {bgType === 'image' && bgUrl.trim() ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={bgUrl} src={bgUrl.trim()} alt="Fundo" />
              ) : null}
              {bgType === 'video' && bgUrl.trim() ? (
                <video
                  key={bgUrl}
                  src={bgUrl.trim()}
                  autoPlay
                  muted
                  loop
                  playsInline
                  controls={false}
                  onError={() => setFeedback('Não foi possível reproduzir o vídeo no preview. Confira se o arquivo é MP4/WebM e se o upload concluiu.')}
                />
              ) : null}
              {(bgType === 'none' || !bgUrl.trim()) ? (
                <div className="stream-pack-preview-empty">
                  Sem fundo. Envie PNG/JPG ou vídeo MP4/WebM — ele aparece no preview e no OBS da live.
                </div>
              ) : null}
              <span className="stream-pack-preview-badge">
                {selectedIds.length} cena{selectedIds.length === 1 ? '' : 's'} · 16:9
                {bgType !== 'none' && bgUrl ? ` · ${bgType}` : ''}
              </span>
            </div>
            <p className="stream-hint" style={{ margin: 0 }}>
              Este fundo vai para o <strong>OBS do Stream</strong> (atrás das overlays), não só no preview.
              Imagem até ~5 MB · vídeo até 40 MB (upload direto).
            </p>
          </div>
        </div>
      </section>

      {/* Acesso Stream */}
      <section className="stream-panel" aria-label="Chave Stream">
        <div className="stream-panel-title">
          <div>
            <h4>Acesso Stream</h4>
            <p className="stream-hint">
              Gere uma chave e envie ao perfil <strong>Broadcast → Stream</strong>. Ele adiciona o campeonato na
              lista; o controlador e o link OBS são únicos dele e servem para todos os campeonatos.
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

      {/* Overlays / editor */}
      <section className="stream-panel" aria-label="Overlays do campeonato">
        <div className="stream-panel-title">
          <div>
            <h4>Overlays · editor</h4>
            <p className="stream-hint">
              Crie e edite no workspace. Depois marque na composição quais entram na live do Stream.
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
                  <th>Na live</th>
                  <th>Blocos</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {overlays.map((ov) => {
                  const onLive = selectedIds.includes(ov.id)
                  return (
                    <tr key={ov.id}>
                      <td>
                        <strong>{ov.name}</strong>
                      </td>
                      <td>{TEMPLATE_LABEL[ov.template] || ov.template}</td>
                      <td>
                        <button
                          type="button"
                          className={onLive ? 'stream-primary-btn' : 'stream-secondary-btn'}
                          onClick={() => toggleSelected(ov.id)}
                          title={onLive ? 'Remover da composição' : 'Incluir na composição'}
                        >
                          {onLive ? 'Sim' : 'Não'}
                        </button>
                      </td>
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
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </div>
  )
}
