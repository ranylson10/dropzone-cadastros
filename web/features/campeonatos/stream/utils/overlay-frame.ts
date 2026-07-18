import { FRAME_H, FRAME_W, type StreamBlock } from '../types/stream.types'

/** Envelope JSONB de blocks no banco (v3) com tamanho do frame. */
export type PackedOverlayBlocks = {
  v: 3
  frameW: number
  frameH: number
  items: StreamBlock[]
}

export function unpackOverlayBlocks(raw: unknown): {
  blocks: StreamBlock[]
  frameW: number
  frameH: number
} {
  if (Array.isArray(raw)) {
    return { blocks: raw as StreamBlock[], frameW: FRAME_W, frameH: FRAME_H }
  }
  if (raw && typeof raw === 'object') {
    const o = raw as Record<string, unknown>
    if (Array.isArray(o.items)) {
      return {
        blocks: o.items as StreamBlock[],
        frameW: Math.max(64, Number(o.frameW) || FRAME_W),
        frameH: Math.max(64, Number(o.frameH) || FRAME_H),
      }
    }
  }
  return { blocks: [], frameW: FRAME_W, frameH: FRAME_H }
}

export function packOverlayBlocks(
  blocks: StreamBlock[],
  frameW?: number,
  frameH?: number,
): PackedOverlayBlocks {
  return {
    v: 3,
    frameW: Math.max(64, Number(frameW) || FRAME_W),
    frameH: Math.max(64, Number(frameH) || FRAME_H),
    items: blocks || [],
  }
}
