'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Check, Trash2, Upload, X } from 'lucide-react'

const uploadTargets = {
  produtora: { width: 500, height: 500, kindLabel: 'logo' },
  equipe: { width: 500, height: 500, kindLabel: 'logo' },
  campeonato: { width: 500, height: 500, kindLabel: 'logo' },
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

export function UploadField({ label, value, bucket, onChange, onUpload }: { label: string; value: string; bucket: string; onChange: (value: string) => void; onUpload: (file: File, bucket: string) => Promise<string> }) {
  const target = uploadTargetFor(bucket)
  const previewWidth = 220
  const previewHeight = Math.round(previewWidth * (target.height / target.width))
  const [cropOpen, setCropOpen] = useState(false)
  const [sourceUrl, setSourceUrl] = useState('')
  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 })
  const [zoom, setZoom] = useState(1)
  const [offsetX, setOffsetX] = useState(0)
  const [offsetY, setOffsetY] = useState(0)
  const [uploading, setUploading] = useState(false)

  const imageRatio = naturalSize.width && naturalSize.height ? naturalSize.width / naturalSize.height : 1
  const frameRatio = previewWidth / previewHeight
  const coverBase = useMemo(() => {
    if (!naturalSize.width || !naturalSize.height) return { width: previewWidth, height: previewHeight }
    if (imageRatio > frameRatio) {
      return { width: previewHeight * imageRatio, height: previewHeight }
    }
    return { width: previewWidth, height: previewWidth / imageRatio }
  }, [frameRatio, imageRatio, naturalSize.height, naturalSize.width, previewHeight, previewWidth])

  const drawWidth = coverBase.width * zoom
  const drawHeight = coverBase.height * zoom
  const limitX = Math.max(0, (drawWidth - previewWidth) / 2)
  const limitY = Math.max(0, (drawHeight - previewHeight) / 2)
  const displayLeft = (previewWidth - drawWidth) / 2 + offsetX
  const displayTop = (previewHeight - drawHeight) / 2 + offsetY

  useEffect(() => {
    return () => {
      if (sourceUrl) URL.revokeObjectURL(sourceUrl)
    }
  }, [sourceUrl])

  function resetCrop(url = '') {
    setZoom(1)
    setOffsetX(0)
    setOffsetY(0)
    setNaturalSize({ width: 0, height: 0 })
    if (url) setSourceUrl(url)
  }

  function closeCropper() {
    setCropOpen(false)
    if (sourceUrl) URL.revokeObjectURL(sourceUrl)
    setSourceUrl('')
    resetCrop()
  }

  async function handleSelect(file: File) {
    if (sourceUrl) URL.revokeObjectURL(sourceUrl)
    const nextUrl = URL.createObjectURL(file)
    resetCrop(nextUrl)
    setCropOpen(true)
  }

  async function handleSaveCrop() {
    if (!sourceUrl) return
    setUploading(true)
    try {
      const image = new Image()
      image.src = sourceUrl
      await image.decode()

      const canvas = document.createElement('canvas')
      canvas.width = target.width
      canvas.height = target.height
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Nao foi possivel preparar a imagem.')
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      const scale = target.width / previewWidth
      ctx.drawImage(image, displayLeft * scale, displayTop * scale, drawWidth * scale, drawHeight * scale)

      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
      if (!blob) throw new Error('Nao foi possivel gerar o PNG final.')
      const croppedFile = new File([blob], `${bucket}-${Date.now()}.png`, { type: 'image/png' })
      const url = await onUpload(croppedFile, bucket)
      if (url) {
        onChange(url)
        closeCropper()
      }
    } catch (error) {
      console.error(error)
    } finally {
      setUploading(false)
    }
  }

  return (
    <Field label={label}>
      <div className="upload-field compact-upload-field">
        <input
          id={`${bucket}-upload-input`}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          hidden
          onChange={async (e) => {
            const input = e.currentTarget
            const file = input.files?.[0]

            if (!file) return

            input.value = ''
            await handleSelect(file)
          }}
        />

        <label htmlFor={`${bucket}-upload-input`} className={`upload-picker ${value ? 'filled' : ''}`}>
          {value ? <img src={value} alt="" /> : <Upload size={24} />}
        </label>

        <div className="upload-hint-row">
          <small>{target.kindLabel.toUpperCase()} · PNG · {target.width}x{target.height}</small>
          {value ? (
            <button type="button" className="inline-icon-button" onClick={() => onChange('')}>
              <Trash2 size={15} /> Remover
            </button>
          ) : null}
        </div>

        {cropOpen && typeof document !== 'undefined' ? createPortal(
          <div className="cropper-overlay" onClick={closeCropper}>
            <div className="cropper-modal" onClick={(event) => event.stopPropagation()}>
              <div className="cropper-head">
                <div>
                  <p className="eyebrow">Ajustar {target.kindLabel}</p>
                  <h3>{target.width} x {target.height} px</h3>
                </div>
                <button type="button" className="close-auth" onClick={closeCropper} aria-label="Fechar ajuste da imagem">
                  <X size={18} />
                </button>
              </div>

              <div className="cropper-frame-wrap">
                <div className="cropper-frame" style={{ width: previewWidth, height: previewHeight }}>
                  {sourceUrl ? (
                    <img
                      src={sourceUrl}
                      alt="Prévia"
                      onLoad={(event) => {
                        const element = event.currentTarget
                        setNaturalSize({ width: element.naturalWidth, height: element.naturalHeight })
                      }}
                      style={{ width: drawWidth, height: drawHeight, left: displayLeft, top: displayTop }}
                    />
                  ) : null}
                </div>
              </div>

              <div className="crop-controls">
                <Field label="Tamanho">
                  <input type="range" min="1" max="3" step="0.01" value={zoom} onChange={(e) => setZoom(Number(e.target.value))} />
                </Field>
                <div className="crop-range-grid">
                  <Field label="Posição horizontal">
                    <input type="range" min={-Math.ceil(limitX)} max={Math.ceil(limitX)} step="1" value={offsetX} onChange={(e) => setOffsetX(Number(e.target.value))} disabled={limitX === 0} />
                  </Field>
                  <Field label="Posição vertical">
                    <input type="range" min={-Math.ceil(limitY)} max={Math.ceil(limitY)} step="1" value={offsetY} onChange={(e) => setOffsetY(Number(e.target.value))} disabled={limitY === 0} />
                  </Field>
                </div>
              </div>

              <div className="button-row cropper-actions">
                <button type="button" className="button secondary" onClick={closeCropper}>Cancelar</button>
                <button type="button" className="button" onClick={handleSaveCrop} disabled={uploading}>
                  <Check size={16} /> {uploading ? 'Salvando...' : 'Usar imagem'}
                </button>
              </div>
            </div>
          </div>,
          document.body
        ) : null}
      </div>
    </Field>
  )
}
