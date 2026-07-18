'use client'

import { useState, type ReactNode } from 'react'
import { uploadPublicFile } from '@/lib/upload-public'
import { STREAM_FONTS, type BoxStyle, type FieldStyle, type FillStyle, type TextStyle, type TransitionStyle } from '../../types/stream.types'

function Section(props: { title: string; children: ReactNode }) {
  return (
    <div className="stream-style-section">
      <strong>{props.title}</strong>
      <div className="stream-style-grid">{props.children}</div>
    </div>
  )
}

function Field(props: { label: string; children: ReactNode }) {
  return (
    <label className="stream-style-field">
      <span>{props.label}</span>
      {props.children}
    </label>
  )
}

export function TextStyleEditor(props: {
  value?: TextStyle
  onChange: (next: TextStyle) => void
}) {
  const v = props.value || {
    fontFamily: 'Rajdhani',
    fontWeight: 800,
    fontSize: 16,
    color: '#ffffff',
    align: 'center' as const,
    uppercase: true,
  }
  const set = (patch: Partial<TextStyle>) => props.onChange({ ...v, ...patch })

  return (
    <Section title="Texto">
      <Field label="Fonte">
        <select value={v.fontFamily} onChange={(e) => set({ fontFamily: e.target.value })}>
          {STREAM_FONTS.map((f) => (
            <option key={f} value={f}>{f}</option>
          ))}
        </select>
      </Field>
      <Field label="Tamanho">
        <input type="number" min={8} max={96} value={v.fontSize} onChange={(e) => set({ fontSize: Number(e.target.value) || 16 })} />
      </Field>
      <Field label="Peso">
        <select value={v.fontWeight} onChange={(e) => set({ fontWeight: Number(e.target.value) })}>
          {[500, 600, 700, 800, 900].map((w) => (
            <option key={w} value={w}>{w}</option>
          ))}
        </select>
      </Field>
      <Field label="Cor">
        <input type="color" value={v.color?.slice(0, 7) || '#ffffff'} onChange={(e) => set({ color: e.target.value })} />
      </Field>
      <Field label="Alinhar">
        <select value={v.align || 'left'} onChange={(e) => set({ align: e.target.value as TextStyle['align'] })}>
          <option value="left">Esquerda</option>
          <option value="center">Centro</option>
          <option value="right">Direita</option>
        </select>
      </Field>
      <Field label="MAIÚSCULAS">
        <input type="checkbox" checked={Boolean(v.uppercase)} onChange={(e) => set({ uppercase: e.target.checked })} />
      </Field>
    </Section>
  )
}

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

export function FillStyleEditor(props: {
  value?: FillStyle
  onChange: (next: FillStyle) => void
  allowImage?: boolean
}) {
  const v: FillStyle = props.value || { mode: 'solid', color: '#1a1d24', opacity: 1 }
  const set = (patch: Partial<FillStyle>) => props.onChange({ ...v, ...patch })
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')

  async function onPickFile(file: File | null) {
    if (!file) return
    setUploading(true)
    setUploadError('')
    try {
      const png = await fileToPngFile(file)
      const url = await uploadPublicFile(png, 'campeonato', 'produtora')
      set({ mode: 'image', imageUrl: url, fit: v.fit || 'cover', overlayOpacity: v.overlayOpacity ?? 0.35, overlayColor: v.overlayColor || '#000000' })
    } catch (err: any) {
      setUploadError(err?.message || 'Falha no upload.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <Section title="Fundo">
      <Field label="Tipo">
        <select
          value={v.mode}
          onChange={(e) => set({ mode: e.target.value as FillStyle['mode'] })}
        >
          <option value="solid">Cor sólida</option>
          <option value="gradient">Degradê</option>
          {props.allowImage !== false ? <option value="image">Imagem</option> : null}
        </select>
      </Field>
      <Field label={v.mode === 'gradient' ? 'Cor 1' : 'Cor'}>
        <input type="color" value={(v.color || '#1a1d24').slice(0, 7)} onChange={(e) => set({ color: e.target.value })} />
      </Field>
      {v.mode === 'gradient' ? (
        <>
          <Field label="Cor 2">
            <input type="color" value={(v.colorTo || v.color || '#000000').slice(0, 7)} onChange={(e) => set({ colorTo: e.target.value })} />
          </Field>
          <Field label="Ângulo">
            <input type="range" min={0} max={360} value={v.angle ?? 180} onChange={(e) => set({ angle: Number(e.target.value) })} />
          </Field>
        </>
      ) : null}
      {v.mode === 'image' ? (
        <>
          <Field label="Enviar imagem">
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              disabled={uploading}
              onChange={(e) => void onPickFile(e.target.files?.[0] || null)}
            />
          </Field>
          {uploading ? <p className="stream-hint">Enviando…</p> : null}
          {uploadError ? <p className="stream-error" style={{ margin: 0 }}>{uploadError}</p> : null}
          {v.imageUrl ? (
            <div className="stream-fill-thumb">
              <img src={v.imageUrl} alt="" />
            </div>
          ) : null}
          <Field label="URL da imagem">
            <input
              type="url"
              value={v.imageUrl || ''}
              placeholder="https://… ou envie acima"
              onChange={(e) => set({ imageUrl: e.target.value })}
            />
          </Field>
          <Field label="Ajuste">
            <select value={v.fit || 'cover'} onChange={(e) => set({ fit: e.target.value as 'cover' | 'contain' })}>
              <option value="cover">Cobrir</option>
              <option value="contain">Conter</option>
            </select>
          </Field>
          <Field label="Escurecer">
            <input
              type="range"
              min={0}
              max={80}
              value={Math.round((v.overlayOpacity ?? 0.35) * 100)}
              onChange={(e) => set({ overlayOpacity: Number(e.target.value) / 100, overlayColor: v.overlayColor || '#000000' })}
            />
          </Field>
        </>
      ) : null}
      <Field label="Opacidade">
        <input
          type="range"
          min={20}
          max={100}
          value={Math.round((v.opacity ?? 1) * 100)}
          onChange={(e) => set({ opacity: Number(e.target.value) / 100 })}
        />
      </Field>
    </Section>
  )
}

export function BoxStyleEditor(props: {
  value?: BoxStyle
  onChange: (next: BoxStyle) => void
  allowImage?: boolean
}) {
  const v: BoxStyle = props.value || {}
  const set = (patch: Partial<BoxStyle>) => props.onChange({ ...v, ...patch })

  return (
    <>
      <FillStyleEditor
        value={v.fill}
        allowImage={props.allowImage}
        onChange={(fill) => set({ fill })}
      />
      <Section title="Borda e forma">
        <Field label="Cor da borda">
          <input type="color" value={(v.borderColor || '#c9a227').slice(0, 7)} onChange={(e) => set({ borderColor: e.target.value })} />
        </Field>
        <Field label="Espessura">
          <input type="number" min={0} max={12} value={v.borderWidth ?? 0} onChange={(e) => set({ borderWidth: Number(e.target.value) || 0 })} />
        </Field>
        <Field label="Cantos">
          <input type="number" min={0} max={48} value={v.borderRadius ?? 0} onChange={(e) => set({ borderRadius: Number(e.target.value) || 0 })} />
        </Field>
        <Field label="Inclinação X">
          <input type="range" min={-15} max={15} value={v.skewX ?? 0} onChange={(e) => set({ skewX: Number(e.target.value) })} />
        </Field>
        <Field label="Inclinação Y">
          <input type="range" min={-15} max={15} value={v.skewY ?? 0} onChange={(e) => set({ skewY: Number(e.target.value) })} />
        </Field>
        <Field label="Rotação">
          <input type="range" min={-15} max={15} value={v.rotate ?? 0} onChange={(e) => set({ rotate: Number(e.target.value) })} />
        </Field>
        <Field label="Padding">
          <input type="number" min={0} max={40} value={v.padding ?? 0} onChange={(e) => set({ padding: Number(e.target.value) || 0 })} />
        </Field>
      </Section>
    </>
  )
}

export function FieldStyleEditor(props: {
  value?: FieldStyle
  onChange: (next: FieldStyle) => void
  /** permite imagem de fundo no box do item */
  allowImage?: boolean
  /** esconde editor de texto (só fundo/borda) */
  hideText?: boolean
}) {
  const v = props.value || {}
  return (
    <>
      {!props.hideText ? (
        <TextStyleEditor value={v.text} onChange={(text) => props.onChange({ ...v, text })} />
      ) : null}
      <BoxStyleEditor
        value={v.box}
        allowImage={props.allowImage !== false}
        onChange={(box) => props.onChange({ ...v, box })}
      />
    </>
  )
}

/** Upload de imagem livre para camadas (logo do campeonato, arte, etc.). */
export function LayerImageUpload(props: {
  value?: string
  onChange: (url: string) => void
  label?: string
}) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  async function onPickFile(file: File | null) {
    if (!file) return
    setUploading(true)
    setError('')
    try {
      const png = await fileToPngFile(file)
      const url = await uploadPublicFile(png, 'campeonato', 'produtora')
      props.onChange(url)
    } catch (err: any) {
      setError(err?.message || 'Falha no upload.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="stream-layer-image-upload">
      <p className="stream-hint"><strong>{props.label || 'Imagem livre (PC)'}</strong></p>
      <label className="stream-field">
        <span>Enviar do PC</span>
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          disabled={uploading}
          onChange={(e) => void onPickFile(e.target.files?.[0] || null)}
        />
      </label>
      {uploading ? <p className="stream-hint">Enviando…</p> : null}
      {error ? <p className="stream-error" style={{ margin: 0 }}>{error}</p> : null}
      {props.value ? (
        <div className="stream-fill-thumb stream-layer-image-preview">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={props.value} alt="" />
          <button type="button" className="stream-secondary-btn" onClick={() => props.onChange('')}>
            Remover imagem
          </button>
        </div>
      ) : (
        <p className="stream-hint">PNG/JPG do PC — logo do campeonato, artes, ícones…</p>
      )}
    </div>
  )
}

export function TransitionEditor(props: {
  value?: TransitionStyle
  onChange: (next: TransitionStyle) => void
  mode: 'card' | 'table'
}) {
  const v: TransitionStyle = props.value || {
    enter: 'fade',
    onDataChange: 'pulse',
    durationMs: 400,
    delayMs: 0,
  }
  const set = (patch: Partial<TransitionStyle>) => props.onChange({ ...v, ...patch })

  return (
    <Section title={props.mode === 'card' ? 'Transições do card' : 'Transições da tabela'}>
      <Field label="Entrada">
        <select value={v.enter} onChange={(e) => set({ enter: e.target.value as TransitionStyle['enter'] })}>
          <option value="none">Nenhuma</option>
          <option value="fade">Fade</option>
          <option value="slide-up">Slide cima</option>
          <option value="slide-left">Slide esquerda</option>
          <option value="scale">Scale pop</option>
          {props.mode === 'card' ? <option value="stagger">Stagger (em sequência)</option> : null}
        </select>
      </Field>
      <Field label="Ao atualizar dado">
        <select value={v.onDataChange} onChange={(e) => set({ onDataChange: e.target.value as TransitionStyle['onDataChange'] })}>
          <option value="none">Nenhuma</option>
          <option value="fade">Fade</option>
          <option value="tick">Tick numérico</option>
          <option value="pulse">Pulse</option>
          {props.mode === 'table' ? <option value="rank-move">Rank move</option> : null}
        </select>
      </Field>
      <Field label="Duração (ms)">
        <input type="number" min={100} max={2000} step={50} value={v.durationMs} onChange={(e) => set({ durationMs: Number(e.target.value) || 400 })} />
      </Field>
      <Field label="Delay (ms)">
        <input type="number" min={0} max={2000} step={50} value={v.delayMs} onChange={(e) => set({ delayMs: Number(e.target.value) || 0 })} />
      </Field>
    </Section>
  )
}
