import type { StreamBlock, StreamCardBlock, StreamLayer, StreamTableBlock } from '../types/stream.types'
import { DEFAULT_TEXT } from '../types/stream.types'

export type VisualPresetId = 'gold_red_live' | 'dark_clean' | 'gold_soft'

export const VISUAL_PRESETS: Array<{ id: VisualPresetId; label: string; hint: string }> = [
  { id: 'gold_red_live', label: 'Ouro / vermelho live', hint: 'Como as artes de mapa e tabela' },
  { id: 'dark_clean', label: 'Dark clean', hint: 'Fundo escuro, texto claro' },
  { id: 'gold_soft', label: 'Ouro suave', hint: 'Menos contraste, faixa dourada' },
]

function restyleLayer(layer: StreamLayer, preset: VisualPresetId): StreamLayer {
  if (layer.type === 'image') return layer
  if (layer.type === 'logo') return layer
  if (preset === 'gold_red_live') {
    if (layer.type === 'text') {
      return {
        ...layer,
        style: {
          text: { ...DEFAULT_TEXT, fontSize: 16, color: '#c62828', align: 'center' },
          box: { fill: { mode: 'solid', color: '#e8c547' }, padding: 4 },
        },
      }
    }
    return {
      ...layer,
      style: {
        text: { ...DEFAULT_TEXT, fontSize: 14, color: '#ffffff', align: 'center' },
        box: { fill: { mode: 'solid', color: '#c62828' }, padding: 4 },
      },
    }
  }
  if (preset === 'dark_clean') {
    return {
      ...layer,
      style: {
        text: { ...DEFAULT_TEXT, fontSize: 14, color: layer.type === 'text' ? '#fff' : '#e8c547', align: 'center' },
        box: { fill: { mode: 'solid', color: '#151922' }, padding: 4 },
      },
    }
  }
  return {
    ...layer,
    style: {
      text: { ...DEFAULT_TEXT, fontSize: 14, color: layer.type === 'text' ? '#1a1208' : '#f5e6a8', align: 'center' },
      box: { fill: { mode: 'solid', color: layer.type === 'text' ? '#e8c547' : '#3a2f14' }, padding: 4 },
    },
  }
}

function applyCard(block: StreamCardBlock, preset: VisualPresetId): StreamCardBlock {
  const border = preset === 'dark_clean' ? '#3a4150' : '#e8c547'
  const fill =
    preset === 'dark_clean'
      ? { mode: 'solid' as const, color: '#0e1014' }
      : preset === 'gold_soft'
        ? { mode: 'gradient' as const, color: '#2a2310', colorTo: '#1a1208', angle: 160 }
        : { mode: 'solid' as const, color: '#0e1014' }
  return {
    ...block,
    box: { ...block.box, fill, borderColor: border, borderWidth: preset === 'dark_clean' ? 1 : 2, borderRadius: 4 },
    layers: (block.layers || []).map((l) => restyleLayer(l, preset)),
  }
}

function applyTable(block: StreamTableBlock, preset: VisualPresetId): StreamTableBlock {
  if (preset === 'gold_red_live') {
    return {
      ...block,
      box: { ...block.box, fill: { mode: 'solid', color: '#1a1208' }, borderColor: '#c9a227', borderWidth: 2 },
      data: {
        ...block.data,
        altRowFill: '#b71c1c',
        headerStyle: {
          text: { ...DEFAULT_TEXT, fontSize: 11, color: '#1a1208', align: 'center' },
          box: { fill: { mode: 'solid', color: '#e8c547' }, padding: 6 },
        },
        rowStyle: {
          text: { ...DEFAULT_TEXT, fontSize: 14, color: '#fff8e7', align: 'left' },
          box: { fill: { mode: 'solid', color: '#c62828' }, padding: 6 },
        },
      },
    }
  }
  if (preset === 'dark_clean') {
    return {
      ...block,
      box: { ...block.box, fill: { mode: 'solid', color: '#0e1014' }, borderColor: '#3a4150', borderWidth: 1 },
      data: {
        ...block.data,
        altRowFill: '#151a24',
        headerStyle: {
          text: { ...DEFAULT_TEXT, fontSize: 11, color: '#c9a227', align: 'center' },
          box: { fill: { mode: 'solid', color: '#141820' }, padding: 6 },
        },
        rowStyle: {
          text: { ...DEFAULT_TEXT, fontSize: 13, color: '#eef1f6', align: 'left' },
          box: { fill: { mode: 'solid', color: '#10141c' }, padding: 6 },
        },
      },
    }
  }
  return {
    ...block,
    box: { ...block.box, fill: { mode: 'solid', color: '#1a1208' }, borderColor: '#c9a227' },
    data: {
      ...block.data,
      altRowFill: '#241a0c',
      headerStyle: {
        text: { ...DEFAULT_TEXT, fontSize: 11, color: '#1a1208', align: 'center' },
        box: { fill: { mode: 'solid', color: '#e8c547' }, padding: 6 },
      },
      rowStyle: {
        text: { ...DEFAULT_TEXT, fontSize: 13, color: '#f5e6a8', align: 'left' },
        box: { fill: { mode: 'solid', color: '#2a1f0c' }, padding: 6 },
      },
    },
  }
}

export function applyVisualPresetToBlock(block: StreamBlock, preset: VisualPresetId): StreamBlock {
  if (block.type === 'card') return applyCard(block, preset)
  return applyTable(block, preset)
}

export function applyVisualPresetToOverlayBlocks(blocks: StreamBlock[], preset: VisualPresetId): StreamBlock[] {
  return blocks.map((b) => applyVisualPresetToBlock(b, preset))
}
