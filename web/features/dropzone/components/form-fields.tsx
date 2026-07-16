'use client'

import { useEffect, useId, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode, type WheelEvent as ReactWheelEvent } from 'react'
import { createPortal } from 'react-dom'
import { Check, Minus, Plus, Trash2, Upload, X } from 'lucide-react'

const uploadTargets = {
  produtora: { width: 500, height: 500, kindLabel: 'logo' },
  equipe: { width: 500, height: 500, kindLabel: 'logo' },
  campeonato: { width: 500, height: 500, kindLabel: 'logo' },
  campeonato_banner: { width: 1080, height: 1920, kindLabel: 'banner' },
  jogador: { width: 500, height: 600, kindLabel: 'foto' },
  manager: { width: 500, height: 600, kindLabel: 'foto' },
} as const

function uploadTargetFor(bucket: string) {
  return uploadTargets[bucket as keyof typeof uploadTargets] || { width: 500, height: 500, kindLabel: 'imagem' }
}

const BRAZIL_LOCATIONS = [
  { cidade: 'Belém', estado: 'PA', pais: 'Brasil' },
  { cidade: 'Ananindeua', estado: 'PA', pais: 'Brasil' },
  { cidade: 'Marituba', estado: 'PA', pais: 'Brasil' },
  { cidade: 'Santarém', estado: 'PA', pais: 'Brasil' },
  { cidade: 'Marabá', estado: 'PA', pais: 'Brasil' },
  { cidade: 'São Paulo', estado: 'SP', pais: 'Brasil' },
  { cidade: 'Rio de Janeiro', estado: 'RJ', pais: 'Brasil' },
  { cidade: 'Belo Horizonte', estado: 'MG', pais: 'Brasil' },
  { cidade: 'Brasília', estado: 'DF', pais: 'Brasil' },
  { cidade: 'Salvador', estado: 'BA', pais: 'Brasil' },
  { cidade: 'Fortaleza', estado: 'CE', pais: 'Brasil' },
  { cidade: 'Recife', estado: 'PE', pais: 'Brasil' },
  { cidade: 'Manaus', estado: 'AM', pais: 'Brasil' },
  { cidade: 'Curitiba', estado: 'PR', pais: 'Brasil' },
  { cidade: 'Porto Alegre', estado: 'RS', pais: 'Brasil' },
  { cidade: 'Goiânia', estado: 'GO', pais: 'Brasil' },
  { cidade: 'Florianópolis', estado: 'SC', pais: 'Brasil' },
  { cidade: 'Cuiabá', estado: 'MT', pais: 'Brasil' },
  { cidade: 'Maceió', estado: 'AL', pais: 'Brasil' },
  { cidade: 'Macapá', estado: 'AP', pais: 'Brasil' },
]

function normalizeText(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
}

export function LocationSearch({ value, onSelect }: { value: { pais: string; estado: string; cidade: string }; onSelect: (location: { pais: string; estado: string; cidade: string }) => void }) {
  const selectedLabel = [value.cidade, value.estado, value.pais].filter(Boolean).join(', ')
  const [query, setQuery] = useState(selectedLabel)
  const [open, setOpen] = useState(false)
  const filtered = useMemo(() => {
    const q = normalizeText(query)
    if (!q) return BRAZIL_LOCATIONS.slice(0, 6)
    return BRAZIL_LOCATIONS.filter((item) => normalizeText(`${item.cidade} ${item.estado} ${item.pais}`).includes(q)).slice(0, 8)
  }, [query])

  return (
    <Field label="Localidade">
      <div className="location-search">
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          placeholder="Digite cidade, estado ou país"
        />
        {open ? (
          <div className="location-results">
            {filtered.length ? filtered.map((item) => (
              <button
                type="button"
                key={`${item.cidade}-${item.estado}`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onSelect(item)
                  setQuery(`${item.cidade}, ${item.estado}, ${item.pais}`)
                  setOpen(false)
                }}
              >
                <strong>{item.cidade}</strong>
                <span>{item.estado}, {item.pais}</span>
              </button>
            )) : <div className="location-empty">Nenhuma cidade encontrada.</div>}
          </div>
        ) : null}
      </div>
    </Field>
  )
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
    </div>
  )
}

export function UploadField({ label, value, bucket, cropTarget, onChange, onUpload }: { label: string; value: string; bucket: string; cropTarget?: string; onChange: (value: string) => void; onUpload: (file: File, bucket: string) => Promise<string> }) {
  const target = uploadTargetFor(cropTarget || bucket)
  const inputId = `${cropTarget || bucket}-upload-${useId().replace(/:/g, '')}`
  const previewWidth = 300
  const previewHeight = Math.round(previewWidth * (target.height / target.width))
  const [cropOpen, setCropOpen] = useState(false)
  const [sourceUrl, setSourceUrl] = useState('')
  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 })
  const [zoom, setZoom] = useState(1)
  const [offsetX, setOffsetX] = useState(0)
  const [offsetY, setOffsetY] = useState(0)
  const [uploading, setUploading] = useState(false)
  const [cropError, setCropError] = useState('')
  const pointersRef = useRef(new Map<number, { x: number; y: number }>())
  const gestureRef = useRef<{ distance: number; zoom: number } | null>(null)
  const dragRef = useRef<{ x: number; y: number; offsetX: number; offsetY: number } | null>(null)

  const imageRatio = naturalSize.width && naturalSize.height ? naturalSize.width / naturalSize.height : 1
  const frameRatio = previewWidth / previewHeight
  const coverBase = useMemo(() => {
    if (!naturalSize.width || !naturalSize.height) return { width: previewWidth, height: previewHeight }
    if (imageRatio > frameRatio) return { width: previewHeight * imageRatio, height: previewHeight }
    return { width: previewWidth, height: previewWidth / imageRatio }
  }, [frameRatio, imageRatio, naturalSize.height, naturalSize.width, previewHeight, previewWidth])

  const drawWidth = coverBase.width * zoom
  const drawHeight = coverBase.height * zoom
  const limitX = Math.max(0, (drawWidth - previewWidth) / 2)
  const limitY = Math.max(0, (drawHeight - previewHeight) / 2)
  const clampedOffsetX = Math.max(-limitX, Math.min(limitX, offsetX))
  const clampedOffsetY = Math.max(-limitY, Math.min(limitY, offsetY))
  const displayLeft = (previewWidth - drawWidth) / 2 + clampedOffsetX
  const displayTop = (previewHeight - drawHeight) / 2 + clampedOffsetY

  useEffect(() => {
    setOffsetX((current) => Math.max(-limitX, Math.min(limitX, current)))
    setOffsetY((current) => Math.max(-limitY, Math.min(limitY, current)))
  }, [limitX, limitY])

  useEffect(() => () => { if (sourceUrl) URL.revokeObjectURL(sourceUrl) }, [sourceUrl])

  function resetCrop(url = '') {
    setZoom(1)
    setOffsetX(0)
    setOffsetY(0)
    setNaturalSize({ width: 0, height: 0 })
    pointersRef.current.clear()
    gestureRef.current = null
    dragRef.current = null
    if (url) setSourceUrl(url)
  }

  function closeCropper() {
    setCropOpen(false)
    setCropError('')
    if (sourceUrl) URL.revokeObjectURL(sourceUrl)
    setSourceUrl('')
    resetCrop()
  }

  async function handleSelect(file: File) {
    if (sourceUrl) URL.revokeObjectURL(sourceUrl)
    setCropError('')
    resetCrop(URL.createObjectURL(file))
    setCropOpen(true)
  }

  function updateZoom(next: number) {
    setZoom(Math.max(1, Math.min(4, next)))
  }

  function pointerDistance(values: { x: number; y: number }[]) {
    return Math.hypot(values[0].x - values[1].x, values[0].y - values[1].y)
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId)
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    const points = Array.from(pointersRef.current.values())
    if (points.length === 1) {
      dragRef.current = { x: event.clientX, y: event.clientY, offsetX: clampedOffsetX, offsetY: clampedOffsetY }
    } else if (points.length === 2) {
      gestureRef.current = { distance: pointerDistance(points), zoom }
      dragRef.current = null
    }
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!pointersRef.current.has(event.pointerId)) return
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    const points = Array.from(pointersRef.current.values())
    if (points.length === 2 && gestureRef.current) {
      const distance = pointerDistance(points)
      updateZoom(gestureRef.current.zoom * (distance / Math.max(1, gestureRef.current.distance)))
      return
    }
    if (points.length === 1 && dragRef.current) {
      setOffsetX(dragRef.current.offsetX + event.clientX - dragRef.current.x)
      setOffsetY(dragRef.current.offsetY + event.clientY - dragRef.current.y)
    }
  }

  function handlePointerEnd(event: ReactPointerEvent<HTMLDivElement>) {
    pointersRef.current.delete(event.pointerId)
    gestureRef.current = null
    const remaining = Array.from(pointersRef.current.values())
    if (remaining.length === 1) {
      dragRef.current = { x: remaining[0].x, y: remaining[0].y, offsetX: clampedOffsetX, offsetY: clampedOffsetY }
    } else {
      dragRef.current = null
    }
  }

  function handleWheel(event: ReactWheelEvent<HTMLDivElement>) {
    event.preventDefault()
    updateZoom(zoom + (event.deltaY < 0 ? 0.12 : -0.12))
  }

  async function handleSaveCrop() {
    if (!sourceUrl) return
    setUploading(true)
    setCropError('')
    try {
      const image = new Image()
      image.src = sourceUrl
      await image.decode()
      if (!image.naturalWidth || !image.naturalHeight) {
        throw new Error('Não foi possível ler as dimensões da imagem. Escolha outro arquivo.')
      }
      const canvas = document.createElement('canvas')
      canvas.width = target.width
      canvas.height = target.height
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Nao foi possivel preparar a imagem.')
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      const scale = target.width / previewWidth
      // Garante desenho mesmo se naturalSize do state ainda não atualizou
      const safeDrawW = drawWidth > 0 ? drawWidth : previewWidth
      const safeDrawH = drawHeight > 0 ? drawHeight : previewHeight
      const safeLeft = Number.isFinite(displayLeft) ? displayLeft : 0
      const safeTop = Number.isFinite(displayTop) ? displayTop : 0
      ctx.drawImage(image, safeLeft * scale, safeTop * scale, safeDrawW * scale, safeDrawH * scale)
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
      if (!blob) throw new Error('Nao foi possivel gerar o PNG final.')
      const croppedFile = new File([blob], `${bucket}-${Date.now()}.png`, { type: 'image/png' })
      const url = await onUpload(croppedFile, bucket)
      if (!url) throw new Error('Upload não retornou URL da imagem.')
      onChange(url)
      closeCropper()
    } catch (error: any) {
      console.error(error)
      setCropError(error?.message || 'Erro ao salvar a imagem. Tente novamente.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <Field label={label}>
      <div className="upload-field compact-upload-field">
        <input id={inputId} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={async (e) => {
          const input = e.currentTarget
          const file = input.files?.[0]
          if (!file) return
          input.value = ''
          await handleSelect(file)
        }} />
        <label htmlFor={inputId} className={`upload-picker ${value ? 'filled' : ''}`}>
          {value ? <img src={value} alt="" /> : <Upload size={24} />}
        </label>
        <div className="upload-hint-row">
          <small>{target.kindLabel.toUpperCase()} · PNG · {target.width}x{target.height}</small>
          {value ? <button type="button" className="inline-icon-button" onClick={() => onChange('')}><Trash2 size={15} /> Remover</button> : null}
        </div>

        {cropOpen && typeof document !== 'undefined' ? createPortal(
          <div className="cropper-overlay" onClick={closeCropper}>
            <div className="cropper-modal cropper-modal-interactive" onClick={(event) => event.stopPropagation()}>
              <div className="cropper-head">
                <div><p className="eyebrow">Ajustar {target.kindLabel}</p><h3>{target.width} x {target.height} px</h3></div>
                <button type="button" className="close-auth" onClick={closeCropper} aria-label="Fechar ajuste da imagem"><X size={18} /></button>
              </div>

              <div className="cropper-workspace">
                <div
                  className="cropper-frame cropper-frame-interactive"
                  style={{ width: previewWidth, height: previewHeight }}
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerEnd}
                  onPointerCancel={handlePointerEnd}
                  onWheel={handleWheel}
                >
                  {sourceUrl ? <img src={sourceUrl} draggable={false} alt="Prévia" onLoad={(event) => {
                    const element = event.currentTarget
                    setNaturalSize({ width: element.naturalWidth, height: element.naturalHeight })
                  }} style={{ width: drawWidth, height: drawHeight, left: displayLeft, top: displayTop }} /> : null}
                  <span className="cropper-drag-hint">Arraste para posicionar</span>
                </div>
                <div className="cropper-zoom-controls" aria-label="Controles de zoom">
                  <button type="button" onClick={() => updateZoom(zoom - 0.15)} aria-label="Diminuir"><Minus size={19} /></button>
                  <span>{Math.round(zoom * 100)}%</span>
                  <button type="button" onClick={() => updateZoom(zoom + 0.15)} aria-label="Aumentar"><Plus size={19} /></button>
                </div>
              </div>
              <p className="cropper-touch-note">No computador, arraste com o mouse e use +/− ou a roda. No celular, arraste e use dois dedos para ampliar.</p>
              {cropError ? <p className="message error" style={{ margin: '0 0 10px' }}>{cropError}</p> : null}
              <div className="button-row cropper-actions">
                <button type="button" className="button secondary" onClick={closeCropper} disabled={uploading}>Cancelar</button>
                <button type="button" className="button" onClick={() => void handleSaveCrop()} disabled={uploading}><Check size={16} /> {uploading ? 'Salvando...' : 'Usar imagem'}</button>
              </div>
            </div>
          </div>, document.body
        ) : null}
      </div>
    </Field>
  )

}
