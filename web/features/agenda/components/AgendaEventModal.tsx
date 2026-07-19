'use client'

import { useEffect, useState } from 'react'
import { SystemModal } from '@/components/layout/SystemModal'
import { Field } from '@/features/dropzone/components/form-fields'
import {
  AGENDA_COLORS,
  AGENDA_TIPOS,
  type AgendaEventForm,
  type AgendaItem,
} from '../types/agenda.types'

const EMPTY_FORM: AgendaEventForm = {
  titulo: '',
  descricao: '',
  data_evento: '',
  horario_inicio: '18:00',
  horario_fim: '20:00',
  cor: '#3b82f6',
  tipo: 'livre',
  visibilidade: 'privada',
  campeonato_id: '',
  equipe_id: '',
}

function itemToForm(item: AgendaItem): AgendaEventForm {
  return {
    id: item.source === 'livre' ? item.id : undefined,
    titulo: item.titulo,
    descricao: item.descricao || '',
    data_evento: item.data,
    horario_inicio: item.horario_inicio,
    horario_fim: item.horario_fim || '',
    cor: item.cor || '#3b82f6',
    tipo: item.tipo === 'jogo' ? 'livre' : item.tipo || 'livre',
    visibilidade: item.visibilidade || 'privada',
    campeonato_id: item.meta.campeonato_id || '',
    equipe_id: item.meta.equipe_id || '',
  }
}

export function AgendaEventModal({
  open,
  mode,
  item,
  defaults,
  saving,
  onClose,
  onSave,
  onDelete,
}: {
  open: boolean
  mode: 'create' | 'edit' | 'view'
  item?: AgendaItem | null
  defaults?: Partial<AgendaEventForm>
  saving?: boolean
  onClose: () => void
  onSave: (form: AgendaEventForm) => Promise<void> | void
  onDelete?: (id: string) => Promise<void> | void
}) {
  const [form, setForm] = useState<AgendaEventForm>(EMPTY_FORM)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setError('')
    if (item) {
      setForm(itemToForm(item))
      return
    }
    setForm({
      ...EMPTY_FORM,
      ...defaults,
      data_evento: defaults?.data_evento || new Date().toISOString().slice(0, 10),
      horario_inicio: defaults?.horario_inicio || '18:00',
      horario_fim: defaults?.horario_fim || '20:00',
      cor: defaults?.cor || '#3b82f6',
    })
  }, [open, item, defaults])

  const isJogo = item?.source === 'jogo'
  const readOnly = mode === 'view' || isJogo
  const title = isJogo
    ? 'Jogo do campeonato'
    : mode === 'create'
      ? 'Novo compromisso'
      : mode === 'edit'
        ? 'Editar agenda'
        : 'Detalhe do compromisso'

  async function handleSave() {
    setError('')
    try {
      if (!form.titulo.trim()) throw new Error('Informe o título.')
      if (!form.data_evento) throw new Error('Informe a data.')
      if (!form.horario_inicio) throw new Error('Informe o horário de início.')
      await onSave(form)
    } catch (err: any) {
      setError(err?.message || 'Não foi possível salvar.')
    }
  }

  async function handleDelete() {
    if (!form.id || !onDelete) return
    if (!window.confirm('Excluir este compromisso da agenda?')) return
    setError('')
    try {
      await onDelete(form.id)
    } catch (err: any) {
      setError(err?.message || 'Não foi possível excluir.')
    }
  }

  return (
    <SystemModal
      open={open}
      onClose={onClose}
      title={title}
      description={
        isJogo
          ? 'Compromisso gerado automaticamente a partir do calendário de jogos.'
          : 'Selecione data e horários para bloquear sua agenda.'
      }
      size="large"
    >
      {readOnly && item ? (
        <div className="agenda-detail">
          <div className="agenda-detail-badge">
            <i className="agenda-detail-dot" style={{ background: item.cor }} />
            {item.source === 'jogo' ? 'Jogo' : item.tipo}
          </div>
          <div className="agenda-detail-row">
            <small>Título</small>
            <strong>{item.titulo}</strong>
          </div>
          <div className="agenda-detail-row">
            <small>Data</small>
            <strong>{formatDateBr(item.data)}</strong>
          </div>
          <div className="agenda-detail-row">
            <small>Horário</small>
            <strong>
              {item.horario_inicio}
              {item.horario_fim ? ` — ${item.horario_fim}` : ''}
            </strong>
          </div>
          {item.meta.campeonato_nome ? (
            <div className="agenda-detail-row">
              <small>Campeonato</small>
              <strong>{item.meta.campeonato_nome}</strong>
            </div>
          ) : null}
          {item.meta.numero_partidas ? (
            <div className="agenda-detail-row">
              <small>Quedas</small>
              <strong>{item.meta.numero_partidas}</strong>
            </div>
          ) : null}
          {item.meta.status ? (
            <div className="agenda-detail-row">
              <small>Status</small>
              <strong>{item.meta.status}</strong>
            </div>
          ) : null}
          {item.descricao ? (
            <div className="agenda-detail-row">
              <small>Detalhes</small>
              <strong>{item.descricao}</strong>
            </div>
          ) : null}
          {item.meta.href ? (
            <div className="agenda-form-actions">
              <a className="button" href={item.meta.href}>
                Abrir campeonato
              </a>
              <button type="button" className="button secondary" onClick={onClose}>
                Fechar
              </button>
            </div>
          ) : (
            <div className="agenda-form-actions">
              {item.editable && onDelete ? (
                <button type="button" className="button danger" onClick={() => void handleDelete()}>
                  Excluir
                </button>
              ) : null}
              {item.editable ? (
                <button
                  type="button"
                  className="button"
                  onClick={() => {
                    /* parent should switch mode via reopening */
                  }}
                  style={{ display: 'none' }}
                />
              ) : null}
              <button type="button" className="button secondary" onClick={onClose}>
                Fechar
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="agenda-form">
          <Field label="Título">
            <input
              value={form.titulo}
              onChange={(e) => setForm((c) => ({ ...c, titulo: e.target.value }))}
              placeholder="Ex.: Treino da line, Scrim, Reunião"
              maxLength={120}
            />
          </Field>

          <div className="agenda-form-grid three">
            <Field label="Data">
              <input
                type="date"
                value={form.data_evento}
                onChange={(e) => setForm((c) => ({ ...c, data_evento: e.target.value }))}
              />
            </Field>
            <Field label="Início">
              <input
                type="time"
                value={form.horario_inicio}
                onChange={(e) => setForm((c) => ({ ...c, horario_inicio: e.target.value }))}
              />
            </Field>
            <Field label="Fim">
              <input
                type="time"
                value={form.horario_fim}
                onChange={(e) => setForm((c) => ({ ...c, horario_fim: e.target.value }))}
              />
            </Field>
          </div>

          <div className="agenda-form-grid">
            <Field label="Tipo">
              <select
                value={form.tipo}
                onChange={(e) => setForm((c) => ({ ...c, tipo: e.target.value }))}
              >
                {AGENDA_TIPOS.map((tipo) => (
                  <option key={tipo.value} value={tipo.value}>
                    {tipo.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Visibilidade">
              <select
                value={form.visibilidade}
                onChange={(e) => setForm((c) => ({ ...c, visibilidade: e.target.value }))}
              >
                <option value="privada">Privada (só você)</option>
                <option value="equipe">Equipe vinculada</option>
                <option value="campeonato">Campeonato vinculado</option>
                <option value="publica">Pública</option>
              </select>
            </Field>
          </div>

          <Field label="Cor no calendário">
            <div className="agenda-color-row">
              {AGENDA_COLORS.map((color) => (
                <button
                  key={color.value}
                  type="button"
                  title={color.label}
                  className={`agenda-color-swatch ${form.cor === color.value ? 'is-active' : ''}`}
                  style={{ background: color.value }}
                  onClick={() => setForm((c) => ({ ...c, cor: color.value }))}
                />
              ))}
            </div>
          </Field>

          <Field label="Descrição (opcional)">
            <textarea
              rows={3}
              value={form.descricao}
              onChange={(e) => setForm((c) => ({ ...c, descricao: e.target.value }))}
              placeholder="Detalhes, link da sala, observações..."
              maxLength={500}
            />
          </Field>

          {error ? <div className="agenda-error">{error}</div> : null}

          <div className="agenda-form-actions">
            {mode === 'edit' && form.id && onDelete ? (
              <button
                type="button"
                className="button danger"
                disabled={saving}
                onClick={() => void handleDelete()}
              >
                Excluir
              </button>
            ) : null}
            <button type="button" className="button secondary" onClick={onClose} disabled={saving}>
              Cancelar
            </button>
            <button type="button" className="button" disabled={saving} onClick={() => void handleSave()}>
              {saving ? 'Salvando...' : 'Salvar na agenda'}
            </button>
          </div>
        </div>
      )}
    </SystemModal>
  )
}

function formatDateBr(value: string) {
  const [y, m, d] = String(value).slice(0, 10).split('-')
  if (!y || !m || !d) return value
  return `${d}/${m}/${y}`
}
