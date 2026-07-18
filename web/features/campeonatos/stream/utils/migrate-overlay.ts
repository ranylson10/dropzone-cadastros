import { createOverlayFromTemplate } from '../templates/stream-templates'
import type { StreamBlock, StreamOverlay } from '../types/stream.types'
import { FRAME_H, FRAME_W, newBlockId } from '../types/stream.types'
import { ensureCardLayers } from './card-layers'
import { unpackOverlayBlocks } from './overlay-frame'

function normalizeBlocks(blocks: any[]): StreamBlock[] {
  return (blocks || []).map((b) => {
    if (b?.type === 'card') return ensureCardLayers(b)
    return b
  })
}

/** Normaliza overlays antigos para pastas card (layers) + tabela. */
export function migrateOverlay(raw: any): StreamOverlay | null {
  if (!raw || typeof raw !== 'object') return null
  const id = String(raw.id || '')
  if (!id) return null

  if (raw.blocks != null && raw.template) {
    const packed = unpackOverlayBlocks(raw.blocks)
    const frameW = Number(raw.frameW) || packed.frameW || FRAME_W
    const frameH = Number(raw.frameH) || packed.frameH || FRAME_H
    return {
      id,
      name: String(raw.name || 'Overlay'),
      template: raw.template,
      blocks: normalizeBlocks(packed.blocks),
      frameW,
      frameH,
      updatedAt: String(raw.updatedAt || raw.updated_at || new Date().toISOString()),
      share_token: raw.share_token ? String(raw.share_token) : undefined,
      campeonato_id: raw.campeonato_id ? String(raw.campeonato_id) : undefined,
    }
  }

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
    frameW: FRAME_W,
    frameH: FRAME_H,
    blocks: normalizeBlocks(
      base.blocks.length
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
    ),
    updatedAt: String(raw.updatedAt || new Date().toISOString()),
  }
}
