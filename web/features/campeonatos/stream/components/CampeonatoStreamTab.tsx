'use client'

import { useCallback, useEffect, useState } from 'react'
import { ExternalLink, KeyRound, Pencil, RefreshCw, Save, Trash2 } from 'lucide-react'
import { StreamSpreadsheetPanel } from './StreamSpreadsheetPanel'
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

export function CampeonatoStreamTab(props: { campeonatoId: string }) {
  const workspaceUrl = `/campeonatos/${props.campeonatoId}/stream`
  const [sheetOpen, setSheetOpen] = useState(false)
  const [keyToken, setKeyToken] = useState<string | null>(null)
  const [keyLabel, setKeyLabel] = useState('Chave Stream')
  const [editingKeyLabel, setEditingKeyLabel] = useState(false)
  const [keyLoading, setKeyLoading] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [missingBroadcastSql, setMissingBroadcastSql] = useState(false)
  const [missingPackSql, setMissingPackSql] = useState(false)

  const [bgType, setBgType] = useState<'none' | 'image' | 'video'>('none')
  const [bgUrl, setBgUrl] = useState('')
  const [activeJogoId, setActiveJogoId] = useState('')
  const [jogos, setJogos] = useState<Array<{
    id: string
    nome: string
    status?: string
    data_jogo?: string | null
    horario?: string | null
    numero_partidas?: number
  }>>([])
  const [packBusy, setPackBusy] = useState(false)
  const [packDirty, setPackDirty] = useState(false)
  const [bgUploading, setBgUploading] = useState(false)

  const reloadKey = useCallback(async () => {
    try {
      const res = await authFetch(`/api/campeonatos/${props.campeonatoId}/stream/key`)
      setKeyToken(res.key?.key_token || null)
      setKeyLabel(res.key?.label || 'Chave Stream')
      setEditingKeyLabel(false)
      setMissingBroadcastSql(false)
    } catch (error: any) {
      const message = String(error?.message || '')
      if (message.includes('broadcast') || message.includes('SQL')) setMissingBroadcastSql(true)
    }
  }, [props.campeonatoId])

  const reloadPack = useCallback(async () => {
    try {
      const res = await authFetch(`/api/campeonatos/${props.campeonatoId}/stream/pack`)
      setBgType((res.pack?.bg_type as 'none' | 'image' | 'video') || 'none')
      setBgUrl(res.pack?.bg_url || '')
      setActiveJogoId(res.pack?.active_jogo_id ? String(res.pack.active_jogo_id) : '')
      setJogos(Array.isArray(res.jogos) ? res.jogos : [])
      setPackDirty(false)
      setMissingPackSql(Boolean(res.needs_package_sql))
    } catch (error: any) {
      const message = String(error?.message || '')
      if (message.includes('pack') || message.includes('SQL') || message.includes('20260810')) {
        setMissingPackSql(true)
      }
    }
  }, [props.campeonatoId])

  useEffect(() => {
    void reloadKey()
    void reloadPack()
    const onFocus = () => {
      void reloadKey()
      void reloadPack()
    }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [reloadKey, reloadPack])

  async function ensureKey(regenerate = false) {
    setKeyLoading(true)
    setFeedback('')
    try {
      const res = await authFetch(`/api/campeonatos/${props.campeonatoId}/stream/key`, {
        method: 'POST',
        body: JSON.stringify({ regenerate }),
      })
      setKeyToken(res.key?.key_token || null)
      setKeyLabel(res.key?.label || 'Chave Stream')
      setEditingKeyLabel(false)
      setFeedback(regenerate ? 'Nova chave gerada. Streams já vinculados permanecem.' : 'Chave pronta para copiar.')
      setMissingBroadcastSql(false)
    } catch (error: any) {
      setFeedback(error?.message || 'Erro ao gerar chave')
      if (String(error?.message || '').includes('SQL')) setMissingBroadcastSql(true)
    } finally {
      setKeyLoading(false)
    }
  }

  async function saveKeyLabel() {
    const label = keyLabel.trim()
    if (!label) {
      setFeedback('Informe um nome para a chave.')
      return
    }
    setKeyLoading(true)
    setFeedback('')
    try {
      const res = await authFetch(`/api/campeonatos/${props.campeonatoId}/stream/key`, {
        method: 'PATCH',
        body: JSON.stringify({ label }),
      })
      setKeyLabel(res.key?.label || label)
      setEditingKeyLabel(false)
      setFeedback('Nome da chave atualizado.')
    } catch (error: any) {
      setFeedback(error?.message || 'Erro ao atualizar a chave')
    } finally {
      setKeyLoading(false)
    }
  }

  async function revokeKey() {
    if (!keyToken) return
    if (!window.confirm('Revogar esta chave? Ela deixará de aceitar novos vínculos de Broadcast.')) return
    setKeyLoading(true)
    setFeedback('')
    try {
      await authFetch(`/api/campeonatos/${props.campeonatoId}/stream/key`, { method: 'DELETE' })
      setKeyToken(null)
      setKeyLabel('Chave Stream')
      setEditingKeyLabel(false)
      setFeedback('Chave revogada. Gere uma nova quando precisar.')
    } catch (error: any) {
      setFeedback(error?.message || 'Erro ao revogar a chave')
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

  async function saveRuntime(next?: {
    bg_type?: 'none' | 'image' | 'video'
    bg_url?: string | null
    active_jogo_id?: string | null
  }) {
    setPackBusy(true)
    setFeedback('')
    try {
      const nextBgType = next?.bg_type ?? bgType
      const jogoVal = Object.prototype.hasOwnProperty.call(next || {}, 'active_jogo_id')
        ? next?.active_jogo_id ?? null
        : activeJogoId || null
      await authFetch(`/api/campeonatos/${props.campeonatoId}/stream/pack`, {
        method: 'PUT',
        body: JSON.stringify({
          bg_type: nextBgType,
          bg_url: nextBgType === 'none' ? null : (next?.bg_url !== undefined ? next.bg_url : bgUrl.trim() || null),
          active_jogo_id: jogoVal,
        }),
      })
      setPackDirty(false)
      setMissingPackSql(false)
      setFeedback('Configuração da transmissão salva.')
    } catch (error: any) {
      setFeedback(error?.message || 'Erro ao salvar configuração da transmissão.')
      if (String(error?.message || '').includes('SQL')) setMissingPackSql(true)
    } finally {
      setPackBusy(false)
    }
  }

  async function onPickBg(file: File | null) {
    if (!file) return
    setBgUploading(true)
    setFeedback('')
    try {
      let uploadedUrl = ''
      let nextType: 'image' | 'video' = 'image'
      const name = file.name || ''
      if (/^video\//i.test(file.type) || /\.(mp4|webm|mov)$/i.test(name)) {
        if (!/\.(mp4|webm|mov)$/i.test(name) && !/mp4|webm|quicktime/i.test(file.type)) {
          throw new Error('Use vídeo MP4 ou WebM (até 40 MB).')
        }
        if (file.size > 40 * 1024 * 1024) throw new Error('Vídeo muito pesado. Limite: 40 MB.')
        const res = await uploadPublicMedia(file, 'campeonato', 'produtora')
        uploadedUrl = res.url
        nextType = 'video'
      } else {
        if (file.size > 8 * 1024 * 1024) throw new Error('Imagem muito pesada. Use até ~5–8 MB.')
        const png = await fileToPngFile(file)
        const res = await uploadPublicMedia(png, 'campeonato', 'produtora')
        uploadedUrl = res.url
      }
      if (!uploadedUrl) throw new Error('Upload concluído sem URL pública.')
      setBgType(nextType)
      setBgUrl(uploadedUrl)
      setPackDirty(true)
      await saveRuntime({ bg_type: nextType, bg_url: uploadedUrl })
    } catch (error: any) {
      setFeedback(error?.message || 'Falha no upload do fundo.')
    } finally {
      setBgUploading(false)
    }
  }

  function clearBg() {
    setBgType('none')
    setBgUrl('')
    setPackDirty(true)
    void saveRuntime({ bg_type: 'none', bg_url: null })
  }

  return (
    <div className="stream-tab">
      <header className="stream-tab-head">
        <div>
          <p className="eyebrow">Produção · transmissão</p>
          <h3>Stream</h3>
          <p>
            O pacote de overlays é a única origem visual da transmissão. Configure o pacote no workspace e use uma única fonte no OBS.
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
          <a className="stream-primary-btn" href={workspaceUrl} target="_blank" rel="noopener noreferrer">
            <ExternalLink size={15} /> Abrir pacote
          </a>
        </div>
      </header>

      {feedback ? <p className="stream-hint">{feedback}</p> : null}
      {missingBroadcastSql ? (
        <div className="stream-error">
          Para chaves e painel Broadcast, rode <code>database/migrations/20260718_broadcast_stream.sql</code>.
        </div>
      ) : null}
      {missingPackSql ? (
        <div className="stream-error">
          Atualize o banco com as migrations do pacote de overlays iniciadas em <code>20260810_stream_overlay_package_model.sql</code>.
        </div>
      ) : null}

      <section className="stream-panel" aria-label="Configuração da transmissão">
        <div className="stream-panel-title">
          <div>
            <h4>Transmissão</h4>
            <p className="stream-hint">
              Escolha o jogo usado pelos dados ao vivo e, se quiser, um fundo geral atrás das overlays. A seleção de cenas fica somente no editor do pacote.
            </p>
          </div>
          <button
            type="button"
            className="stream-primary-btn"
            disabled={packBusy || !packDirty}
            onClick={() => void saveRuntime()}
          >
            <Save size={15} /> {packBusy ? 'Salvando…' : packDirty ? 'Salvar transmissão' : 'Salvo'}
          </button>
        </div>

        <div className="broadcast-row" style={{ alignItems: 'start' }}>
          <label className="broadcast-field" style={{ flex: '1 1 320px' }}>
            <span>Jogo da live · fonte das estatísticas</span>
            <select
              value={activeJogoId}
              disabled={packBusy}
              onChange={(event) => {
                setActiveJogoId(event.target.value)
                setPackDirty(true)
              }}
            >
              <option value="">Automático (detectar jogo ativo)</option>
              {jogos.map((jogo) => {
                const data = jogo.data_jogo ? String(jogo.data_jogo).slice(0, 10) : ''
                const quedas = jogo.numero_partidas ? ` · ${jogo.numero_partidas} queda(s)` : ''
                const status = jogo.status ? ` · ${jogo.status}` : ''
                return (
                  <option key={jogo.id} value={jogo.id}>
                    {(jogo.nome || 'Jogo') + (data ? ` · ${data}` : '') + quedas + status}
                  </option>
                )
              })}
            </select>
          </label>

          <div style={{ flex: '1 1 300px', display: 'grid', gap: 10 }}>
            <label className="broadcast-field">
              <span>Fundo geral da transmissão</span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/jpg,video/mp4,video/webm"
                disabled={bgUploading || packBusy}
                onChange={(event) => {
                  const file = event.target.files?.[0] || null
                  event.target.value = ''
                  void onPickBg(file)
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
              {bgType === 'image' && bgUrl.trim() ? <img key={bgUrl} src={bgUrl.trim()} alt="Fundo" /> : null}
              {bgType === 'video' && bgUrl.trim() ? (
                <video key={bgUrl} src={bgUrl.trim()} autoPlay muted loop playsInline controls={false} />
              ) : null}
              {(bgType === 'none' || !bgUrl.trim()) ? (
                <div className="stream-pack-preview-empty">Sem fundo geral.</div>
              ) : null}
              <span className="stream-pack-preview-badge">16:9{bgType !== 'none' && bgUrl ? ` · ${bgType}` : ''}</span>
            </div>
          </div>
        </div>
      </section>

      <section className="stream-panel" aria-label="Chave Stream">
        <div className="stream-panel-title">
          <div>
            <h4>Acesso Stream</h4>
            <p className="stream-hint">
              Gere uma chave e envie ao perfil <strong>Broadcast → Stream</strong>. O controlador e o link OBS permanecem únicos para o perfil Broadcast.
            </p>
          </div>
        </div>
        {keyToken ? (
          <div className="stream-panel-actions" style={{ flexWrap: 'wrap', marginBottom: 8 }}>
            {editingKeyLabel ? (
              <input
                value={keyLabel}
                maxLength={80}
                autoFocus
                onChange={(event) => setKeyLabel(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') void saveKeyLabel()
                  if (event.key === 'Escape') setEditingKeyLabel(false)
                }}
                aria-label="Nome da chave Stream"
                style={{ flex: '1 1 220px', minHeight: 36 }}
              />
            ) : (
              <strong style={{ flex: '1 1 220px' }}>{keyLabel}</strong>
            )}
            <button
              type="button"
              className="stream-secondary-btn"
              disabled={keyLoading}
              onClick={() => void (editingKeyLabel ? saveKeyLabel() : setEditingKeyLabel(true))}
            >
              {editingKeyLabel ? <Save size={15} /> : <Pencil size={15} />}
              {editingKeyLabel ? 'Salvar nome' : 'Renomear'}
            </button>
          </div>
        ) : null}
        <div className="stream-panel-actions" style={{ flexWrap: 'wrap' }}>
          <code style={{ flex: '1 1 200px', minHeight: 36, display: 'flex', alignItems: 'center', padding: '0 12px', border: '1px solid var(--line)', background: 'var(--surface-soft)', fontWeight: 700, letterSpacing: '0.04em' }}>
            {keyToken || '— nenhuma chave ainda —'}
          </code>
          <button type="button" className="stream-primary-btn" disabled={keyLoading} onClick={() => void (keyToken ? copyKey() : ensureKey(false))}>
            <KeyRound size={15} /> {keyToken ? 'Copiar chave' : 'Gerar chave'}
          </button>
          {keyToken ? (
            <>
              <button type="button" className="stream-secondary-btn" disabled={keyLoading} onClick={() => void ensureKey(true)}>
                <RefreshCw size={15} /> Regenerar
              </button>
              <button type="button" className="stream-secondary-btn" disabled={keyLoading} onClick={() => void revokeKey()}>
                <Trash2 size={15} /> Revogar
              </button>
            </>
          ) : null}
        </div>
      </section>
    </div>
  )
}
