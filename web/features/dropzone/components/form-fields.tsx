'use client'

import { useEffect, useId, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode, type WheelEvent as ReactWheelEvent } from 'react'
import { createPortal } from 'react-dom'
import { Check, Minus, Plus, RotateCcw, Trash2, Upload, X } from 'lucide-react'

const uploadTargets = {
  account: { width: 500, height: 500, kindLabel: 'foto' },
  produtora: { width: 500, height: 500, kindLabel: 'logo' },
  equipe: { width: 500, height: 500, kindLabel: 'logo' },
  campeonato: { width: 500, height: 500, kindLabel: 'logo' },
  // Vitrine do campeonato: proporção 4:5, preparada localmente antes do upload.
  // 1200×1500 mantém boa nitidez em telas grandes sem enviar um arquivo pesado.
  campeonato_banner: { width: 1200, height: 1500, kindLabel: 'banner 4:5' },
  jogador: { width: 500, height: 600, kindLabel: 'foto' },
  manager: { width: 500, height: 600, kindLabel: 'foto' },
  broadcast: { width: 500, height: 600, kindLabel: 'foto' },
} as const

function uploadTargetFor(bucket: string) {
  return uploadTargets[bucket as keyof typeof uploadTargets] || { width: 500, height: 500, kindLabel: 'imagem' }
}


type PendingImageUpload = {
  file: File
  bucket: string
  upload: (file: File, bucket: string, ...args: any[]) => Promise<string>
  context?: UploadFieldContext
}

type UploadFieldContext = {
  entityId?: string | null
  campeonatoId?: string | null
  uploadIntent?: 'create_profile' | 'create_campeonato' | null
}

const pendingImageUploads = new Map<string, PendingImageUpload>()

export function isPendingImageUpload(value: string) {
  return pendingImageUploads.has(value)
}

export function discardPendingImageUpload(value: string) {
  if (!pendingImageUploads.has(value)) return
  pendingImageUploads.delete(value)
  URL.revokeObjectURL(value)
}

export async function resolvePendingImageUpload(
  value: string,
  overrideUpload?: (file: File, bucket: string) => Promise<string>,
) {
  const pending = pendingImageUploads.get(value)
  if (!pending) return value
  const url = overrideUpload
    ? await overrideUpload(pending.file, pending.bucket)
    : await pending.upload(pending.file, pending.bucket, pending.context)
  if (!url) throw new Error('Upload não retornou URL da imagem.')
  pendingImageUploads.delete(value)
  URL.revokeObjectURL(value)
  return url
}

type LocationOption = { cidade: string; estado: string; estadoNome?: string; pais: string }

const BRAZIL_LOCATIONS: LocationOption[] = [
  { cidade: 'Belém', estado: 'PA', estadoNome: 'Pará', pais: 'Brasil' },
  { cidade: 'Ananindeua', estado: 'PA', estadoNome: 'Pará', pais: 'Brasil' },
  { cidade: 'Marituba', estado: 'PA', estadoNome: 'Pará', pais: 'Brasil' },
  { cidade: 'Santarém', estado: 'PA', estadoNome: 'Pará', pais: 'Brasil' },
  { cidade: 'Marabá', estado: 'PA', estadoNome: 'Pará', pais: 'Brasil' },
  { cidade: 'São Paulo', estado: 'SP', estadoNome: 'São Paulo', pais: 'Brasil' },
  { cidade: 'Rio de Janeiro', estado: 'RJ', estadoNome: 'Rio de Janeiro', pais: 'Brasil' },
  { cidade: 'Belo Horizonte', estado: 'MG', estadoNome: 'Minas Gerais', pais: 'Brasil' },
  { cidade: 'Brasília', estado: 'DF', estadoNome: 'Distrito Federal', pais: 'Brasil' },
  { cidade: 'Salvador', estado: 'BA', estadoNome: 'Bahia', pais: 'Brasil' },
  { cidade: 'Fortaleza', estado: 'CE', estadoNome: 'Ceará', pais: 'Brasil' },
  { cidade: 'Recife', estado: 'PE', estadoNome: 'Pernambuco', pais: 'Brasil' },
  { cidade: 'Manaus', estado: 'AM', estadoNome: 'Amazonas', pais: 'Brasil' },
  { cidade: 'Curitiba', estado: 'PR', estadoNome: 'Paraná', pais: 'Brasil' },
  { cidade: 'Porto Alegre', estado: 'RS', estadoNome: 'Rio Grande do Sul', pais: 'Brasil' },
  { cidade: 'Goiânia', estado: 'GO', estadoNome: 'Goiás', pais: 'Brasil' },
  { cidade: 'Florianópolis', estado: 'SC', estadoNome: 'Santa Catarina', pais: 'Brasil' },
  { cidade: 'Cuiabá', estado: 'MT', estadoNome: 'Mato Grosso', pais: 'Brasil' },
  { cidade: 'Maceió', estado: 'AL', estadoNome: 'Alagoas', pais: 'Brasil' },
  { cidade: 'Macapá', estado: 'AP', estadoNome: 'Amapá', pais: 'Brasil' },
]

let brazilLocationsCache: LocationOption[] | null = null
let brazilLocationsRequest: Promise<LocationOption[]> | null = null

function normalizeText(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
}

function formatLocationLabel(value: { pais?: string; estado?: string; cidade?: string }) {
  if (!value?.cidade && !value?.estado && !value?.pais) return ''
  if (value.cidade && value.estado) return `${value.cidade} - ${value.estado}`
  return [value.cidade, value.estado, value.pais].filter(Boolean).join(', ')
}

async function loadBrazilLocations() {
  if (brazilLocationsCache) return brazilLocationsCache
  if (!brazilLocationsRequest) {
    brazilLocationsRequest = fetch('https://servicodados.ibge.gov.br/api/v1/localidades/municipios')
      .then(async (response) => {
        if (!response.ok) throw new Error('IBGE indisponível')
        const rows = await response.json()
        const parsed = Array.isArray(rows)
          ? rows.map((row: any) => {
            const uf = row?.microrregiao?.mesorregiao?.UF
            return {
              cidade: String(row?.nome || ''),
              estado: String(uf?.sigla || ''),
              estadoNome: String(uf?.nome || ''),
              pais: 'Brasil',
            }
          }).filter((item: LocationOption) => item.cidade && item.estado)
          : []
        brazilLocationsCache = parsed.length ? parsed : BRAZIL_LOCATIONS
        return brazilLocationsCache
      })
      .catch(() => {
        brazilLocationsCache = BRAZIL_LOCATIONS
        return BRAZIL_LOCATIONS
      })
  }
  return brazilLocationsRequest
}

function rankLocation(item: LocationOption, query: string) {
  const cidade = normalizeText(item.cidade)
  const estado = normalizeText(item.estado)
  const estadoNome = normalizeText(item.estadoNome || '')
  const pais = normalizeText(item.pais)
  const haystack = `${cidade} ${estado} ${estadoNome} ${pais}`
  if (cidade === query) return 0
  if (cidade.startsWith(query)) return 1
  if (estado === query || estadoNome.startsWith(query)) return 2
  if (haystack.includes(query)) return 3
  return 9
}

export function LocationSearch({
  value,
  onSelect,
  label = 'Localidade',
  placeholder = 'Digite cidade, estado ou país',
}: {
  value: { pais: string; estado: string; cidade: string }
  onSelect: (location: { pais: string; estado: string; cidade: string; estadoNome?: string }) => void
  label?: string
  placeholder?: string
}) {
  const selectedLabel = formatLocationLabel(value)
  const [query, setQuery] = useState(selectedLabel)
  const [open, setOpen] = useState(false)
  const [locations, setLocations] = useState<LocationOption[]>(BRAZIL_LOCATIONS)

  useEffect(() => {
    let active = true
    loadBrazilLocations().then((items) => {
      if (active) setLocations(items)
    })
    return () => { active = false }
  }, [])

  useEffect(() => {
    setQuery(selectedLabel)
  }, [selectedLabel])

  const filtered = useMemo(() => {
    const q = normalizeText(query)
    if (!q) return locations.slice(0, 6)
    return locations
      .map((item) => ({ item, rank: rankLocation(item, q) }))
      .filter(({ rank }) => rank < 9)
      .sort((a, b) => a.rank - b.rank || a.item.cidade.localeCompare(b.item.cidade, 'pt-BR'))
      .slice(0, 8)
      .map(({ item }) => item)
  }, [locations, query])

  return (
    <Field label={label}>
      <div className="location-search">
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
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
                  setQuery(formatLocationLabel(item))
                  setOpen(false)
                }}
              >
                <strong>{item.cidade}</strong>
                <span>{item.pais}, {item.estadoNome || item.estado} - {item.estado}</span>
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

export function UploadField({
  label,
  value,
  bucket,
  cropTarget,
  uploadContext,
  onChange,
  onUpload,
}: {
  label: string
  value: string
  bucket: string
  cropTarget?: string
  uploadContext?: UploadFieldContext
  onChange: (value: string) => void
  onUpload: (file: File, bucket: string, ...args: any[]) => Promise<string>
}) {
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
      // O recorte final já sai compacto para reduzir armazenamento e egress.
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.82))
      if (!blob) throw new Error('Nao foi possivel gerar a imagem final.')
      const croppedFile = new File([blob], `${bucket}-${Date.now()}.webp`, { type: 'image/webp' })
      if (isPendingImageUpload(value)) discardPendingImageUpload(value)
      const previewUrl = URL.createObjectURL(croppedFile)
      pendingImageUploads.set(previewUrl, { file: croppedFile, bucket, upload: onUpload, context: uploadContext })
      onChange(previewUrl)
      closeCropper()
    } catch (error: any) {
      console.error(error)
      setCropError(error?.message || 'Erro ao preparar a imagem. Tente novamente.')
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
          <small>{target.kindLabel.toUpperCase()} · WEBP OTIMIZADO · {target.width}x{target.height}</small>
          {value ? <button type="button" className="inline-icon-button" onClick={() => { discardPendingImageUpload(value); onChange('') }}><Trash2 size={15} /> Remover</button> : null}
        </div>

        {cropOpen && typeof document !== 'undefined' ? createPortal(
          <div className="cropper-overlay" onClick={closeCropper}>
            <div className="cropper-modal cropper-modal-interactive" onClick={(event) => event.stopPropagation()}>
              <div className="cropper-head">
                <div><p className="eyebrow">Ajustar {target.kindLabel}</p><h3>{target.width} x {target.height} px</h3></div>
                <button type="button" className="close-auth" onClick={closeCropper} aria-label="Fechar ajuste da imagem"><X size={18} /></button>
              </div>

              <div className="cropper-workspace">
                <div className="cropper-canvas-column">
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
                </div>
                <aside className="cropper-side-controls" aria-label="Zoom da imagem">
                  <button type="button" onClick={() => updateZoom(zoom + 0.15)} aria-label="Aumentar imagem"><Plus size={18} /></button>
                  <input className="cropper-zoom-slider" type="range" min="100" max="400" step="5" value={Math.round(zoom * 100)} onChange={(event) => updateZoom(Number(event.target.value) / 100)} aria-label="Aumentar ou diminuir imagem" />
                  <strong>{Math.round(zoom * 100)}%</strong>
                  <button type="button" onClick={() => updateZoom(zoom - 0.15)} aria-label="Diminuir imagem"><Minus size={18} /></button>
                  <button type="button" className="cropper-reset-button" onClick={() => { setZoom(1); setOffsetX(0); setOffsetY(0) }} aria-label="Centralizar e restaurar imagem" title="Centralizar e restaurar"><RotateCcw size={16} /></button>
                </aside>
              </div>
              <p className="cropper-touch-note">No computador, arraste com o mouse e use +/− ou a roda. No celular, arraste e use dois dedos para ampliar.</p>
              {cropError ? <p className="message error" style={{ margin: '0 0 10px' }}>{cropError}</p> : null}
              <div className="button-row cropper-actions">
                <button type="button" className="button secondary" onClick={closeCropper} disabled={uploading}>Cancelar</button>
                <button type="button" className="button" onClick={() => void handleSaveCrop()} disabled={uploading}><Check size={16} /> {uploading ? 'Preparando...' : 'Usar imagem'}</button>
              </div>
            </div>
          </div>, document.body
        ) : null}
      </div>
    </Field>
  )

}
