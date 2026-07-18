'use client'

import { useEffect, useState } from 'react'
import { ExternalLink, Pencil, Plus, Trash2 } from 'lucide-react'
import {
  listLocalOverlays,
  removeLocalOverlay,
} from '../services/stream-data.service'
import { TEMPLATE_LABEL } from '../templates/stream-templates'
import type { StreamOverlay } from '../types/stream.types'

function openInNewTab(path: string) {
  window.open(path, '_blank', 'noopener,noreferrer')
}

export function StreamOverlaysHub(props: { campeonatoId: string }) {
  const [overlays, setOverlays] = useState<StreamOverlay[]>([])

  function reload() {
    setOverlays(listLocalOverlays(props.campeonatoId))
  }

  useEffect(() => {
    reload()
    const onFocus = () => reload()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [props.campeonatoId])

  function handleDelete(id: string, name: string) {
    if (!window.confirm(`Excluir overlay "${name}"?`)) return
    removeLocalOverlay(props.campeonatoId, id)
    reload()
  }

  const base = `/campeonatos/${props.campeonatoId}/stream`

  return (
    <section className="stream-panel" aria-label="Lista de overlays">
      <div className="stream-panel-title">
        <div>
          <h4>Overlays</h4>
          <p className="stream-hint">
            Modelos com cards e tabelas. Criar/editar abre o gerador de caracteres em tela cheia.
          </p>
        </div>
        <div className="stream-panel-actions">
          <button type="button" className="stream-primary-btn" onClick={() => openInNewTab(`${base}/overlays/novo`)}>
            <Plus size={15} /> Nova overlay
          </button>
        </div>
      </div>

      {overlays.length === 0 ? (
        <div className="stream-empty-list">
          <strong>Nenhuma overlay ainda</strong>
          <p>Use um modelo: cards de mapas, tabela de classificação ou MVP + lista.</p>
        </div>
      ) : (
        <div className="stream-overlay-table-wrap">
          <table className="stream-overlay-table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Modelo</th>
                <th>Blocos</th>
                <th>Atualizado</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {overlays.map((item) => (
                <tr key={item.id}>
                  <td><strong>{item.name}</strong></td>
                  <td>{TEMPLATE_LABEL[item.template] || item.template}</td>
                  <td>{item.blocks?.length || 0}</td>
                  <td>{item.updatedAt ? new Date(item.updatedAt).toLocaleString('pt-BR') : '—'}</td>
                  <td className="stream-overlay-actions">
                    <button type="button" title="Editar" onClick={() => openInNewTab(`${base}/overlays/${item.id}`)}>
                      <Pencil size={14} />
                    </button>
                    <button type="button" className="danger" title="Excluir" onClick={() => handleDelete(item.id, item.name)}>
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="stream-hub-links">
        <button type="button" className="stream-secondary-btn" onClick={() => openInNewTab(base)}>
          <ExternalLink size={15} /> Abrir planilha em tela cheia
        </button>
      </div>
    </section>
  )
}
