'use client'

import { useEffect, useMemo, useState } from 'react'
import { Image as ImageIcon, Loader2, Save, Trash2, Upload, X } from 'lucide-react'
import type { CampeonatoExportPayload } from '../types/campeonato-export.types'
import { exportOverridesService } from '../services/export-overrides.service'
import {
  buildSpecLogoItems,
  buildSpecPhotoItems,
  buildSpecLogosZip,
  buildSpecPhotosZip,
  clampTransform,
  composeOnCanvas,
  DEFAULT_LOGO_MARGIN,
  DEFAULT_PHOTO_MARGIN,
  DEFAULT_TRANSFORM,
  downloadBlob,
  fileToDataUrl,
  LOGO_SIZE,
  PHOTO_H,
  PHOTO_SPEC_W,
  PHOTO_W,
  type BoxMargin,
  type ImageTransform,
  type SpecLogoItem,
  type SpecPhotoItem,
} from '../utils/spec-media'

type MediaTab = 'logos' | 'fotos'

type Props = {
  campeonatoId: string
  data: CampeonatoExportPayload
  disabled?: boolean
  /**
   * Se definido, mostra só essa mídia (sem abas internas).
   * Usado pelas notas do Download/SPEC.
   */
  focus?: MediaTab
  /** fundos/margens/logos/fotos já salvos no campeonato */
  initialBackup?: {
    logo_bg_url?: string | null
    photo_bg_url?: string | null
    logo_margin?: BoxMargin
    photo_margin?: BoxMargin
    logos?: Record<string, any>
    fotos?: Record<string, any>
  } | null
  onBackupSaved?: () => void
}

function MarginFields({
  value,
  onChange,
  disabled,
  max = 140,
}: {
  value: BoxMargin
  onChange: (next: BoxMargin) => void
  disabled?: boolean
  max?: number
}) {
  function set(side: keyof BoxMargin, n: number) {
    onChange({ ...value, [side]: Math.max(0, Math.min(max, n || 0)) })
  }
  return (
    <div className="spec-margin-grid">
      <label>
        <span>Cima</span>
        <input type="number" min={0} max={max} value={value.top} disabled={disabled} onChange={(e) => set('top', Number(e.target.value))} />
      </label>
      <label>
        <span>Baixo</span>
        <input type="number" min={0} max={max} value={value.bottom} disabled={disabled} onChange={(e) => set('bottom', Number(e.target.value))} />
      </label>
      <label>
        <span>Esquerda</span>
        <input type="number" min={0} max={max} value={value.left} disabled={disabled} onChange={(e) => set('left', Number(e.target.value))} />
      </label>
      <label>
        <span>Direita</span>
        <input type="number" min={0} max={max} value={value.right} disabled={disabled} onChange={(e) => set('right', Number(e.target.value))} />
      </label>
      <button
        type="button"
        className="button secondary small"
        disabled={disabled}
        onClick={() => {
          const v = value.top
          onChange({ top: v, bottom: v, left: v, right: v })
        }}
      >
        Igualar à cima
      </button>
    </div>
  )
}

function TransformFields({
  value,
  onChange,
  disabled,
  onApplyAll,
}: {
  value: ImageTransform
  onChange: (next: ImageTransform) => void
  disabled?: boolean
  onApplyAll?: () => void
}) {
  const zoomPct = Math.round(value.zoom * 100)

  function patch(partial: Partial<ImageTransform>) {
    onChange(clampTransform({ ...value, ...partial }))
  }

  function nudge(axis: 'offsetX' | 'offsetY', delta: number) {
    patch({ [axis]: value[axis] + delta })
  }

  return (
    <div className="spec-transform">
      <label className="spec-transform-zoom">
        <span>Zoom {zoomPct}%</span>
        <input
          type="range"
          min={20}
          max={300}
          step={1}
          value={zoomPct}
          disabled={disabled}
          onChange={(e) => patch({ zoom: Number(e.target.value) / 100 })}
        />
        <input
          type="number"
          min={20}
          max={300}
          value={zoomPct}
          disabled={disabled}
          onChange={(e) => patch({ zoom: Number(e.target.value) / 100 })}
        />
      </label>

      <div className="spec-nudge-grid">
        <span className="spec-nudge-label">Posição</span>
        <button type="button" className="button secondary small" disabled={disabled} onClick={() => nudge('offsetY', -5)} title="Cima">
          ↑
        </button>
        <div className="spec-nudge-mid">
          <button type="button" className="button secondary small" disabled={disabled} onClick={() => nudge('offsetX', -5)} title="Esquerda">
            ←
          </button>
          <button type="button" className="button secondary small" disabled={disabled} onClick={() => patch({ offsetX: 0, offsetY: 0 })} title="Centro">
            ·
          </button>
          <button type="button" className="button secondary small" disabled={disabled} onClick={() => nudge('offsetX', 5)} title="Direita">
            →
          </button>
        </div>
        <button type="button" className="button secondary small" disabled={disabled} onClick={() => nudge('offsetY', 5)} title="Baixo">
          ↓
        </button>
      </div>

      <div className="spec-margin-grid">
        <label>
          <span>Lados (X)</span>
          <input
            type="number"
            min={-400}
            max={400}
            value={value.offsetX}
            disabled={disabled}
            onChange={(e) => patch({ offsetX: Number(e.target.value) })}
          />
        </label>
        <label>
          <span>Cima/Baixo (Y)</span>
          <input
            type="number"
            min={-400}
            max={400}
            value={value.offsetY}
            disabled={disabled}
            onChange={(e) => patch({ offsetY: Number(e.target.value) })}
          />
        </label>
      </div>

      <div className="export-actions-row" style={{ gap: 6, flexWrap: 'wrap' }}>
        <button
          type="button"
          className="button secondary small"
          disabled={disabled}
          onClick={() => onChange({ ...DEFAULT_TRANSFORM })}
        >
          Reset zoom/posição
        </button>
        {onApplyAll ? (
          <button type="button" className="button secondary small" disabled={disabled} onClick={onApplyAll}>
            Aplicar a todos da lista
          </button>
        ) : null}
      </div>
    </div>
  )
}

function transformFromBackup(b: Record<string, any> | null | undefined): ImageTransform {
  if (!b) return { ...DEFAULT_TRANSFORM }
  return clampTransform({
    zoom: b.zoom ?? DEFAULT_TRANSFORM.zoom,
    offsetX: b.offset_x ?? b.offsetX ?? DEFAULT_TRANSFORM.offsetX,
    offsetY: b.offset_y ?? b.offsetY ?? DEFAULT_TRANSFORM.offsetY,
  })
}

function applyLogoBackup(items: SpecLogoItem[], logosBackup?: Record<string, any> | null): SpecLogoItem[] {
  if (!logosBackup || !Object.keys(logosBackup).length) return items
  return items.map((item) => {
    const b = logosBackup[item.key] || logosBackup[String(item.codigo)]
    if (!b) return item
    const t = transformFromBackup(b)
    return {
      ...item,
      sourceUrl: b.source_url !== undefined ? b.source_url : item.sourceUrl,
      tintColor: b.tint_color !== undefined ? b.tint_color : item.tintColor,
      zoom: t.zoom,
      offsetX: t.offsetX,
      offsetY: t.offsetY,
    }
  })
}

function applyPhotoBackup(items: SpecPhotoItem[], fotosBackup?: Record<string, any> | null): SpecPhotoItem[] {
  if (!fotosBackup || !Object.keys(fotosBackup).length) return items
  return items.map((item) => {
    const b = fotosBackup[item.idJogo] || fotosBackup[item.key]
    if (!b) return item
    const t = transformFromBackup(b)
    return {
      ...item,
      sourceUrl: b.source_url !== undefined ? b.source_url : item.sourceUrl,
      nick: b.nick || item.nick,
      zoom: t.zoom,
      offsetX: t.offsetX,
      offsetY: t.offsetY,
    }
  })
}

export function SpecMediaPanel({ data, campeonatoId, disabled, focus, initialBackup, onBackupSaved }: Props) {
  const [tab, setTab] = useState<MediaTab>(focus || 'logos')

  useEffect(() => {
    if (focus) setTab(focus)
  }, [focus])

  const [logoBg, setLogoBg] = useState<string | null>(initialBackup?.logo_bg_url || null)
  const [photoBg, setPhotoBg] = useState<string | null>(initialBackup?.photo_bg_url || null)
  const [logoMargin, setLogoMargin] = useState<BoxMargin>(initialBackup?.logo_margin || { ...DEFAULT_LOGO_MARGIN })
  const [photoMargin, setPhotoMargin] = useState<BoxMargin>(initialBackup?.photo_margin || { ...DEFAULT_PHOTO_MARGIN })

  const [logos, setLogos] = useState<SpecLogoItem[]>([])
  const [photos, setPhotos] = useState<SpecPhotoItem[]>([])
  const [logoKey, setLogoKey] = useState<string | null>(null)
  const [photoKey, setPhotoKey] = useState<string | null>(null)

  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [busy, setBusy] = useState('')
  const [progress, setProgress] = useState('')
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  // rebuild lista a partir do escopo + backup
  useEffect(() => {
    const baseLogos = applyLogoBackup(buildSpecLogoItems(data), initialBackup?.logos)
    const basePhotos = applyPhotoBackup(buildSpecPhotoItems(data), initialBackup?.fotos)
    setLogos(baseLogos)
    setPhotos(basePhotos)
    setLogoKey((k) => (k && baseLogos.some((l) => l.key === k) ? k : baseLogos[0]?.key || null))
    setPhotoKey((k) => (k && basePhotos.some((p) => p.key === k) ? k : basePhotos[0]?.key || null))
    if (initialBackup?.logo_bg_url !== undefined) setLogoBg(initialBackup.logo_bg_url || null)
    if (initialBackup?.photo_bg_url !== undefined) setPhotoBg(initialBackup.photo_bg_url || null)
    if (initialBackup?.logo_margin) setLogoMargin(initialBackup.logo_margin)
    if (initialBackup?.photo_margin) setPhotoMargin(initialBackup.photo_margin)
    setMsg('')
    setErr('')
  }, [data, initialBackup])

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
  }, [previewUrl])

  const activeLogo = useMemo(
    () => logos.find((l) => l.key === logoKey) || logos[0] || null,
    [logos, logoKey],
  )
  const activePhoto = useMemo(
    () => photos.find((p) => p.key === photoKey) || photos[0] || null,
    [photos, photoKey],
  )

  useEffect(() => {
    let cancelled = false
    async function run() {
      try {
        if (tab === 'logos') {
          const blob = await composeOnCanvas({
            width: LOGO_SIZE,
            height: LOGO_SIZE,
            sourceUrl: activeLogo?.sourceUrl || null,
            backgroundUrl: logoBg,
            margin: logoMargin,
            tintColor: activeLogo?.tintColor || null,
            zoom: activeLogo?.zoom,
            offsetX: activeLogo?.offsetX,
            offsetY: activeLogo?.offsetY,
            // sem fundo: prévia transparente (sem preto forçado)
            fallbackColor: '#000000',
          })
          if (cancelled) return
          const url = URL.createObjectURL(blob)
          setPreviewUrl((old) => {
            if (old) URL.revokeObjectURL(old)
            return url
          })
        } else {
          const blob = await composeOnCanvas({
            width: PHOTO_W,
            height: PHOTO_H,
            sourceUrl: activePhoto?.sourceUrl || null,
            backgroundUrl: photoBg,
            margin: photoMargin,
            zoom: activePhoto?.zoom,
            offsetX: activePhoto?.offsetX,
            offsetY: activePhoto?.offsetY,
            fallbackColor: '#000000',
          })
          if (cancelled) return
          const url = URL.createObjectURL(blob)
          setPreviewUrl((old) => {
            if (old) URL.revokeObjectURL(old)
            return url
          })
        }
      } catch {
        if (!cancelled) {
          setPreviewUrl((old) => {
            if (old) URL.revokeObjectURL(old)
            return null
          })
        }
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [
    tab,
    activeLogo?.key,
    activeLogo?.sourceUrl,
    activeLogo?.tintColor,
    activeLogo?.zoom,
    activeLogo?.offsetX,
    activeLogo?.offsetY,
    activePhoto?.key,
    activePhoto?.sourceUrl,
    activePhoto?.zoom,
    activePhoto?.offsetX,
    activePhoto?.offsetY,
    logoBg,
    photoBg,
    logoMargin,
    photoMargin,
  ])

  async function onBg(kind: 'logo' | 'photo', file: File | null) {
    if (!file) {
      if (kind === 'logo') setLogoBg(null)
      else setPhotoBg(null)
      return
    }
    const url = await fileToDataUrl(file)
    if (kind === 'logo') setLogoBg(url)
    else setPhotoBg(url)
  }

  async function replaceSource(kind: 'logo' | 'photo', key: string, file: File | null) {
    if (!file) return
    const url = await fileToDataUrl(file)
    if (kind === 'logo') {
      setLogos((prev) => prev.map((l) => (l.key === key ? { ...l, sourceUrl: url } : l)))
    } else {
      setPhotos((prev) => prev.map((p) => (p.key === key ? { ...p, sourceUrl: url } : p)))
    }
  }

  function removeLogoFromList(key: string) {
    setLogos((prev) => {
      const next = prev.filter((l) => l.key !== key)
      if (logoKey === key) setLogoKey(next[0]?.key || null)
      return next
    })
  }

  function removePhotoFromList(key: string) {
    setPhotos((prev) => {
      const next = prev.filter((p) => p.key !== key)
      if (photoKey === key) setPhotoKey(next[0]?.key || null)
      return next
    })
  }

  function setActiveLogoTint(tint: string | null) {
    if (!activeLogo) return
    setLogos((prev) =>
      prev.map((l) => (l.key === activeLogo.key ? { ...l, tintColor: tint } : l)),
    )
  }

  function setActiveTransform(next: ImageTransform) {
    const t = clampTransform(next)
    if (tab === 'logos' && activeLogo) {
      setLogos((prev) =>
        prev.map((l) =>
          l.key === activeLogo.key ? { ...l, zoom: t.zoom, offsetX: t.offsetX, offsetY: t.offsetY } : l,
        ),
      )
      return
    }
    if (tab === 'fotos' && activePhoto) {
      setPhotos((prev) =>
        prev.map((p) =>
          p.key === activePhoto.key ? { ...p, zoom: t.zoom, offsetX: t.offsetX, offsetY: t.offsetY } : p,
        ),
      )
    }
  }

  function applyTransformToAll(next: ImageTransform) {
    const t = clampTransform(next)
    if (tab === 'logos') {
      setLogos((prev) => prev.map((l) => ({ ...l, zoom: t.zoom, offsetX: t.offsetX, offsetY: t.offsetY })))
    } else {
      setPhotos((prev) => prev.map((p) => ({ ...p, zoom: t.zoom, offsetX: t.offsetX, offsetY: t.offsetY })))
    }
  }

  async function salvarLogosZip() {
    if (!logos.length) {
      setErr('Lista de logos vazia — remova só as que não precisa e deixe as que vai salvar.')
      return
    }
    setBusy('logos-zip')
    setErr('')
    setMsg('')
    try {
      const blob = await buildSpecLogosZip(
        logos,
        logoBg,
        logoMargin,
        (done, total) => setProgress(`Logos ${done}/${total}`),
      )
      downloadBlob(blob, 'spec-logos-slots.zip')
      setMsg(`${logos.length} logos PNG geradas (só as da lista).`)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Falha ao gerar ZIP de logos.')
    } finally {
      setBusy('')
      setProgress('')
    }
  }

  async function salvarFotosZip() {
    const list = photos.filter((p) => p.idJogo)
    if (!list.length) {
      setErr('Lista de fotos vazia.')
      return
    }
    setBusy('fotos-zip')
    setErr('')
    setMsg('')
    try {
      const blob = await buildSpecPhotosZip(
        list,
        photoBg,
        photoMargin,
        (done, total) => setProgress(`Fotos ${done}/${total}`),
      )
      downloadBlob(blob, 'spec-fotos-jogadores.zip')
      setMsg(
        `${list.length} fotos PNG · compostas em ${PHOTO_W}×${PHOTO_H}, export SPEC achatado em ${PHOTO_SPEC_W}×${PHOTO_H} (sem cortar).`,
      )
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Falha ao gerar ZIP de fotos.')
    } finally {
      setBusy('')
      setProgress('')
    }
  }

  /** Grava no banco SOMENTE os itens que estão na lista agora */
  async function salvarBackupLogos() {
    if (!logos.length) {
      setErr('Nada para backup — lista vazia.')
      return
    }
    setBusy('logos-db')
    setErr('')
    setMsg('')
    try {
      const logosMap: Record<string, unknown> = {}
      for (const l of logos) {
        logosMap[l.key] = {
          source_url: l.sourceUrl,
          tint_color: l.tintColor,
          codigo: l.codigo,
          slot_letra: l.slotLetra,
          equipe_nome: l.equipeNome,
          line_nome: l.lineNome,
          equipe_id: l.equipeId,
          zoom: l.zoom,
          offset_x: l.offsetX,
          offset_y: l.offsetY,
        }
      }
      await exportOverridesService.save(campeonatoId, {
        logos_replace: true,
        logos: logosMap,
        logo_bg_url: logoBg,
        logo_margin: logoMargin,
      })
      setMsg(`Backup: ${logos.length} logo(s) salvas neste campeonato (as removidas da lista não foram gravadas).`)
      onBackupSaved?.()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Falha ao salvar backup de logos.')
    } finally {
      setBusy('')
    }
  }

  async function salvarBackupFotos() {
    if (!photos.length) {
      setErr('Nada para backup — lista vazia.')
      return
    }
    setBusy('fotos-db')
    setErr('')
    setMsg('')
    try {
      const fotosMap: Record<string, unknown> = {}
      for (const p of photos) {
        fotosMap[p.idJogo] = {
          source_url: p.sourceUrl,
          nick: p.nick,
          equipe_nome: p.equipeNome,
          key: p.key,
          zoom: p.zoom,
          offset_x: p.offsetX,
          offset_y: p.offsetY,
        }
      }
      await exportOverridesService.save(campeonatoId, {
        fotos_replace: true,
        fotos: fotosMap,
        photo_bg_url: photoBg,
        photo_margin: photoMargin,
      })
      setMsg(`Backup: ${photos.length} foto(s) salvas neste campeonato.`)
      onBackupSaved?.()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Falha ao salvar backup de fotos.')
    } finally {
      setBusy('')
    }
  }

  const isLogo = tab === 'logos'

  return (
    <section className={`export-section export-section-compact spec-workspace-section ${focus ? 'is-focused' : ''}`}>
      {!focus ? (
        <>
          <div className="section-head">
            <h4>Estúdio SPEC · logos e fotos</h4>
            <small>remova o que não precisa · salve só o restante</small>
          </div>
          <div className="spec-tabs">
            <button type="button" className={tab === 'logos' ? 'active' : ''} onClick={() => setTab('logos')} disabled={disabled || Boolean(busy)}>
              1. Logos 300×300
            </button>
            <button type="button" className={tab === 'fotos' ? 'active' : ''} onClick={() => setTab('fotos')} disabled={disabled || Boolean(busy)}>
              2. Fotos {PHOTO_W}×{PHOTO_H} → SPEC {PHOTO_SPEC_W}×{PHOTO_H}
            </button>
          </div>
        </>
      ) : (
        <div className="section-head">
          <h4>{focus === 'logos' ? 'Logos das equipes · 300×300' : `Fotos dos jogadores · ${PHOTO_W}×${PHOTO_H}`}</h4>
          <small>
            {focus === 'logos'
              ? 'fundo, margens, zoom/posição, cor · ZIP e backup'
              : `prévia ${PHOTO_W}×${PHOTO_H} · ZIP SPEC ${PHOTO_SPEC_W}×${PHOTO_H} (achata X)`}
          </small>
        </div>
      )}

      {err ? <div className="message error">{err}</div> : null}
      {msg ? <p className="export-spec-msg">{msg}</p> : null}
      {progress ? (
        <p className="export-progress">
          <Loader2 size={13} className="spin" /> {progress}
        </p>
      ) : null}

      <div className="spec-workspace">
        <div className="spec-canvas-col">
          <div
            className={`spec-canvas-frame ${isLogo ? 'is-logo' : 'is-photo'}`}
            style={
              isLogo
                ? { aspectRatio: '1 / 1', maxWidth: 360 }
                : { aspectRatio: `${PHOTO_W} / ${PHOTO_H}`, maxWidth: 300 }
            }
          >
            {previewUrl ? (
              <img src={previewUrl} alt="Prévia composição" />
            ) : (
              <div className="spec-canvas-empty">
                <Upload size={28} />
                <p>Adicione o fundo e selecione um item</p>
                <small>
                  {isLogo
                    ? '1:1 · 300×300'
                    : `Prévia ${PHOTO_W}×${PHOTO_H} · ZIP SPEC ${PHOTO_SPEC_W}×${PHOTO_H} (achata X)`}
                </small>
              </div>
            )}
          </div>
          <div className="spec-canvas-meta">
            {isLogo && activeLogo ? (
              <span>
                Slot <strong>{activeLogo.slotLetra}</strong> · <code>{activeLogo.codigo}</code>
                {' · '}{activeLogo.equipeNome}
                {activeLogo.tintColor ? ` · cor ${activeLogo.tintColor}` : ''}
                {' · '}zoom {Math.round(activeLogo.zoom * 100)}%
                {(activeLogo.offsetX || activeLogo.offsetY)
                  ? ` · pos ${activeLogo.offsetX},${activeLogo.offsetY}`
                  : ''}
              </span>
            ) : null}
            {!isLogo && activePhoto ? (
              <span>
                <strong>{activePhoto.nick}</strong> · <code>{activePhoto.idJogo}</code>
                {' · '}zoom {Math.round(activePhoto.zoom * 100)}%
                {(activePhoto.offsetX || activePhoto.offsetY)
                  ? ` · pos ${activePhoto.offsetX},${activePhoto.offsetY}`
                  : ''}
              </span>
            ) : null}
          </div>
        </div>

        <div className="spec-tools-col">
          <div className="spec-tool-block">
            <h5>{isLogo ? 'Fundo das logos' : 'Fundo das fotos'}</h5>
            <p className="export-help">Mesmo fundo para todas as da lista.</p>
            <label className="spec-upload-btn">
              <Upload size={14} />
              {isLogo
                ? (logoBg ? 'Trocar fundo' : 'Adicionar fundo')
                : (photoBg ? 'Trocar fundo' : 'Adicionar fundo')}
              <input
                type="file"
                accept="image/*"
                hidden
                disabled={disabled || Boolean(busy)}
                onChange={(e) => void onBg(isLogo ? 'logo' : 'photo', e.target.files?.[0] || null)}
              />
            </label>
          </div>

          <div className="spec-tool-block">
            <h5>Margens (geral da aba)</h5>
            {isLogo ? (
              <MarginFields value={logoMargin} onChange={setLogoMargin} disabled={disabled || Boolean(busy)} max={120} />
            ) : (
              <MarginFields value={photoMargin} onChange={setPhotoMargin} disabled={disabled || Boolean(busy)} max={180} />
            )}
          </div>

          {(isLogo ? activeLogo : activePhoto) ? (
            <div className="spec-tool-block">
              <h5>Zoom e posição {isLogo ? 'desta logo' : 'desta foto'}</h5>
              <p className="export-help">
                Ajuste o enquadramento. Use as setas ou os valores X/Y. O backup grava junto com o item.
              </p>
              <TransformFields
                value={
                  isLogo && activeLogo
                    ? { zoom: activeLogo.zoom, offsetX: activeLogo.offsetX, offsetY: activeLogo.offsetY }
                    : activePhoto
                      ? { zoom: activePhoto.zoom, offsetX: activePhoto.offsetX, offsetY: activePhoto.offsetY }
                      : { ...DEFAULT_TRANSFORM }
                }
                onChange={setActiveTransform}
                disabled={disabled || Boolean(busy)}
                onApplyAll={() => {
                  const src = isLogo ? activeLogo : activePhoto
                  if (!src) return
                  applyTransformToAll({ zoom: src.zoom, offsetX: src.offsetX, offsetY: src.offsetY })
                  setMsg('Zoom e posição aplicados a todos da lista.')
                }}
              />
            </div>
          ) : null}

          {isLogo && activeLogo ? (
            <div className="spec-tool-block">
              <h5>Cor desta logo</h5>
              <p className="export-help">
                Só altera a logo selecionada (ex.: ALoE), não as outras.
              </p>
              <label className="spec-check">
                <input
                  type="checkbox"
                  checked={Boolean(activeLogo.tintColor)}
                  disabled={disabled || Boolean(busy)}
                  onChange={(e) => setActiveLogoTint(e.target.checked ? (activeLogo.tintColor || '#FFFFFF') : null)}
                />
                Recolorir esta logo
              </label>
              {activeLogo.tintColor ? (
                <div className="export-color-row" style={{ marginTop: 8 }}>
                  <label className="export-color-field">
                    <span>Cor viva</span>
                    <input
                      type="color"
                      value={activeLogo.tintColor}
                      disabled={disabled || Boolean(busy)}
                      onChange={(e) => setActiveLogoTint(e.target.value)}
                    />
                  </label>
                  <input
                    className="export-cell-input export-cell-input-sm"
                    value={activeLogo.tintColor}
                    disabled={disabled || Boolean(busy)}
                    onChange={(e) => setActiveLogoTint(e.target.value)}
                  />
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="export-actions-row export-actions-wrap">
            {isLogo ? (
              <>
                <button className="button small" type="button" disabled={disabled || Boolean(busy) || !logos.length} onClick={() => void salvarLogosZip()}>
                  {busy === 'logos-zip' ? <Loader2 size={14} className="spin" /> : <Save size={14} />}
                  Baixar ZIP ({logos.length})
                </button>
                <button className="button secondary small" type="button" disabled={disabled || Boolean(busy) || !logos.length} onClick={() => void salvarBackupLogos()}>
                  {busy === 'logos-db' ? <Loader2 size={14} className="spin" /> : <Save size={14} />}
                  Backup no campeonato
                </button>
              </>
            ) : (
              <>
                <button className="button small" type="button" disabled={disabled || Boolean(busy) || !photos.length} onClick={() => void salvarFotosZip()}>
                  {busy === 'fotos-zip' ? <Loader2 size={14} className="spin" /> : <ImageIcon size={14} />}
                  Baixar ZIP ({photos.length})
                </button>
                <button className="button secondary small" type="button" disabled={disabled || Boolean(busy) || !photos.length} onClick={() => void salvarBackupFotos()}>
                  {busy === 'fotos-db' ? <Loader2 size={14} className="spin" /> : <Save size={14} />}
                  Backup no campeonato
                </button>
              </>
            )}
          </div>
          <p className="export-help">
            Remova da lista o que não precisa. O backup grava <strong>somente</strong> o que ficou na lista.
          </p>
        </div>
      </div>

      <div className="spec-list-block">
        <h5>
          {isLogo
            ? `Lista de logos (${logos.length}) — remova as que não precisa ajustar`
            : `Lista de fotos (${photos.length}) — remova as que não precisa ajustar`}
        </h5>
        <div className="export-table-wrap">
          {isLogo ? (
            <table className="export-table export-table-edit">
              <thead>
                <tr>
                  <th>Slot</th>
                  <th>Código</th>
                  <th>Equipe</th>
                  <th>Cor</th>
                  <th>Origem</th>
                  <th>Trocar</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {logos.map((item) => (
                  <tr
                    key={item.key}
                    className={activeLogo?.key === item.key ? 'is-preview' : ''}
                    onClick={() => setLogoKey(item.key)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td><strong>{item.slotLetra}</strong></td>
                    <td><code>{item.codigo}</code></td>
                    <td>
                      {item.equipeNome}
                      <small style={{ display: 'block', color: 'var(--muted)' }}>{item.lineNome}</small>
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <input
                        type="color"
                        title="Cor só desta logo"
                        value={item.tintColor || '#ffffff'}
                        disabled={disabled || Boolean(busy)}
                        onChange={(e) => {
                          const v = e.target.value
                          setLogos((prev) =>
                            prev.map((l) => (l.key === item.key ? { ...l, tintColor: v } : l)),
                          )
                        }}
                      />
                      {item.tintColor ? (
                        <button
                          type="button"
                          className="link-button"
                          style={{ minHeight: 24, fontSize: 10, padding: '0 4px' }}
                          onClick={() =>
                            setLogos((prev) =>
                              prev.map((l) => (l.key === item.key ? { ...l, tintColor: null } : l)),
                            )
                          }
                        >
                          limpar
                        </button>
                      ) : (
                        <small className="empty">orig.</small>
                      )}
                    </td>
                    <td>
                      {item.sourceUrl ? <img className="spec-thumb" src={item.sourceUrl} alt="" /> : <span className="empty">—</span>}
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <input
                        type="file"
                        accept="image/*"
                        disabled={disabled || Boolean(busy)}
                        onChange={(e) => void replaceSource('logo', item.key, e.target.files?.[0] || null)}
                      />
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        className="button secondary small"
                        title="Remover da lista (não processa / não grava)"
                        disabled={disabled || Boolean(busy)}
                        onClick={() => removeLogoFromList(item.key)}
                      >
                        <X size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
                {!logos.length ? <tr><td colSpan={7}>Lista vazia.</td></tr> : null}
              </tbody>
            </table>
          ) : (
            <table className="export-table export-table-edit">
              <thead>
                <tr>
                  <th>Id jogo</th>
                  <th>Nick</th>
                  <th>Equipe</th>
                  <th>Origem</th>
                  <th>Trocar</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {photos.map((item) => (
                  <tr
                    key={item.key}
                    className={activePhoto?.key === item.key ? 'is-preview' : ''}
                    onClick={() => setPhotoKey(item.key)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td><code>{item.idJogo}</code></td>
                    <td>{item.nick}</td>
                    <td>{item.equipeNome}</td>
                    <td>
                      {item.sourceUrl ? <img className="spec-thumb spec-thumb-photo" src={item.sourceUrl} alt="" /> : <span className="empty">—</span>}
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <input
                        type="file"
                        accept="image/*"
                        disabled={disabled || Boolean(busy)}
                        onChange={(e) => void replaceSource('photo', item.key, e.target.files?.[0] || null)}
                      />
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        className="button secondary small"
                        disabled={disabled || Boolean(busy)}
                        onClick={() => removePhotoFromList(item.key)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
                {!photos.length ? <tr><td colSpan={6}>Lista vazia.</td></tr> : null}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </section>
  )
}
