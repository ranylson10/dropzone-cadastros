'use client'

import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Plus, Save, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import {
  getLocalOverlay,
  upsertLocalOverlay,
} from '../services/stream-data.service'
import type { StreamOverlay, StreamOverlayKind } from '../types/stream.types'
import { STREAM_SHEETS } from '../types/stream.types'

function newId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `ov-${Date.now()}`
}

const KINDS: Array<{ id: StreamOverlayKind; label: string }> = [
  { id: 'scoreboard', label: 'Placar' },
  { id: 'standings', label: 'Classificação / tabela' },
  { id: 'lower_third', label: 'Lower third' },
  { id: 'custom', label: 'Custom' },
]

export function StreamOverlayEditor(props: {
  campeonatoId: string
  overlayId?: string
  isNew?: boolean
}) {
  const router = useRouter()
  const existing = useMemo(
    () => (props.isNew || !props.overlayId ? null : getLocalOverlay(props.campeonatoId, props.overlayId)),
    [props.campeonatoId, props.overlayId, props.isNew],
  )

  type FieldRow = StreamOverlay['fields'][number]
  const defaultField: FieldRow = { key: 'campo_1', label: 'Campo 1', cellRef: 'Classificacao!B2' }
  const [name, setName] = useState(existing?.name || 'Nova overlay')
  const [kind, setKind] = useState<StreamOverlayKind>(existing?.kind || 'scoreboard')
  const [fields, setFields] = useState<FieldRow[]>(existing?.fields?.length ? existing.fields : [defaultField])
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (existing) {
      setName(existing.name)
      setKind(existing.kind)
      setFields(existing.fields?.length ? existing.fields : [{ key: 'campo_1', label: 'Campo 1', cellRef: '' }])
    }
  }, [existing])

  function updateField(index: number, patch: Partial<FieldRow>) {
    setFields((prev: FieldRow[]) => prev.map((item: FieldRow, i: number) => (i === index ? { ...item, ...patch } : item)))
  }

  function addField() {
    const n = fields.length + 1
    setFields((prev: FieldRow[]) => [...prev, { key: `campo_${n}`, label: `Campo ${n}`, cellRef: 'Equipes!B2' }])
  }

  function removeField(index: number) {
    setFields((prev: FieldRow[]) => prev.filter((_: FieldRow, i: number) => i !== index))
  }

  function handleSave() {
    const overlay: StreamOverlay = {
      id: existing?.id || props.overlayId || newId(),
      name: name.trim() || 'Overlay',
      kind,
      fields: fields.map((f: FieldRow, i: number) => ({
        key: f.key.trim() || `campo_${i + 1}`,
        label: f.label.trim() || `Campo ${i + 1}`,
        cellRef: f.cellRef.trim(),
      })),
      updatedAt: new Date().toISOString(),
    }
    upsertLocalOverlay(props.campeonatoId, overlay)
    setSaved(true)
    if (props.isNew) {
      router.replace(`/campeonatos/${props.campeonatoId}/stream/overlays/${overlay.id}`)
    }
    window.setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="stream-editor">
      <header className="stream-workspace-header">
        <div className="stream-workspace-brand">
          <button type="button" className="stream-icon-btn" onClick={() => router.push(`/campeonatos/${props.campeonatoId}/stream`)}>
            <ArrowLeft size={16} /> Planilha
          </button>
          <div>
            <p className="eyebrow">Stream · editor de overlay</p>
            <h1>{props.isNew ? 'Nova overlay' : name}</h1>
          </div>
        </div>
        <div className="stream-panel-actions">
          {saved ? <span className="stream-badge">salvo neste navegador</span> : null}
          <button type="button" className="stream-primary-btn" onClick={handleSave}>
            <Save size={15} /> Salvar
          </button>
        </div>
      </header>

      <div className="stream-editor-grid">
        <section className="stream-panel">
          <div className="stream-panel-title"><h4>Dados da overlay</h4></div>
          <label className="stream-field">
            <span>Nome</span>
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="stream-field">
            <span>Tipo</span>
            <select value={kind} onChange={(e) => setKind(e.target.value as StreamOverlayKind)}>
              {KINDS.map((item) => (
                <option key={item.id} value={item.id}>{item.label}</option>
              ))}
            </select>
          </label>
          <p className="stream-hint">
            Persistência local por enquanto (localStorage). Depois migra para o banco sem mudar o fluxo.
          </p>
        </section>

        <section className="stream-panel">
          <div className="stream-panel-title">
            <h4>Campos → planilha</h4>
            <button type="button" className="stream-secondary-btn" onClick={addField}>
              <Plus size={14} /> Campo
            </button>
          </div>
          <p className="stream-hint">
            Endereço no estilo vMix/Sheets: <code>Classificacao!B2</code>, <code>Equipes!A3</code>. Abas disponíveis:{' '}
            {STREAM_SHEETS.map((s) => s.refName).join(', ')}.
          </p>
          <div className="stream-field-bindings">
            {fields.map((field, index) => (
              <div key={`${field.key}-${index}`} className="stream-binding-row">
                <input
                  value={field.label}
                  onChange={(e) => updateField(index, { label: e.target.value })}
                  placeholder="Rótulo"
                  aria-label="Rótulo do campo"
                />
                <input
                  value={field.key}
                  onChange={(e) => updateField(index, { key: e.target.value })}
                  placeholder="chave"
                  aria-label="Chave do campo"
                />
                <input
                  value={field.cellRef}
                  onChange={(e) => updateField(index, { cellRef: e.target.value })}
                  placeholder="Classificacao!B2"
                  aria-label="Endereço da célula"
                />
                <button type="button" className="danger" onClick={() => removeField(index)} title="Remover">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </section>

        <section className="stream-panel stream-overlay-stage">
          <div>
            <strong>Preview (estrutura)</strong>
            <ul className="stream-preview-list">
              {fields.map((field) => (
                <li key={field.key + field.cellRef}>
                  <b>{field.label || field.key}</b>
                  <span>{field.cellRef || '— sem célula —'}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>
    </div>
  )
}
