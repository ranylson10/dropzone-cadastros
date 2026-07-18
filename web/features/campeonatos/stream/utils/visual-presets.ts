import type { StreamBlock, StreamCardBlock, StreamTableBlock } from '../types/stream.types'

export type VisualPresetId = 'gold_red_live' | 'dark_clean' | 'gold_soft'

export const VISUAL_PRESETS: Array<{ id: VisualPresetId; label: string; hint: string }> = [
  { id: 'gold_red_live', label: 'Ouro / vermelho live', hint: 'Como as artes de mapa e tabela' },
  { id: 'dark_clean', label: 'Dark clean', hint: 'Fundo escuro, texto claro' },
  { id: 'gold_soft', label: 'Ouro suave', hint: 'Menos contraste, faixa dourada' },
]

function applyCardGoldRed(block: StreamCardBlock): StreamCardBlock {
  return {
    ...block,
    box: {
      ...block.box,
      fill: {
        mode: block.box.fill?.mode === 'image' ? 'image' : 'solid',
        color: '#12151c',
        imageUrl: block.box.fill?.imageUrl,
        fit: 'cover',
        overlayColor: '#000000',
        overlayOpacity: 0.4,
      },
      borderColor: '#e8c547',
      borderWidth: 2,
      borderRadius: 4,
      padding: 0,
    },
    data: {
      ...block.data,
      fieldStyles: {
        ...block.data.fieldStyles,
        title: {
          text: { fontFamily: 'Rajdhani', fontWeight: 900, fontSize: 18, color: '#c62828', align: 'center', uppercase: true },
          box: { fill: { mode: 'solid', color: '#e8c547' }, padding: 8, borderRadius: 0 },
        },
        metric_primary: {
          text: { fontFamily: 'Rajdhani', fontWeight: 800, fontSize: 14, color: '#ffffff', align: 'center', uppercase: true },
          box: { fill: { mode: 'solid', color: '#c62828' }, padding: 8 },
        },
        metric_secondary: {
          text: { fontFamily: 'Rajdhani', fontWeight: 800, fontSize: 14, color: '#ffffff', align: 'center', uppercase: true },
          box: { fill: { mode: 'solid', color: '#c62828' }, padding: 8 },
        },
        metric_tertiary: {
          text: { fontFamily: 'Rajdhani', fontWeight: 800, fontSize: 14, color: '#f5e6a8', align: 'center', uppercase: true },
          box: { fill: { mode: 'solid', color: '#c62828' }, padding: 8 },
        },
      },
    },
  }
}

function applyTableGoldRed(block: StreamTableBlock): StreamTableBlock {
  return {
    ...block,
    box: {
      ...block.box,
      fill: { mode: 'solid', color: '#1a1208' },
      borderColor: '#c9a227',
      borderWidth: 2,
      borderRadius: 4,
      padding: 0,
    },
    data: {
      ...block.data,
      altRowFill: '#b71c1c',
      headerStyle: {
        text: { fontFamily: 'Rajdhani', fontWeight: 900, fontSize: 11, color: '#1a1208', align: 'center', uppercase: true },
        box: { fill: { mode: 'solid', color: '#e8c547' }, padding: 6 },
      },
      rowStyle: {
        text: { fontFamily: 'Rajdhani', fontWeight: 800, fontSize: 14, color: '#fff8e7', align: 'left', uppercase: true },
        box: { fill: { mode: 'solid', color: '#c62828' }, padding: 6 },
      },
    },
  }
}

function applyCardDark(block: StreamCardBlock): StreamCardBlock {
  return {
    ...block,
    box: {
      ...block.box,
      fill: { mode: 'solid', color: '#0e1014', opacity: 1 },
      borderColor: '#3a4150',
      borderWidth: 1,
      borderRadius: 10,
      padding: 0,
    },
    data: {
      ...block.data,
      fieldStyles: {
        title: {
          text: { fontFamily: 'Rajdhani', fontWeight: 800, fontSize: 16, color: '#ffffff', align: 'center', uppercase: true },
          box: { fill: { mode: 'solid', color: '#1c2230' }, padding: 8 },
        },
        metric_primary: {
          text: { fontFamily: 'Rajdhani', fontWeight: 700, fontSize: 14, color: '#e8c547', align: 'center' },
          box: { fill: { mode: 'solid', color: '#151922' }, padding: 8 },
        },
        metric_secondary: {
          text: { fontFamily: 'Rajdhani', fontWeight: 700, fontSize: 14, color: '#cfd6e4', align: 'center' },
          box: { fill: { mode: 'solid', color: '#151922' }, padding: 8 },
        },
      },
    },
  }
}

function applyTableDark(block: StreamTableBlock): StreamTableBlock {
  return {
    ...block,
    box: {
      ...block.box,
      fill: { mode: 'solid', color: '#0e1014' },
      borderColor: '#3a4150',
      borderWidth: 1,
      borderRadius: 8,
    },
    data: {
      ...block.data,
      altRowFill: '#151a24',
      headerStyle: {
        text: { fontFamily: 'Rajdhani', fontWeight: 800, fontSize: 11, color: '#c9a227', align: 'center', uppercase: true },
        box: { fill: { mode: 'solid', color: '#141820' }, padding: 6 },
      },
      rowStyle: {
        text: { fontFamily: 'Rajdhani', fontWeight: 700, fontSize: 13, color: '#eef1f6', align: 'left' },
        box: { fill: { mode: 'solid', color: '#10141c' }, padding: 6 },
      },
    },
  }
}

function applyCardGoldSoft(block: StreamCardBlock): StreamCardBlock {
  return {
    ...block,
    box: {
      ...block.box,
      fill: { mode: 'gradient', color: '#2a2310', colorTo: '#1a1208', angle: 160 },
      borderColor: '#c9a227',
      borderWidth: 1,
      borderRadius: 8,
    },
    data: {
      ...block.data,
      fieldStyles: {
        title: {
          text: { fontFamily: 'Rajdhani', fontWeight: 800, fontSize: 16, color: '#1a1208', align: 'center', uppercase: true },
          box: { fill: { mode: 'solid', color: '#e8c547' }, padding: 8 },
        },
        metric_primary: {
          text: { fontFamily: 'Rajdhani', fontWeight: 700, fontSize: 14, color: '#f5e6a8', align: 'center' },
          box: { fill: { mode: 'solid', color: '#3a2f14' }, padding: 8 },
        },
        metric_secondary: {
          text: { fontFamily: 'Rajdhani', fontWeight: 700, fontSize: 14, color: '#f5e6a8', align: 'center' },
          box: { fill: { mode: 'solid', color: '#3a2f14' }, padding: 8 },
        },
      },
    },
  }
}

function applyTableGoldSoft(block: StreamTableBlock): StreamTableBlock {
  return {
    ...block,
    box: {
      ...block.box,
      fill: { mode: 'solid', color: '#1a1208' },
      borderColor: '#c9a227',
      borderWidth: 1,
      borderRadius: 8,
    },
    data: {
      ...block.data,
      altRowFill: '#241a0c',
      headerStyle: {
        text: { fontFamily: 'Rajdhani', fontWeight: 800, fontSize: 11, color: '#1a1208', align: 'center', uppercase: true },
        box: { fill: { mode: 'solid', color: '#e8c547' }, padding: 6 },
      },
      rowStyle: {
        text: { fontFamily: 'Rajdhani', fontWeight: 700, fontSize: 13, color: '#f5e6a8', align: 'left' },
        box: { fill: { mode: 'solid', color: '#2a1f0c' }, padding: 6 },
      },
    },
  }
}

export function applyVisualPresetToBlock(block: StreamBlock, preset: VisualPresetId): StreamBlock {
  if (block.type === 'card') {
    if (preset === 'gold_red_live') return applyCardGoldRed(block)
    if (preset === 'dark_clean') return applyCardDark(block)
    return applyCardGoldSoft(block)
  }
  if (preset === 'gold_red_live') return applyTableGoldRed(block)
  if (preset === 'dark_clean') return applyTableDark(block)
  return applyTableGoldSoft(block)
}

export function applyVisualPresetToOverlayBlocks(blocks: StreamBlock[], preset: VisualPresetId): StreamBlock[] {
  return blocks.map((b) => applyVisualPresetToBlock(b, preset))
}
