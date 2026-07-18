import { createOverlayFromTemplate } from '../templates/stream-templates'
import type { StreamOverlay } from '../types/stream.types'
import { newBlockId } from '../types/stream.types'

/** Normaliza overlays antigos (fields/kind) para o modelo de blocos. */
export function migrateOverlay(raw: any): StreamOverlay | null {
  if (!raw || typeof raw !== 'object') return null
  const id = String(raw.id || '')
  if (!id) return null

  if (Array.isArray(raw.blocks) && raw.blocks.length >= 0 && raw.template) {
    return {
      id,
      name: String(raw.name || 'Overlay'),
      template: raw.template,
      blocks: raw.blocks,
      updatedAt: String(raw.updatedAt || new Date().toISOString()),
    }
  }

  // legado: kind + fields → custom vazio ou standings se nome indicar
  const kind = String(raw.kind || '')
  let template: StreamOverlay['template'] = 'custom'
  if (kind === 'standings') template = 'standings'
  else if (kind === 'scoreboard') template = 'map_cards'
  else if (kind === 'lower_third') template = 'mvp_combo'

  const base = createOverlayFromTemplate(template, String(raw.name || 'Overlay'))
  return {
    id,
    name: base.name,
    template: base.template,
    blocks: base.blocks.length
      ? base.blocks
      : [
          {
            id: newBlockId(),
            type: 'table',
            name: 'Tabela',
            box: {
              fill: { mode: 'solid', color: '#1a1d24' },
              borderColor: '#c9a227',
              borderWidth: 2,
              borderRadius: 6,
              padding: 0,
            },
            transition: { enter: 'fade', onDataChange: 'pulse', durationMs: 400, delayMs: 0 },
            data: {
              variant: 'standings',
              source: 'classificacao',
              rows: 10,
              startRank: 1,
              columns: ['pos', 'nome', 'pts', 'abates'],
            },
          },
        ],
    updatedAt: String(raw.updatedAt || new Date().toISOString()),
  }
}
