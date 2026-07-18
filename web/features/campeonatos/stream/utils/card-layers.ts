import {
  DEFAULT_TEXT,
  DEFAULT_TRANSITION,
  newBlockId,
  newLayerId,
  type LayerContentType,
  type StreamCardBlock,
  type StreamLayer,
} from '../types/stream.types'

/** Converte camada legada (% do card) → pixels. */
export function layerPctToPx(layer: StreamLayer, canvasW: number, canvasH: number): StreamLayer {
  const cw = Math.max(1, canvasW)
  const ch = Math.max(1, canvasH)
  return {
    ...layer,
    x: Math.round(((Number(layer.x) || 0) / 100) * cw),
    y: Math.round(((Number(layer.y) || 0) / 100) * ch),
    w: Math.max(1, Math.round(((Number(layer.w) || 0) / 100) * cw)),
    h: Math.max(1, Math.round(((Number(layer.h) || 0) / 100) * ch)),
  }
}

/** 5 itens pré-montados do card de mapa — medidas em px (canvas 280×220). */
export function defaultMapCardLayers(mapSlot: number, _title: string): StreamLayer[] {
  const layers: StreamLayer[] = [
    {
      id: newLayerId(),
      name: 'Imagem do mapa',
      type: 'image',
      x: 0,
      y: 0,
      w: 280,
      h: 136,
      z: 1,
      objectFit: 'cover',
      data: { source: 'map_image', mapSlot },
      style: { box: { fill: { mode: 'solid', color: '#1a1d24' } } },
    },
    {
      id: newLayerId(),
      name: 'Logo',
      type: 'logo',
      x: 90,
      y: 26,
      w: 100,
      h: 80,
      z: 3,
      objectFit: 'contain',
      data: { source: 'map_logo', mapSlot },
    },
    {
      id: newLayerId(),
      name: 'Nome do mapa',
      type: 'text',
      x: 0,
      y: 136,
      w: 280,
      h: 35,
      z: 4,
      data: { source: 'map_name', mapSlot },
      style: {
        text: { ...DEFAULT_TEXT, fontSize: 16, color: '#c62828', align: 'center' },
        box: { fill: { mode: 'solid', color: '#e8c547' }, padding: 4, borderRadius: 0 },
      },
    },
    {
      id: newLayerId(),
      name: 'Pontos',
      type: 'number',
      x: 0,
      y: 171,
      w: 140,
      h: 48,
      z: 4,
      data: { source: 'map_pts', mapSlot },
      style: {
        text: { ...DEFAULT_TEXT, fontSize: 14, color: '#ffffff', align: 'center' },
        box: { fill: { mode: 'solid', color: '#c62828' }, padding: 4 },
      },
    },
    {
      id: newLayerId(),
      name: 'Abates',
      type: 'number',
      x: 140,
      y: 171,
      w: 140,
      h: 48,
      z: 4,
      data: { source: 'map_abates', mapSlot },
      style: {
        text: { ...DEFAULT_TEXT, fontSize: 14, color: '#ffffff', align: 'center' },
        box: { fill: { mode: 'solid', color: '#c62828' }, padding: 4 },
      },
    },
  ]
  return layers
}

/** MVP card — px no canvas 240×320. */
export function defaultMvpCardLayers(rank = 1): StreamLayer[] {
  const layers: StreamLayer[] = [
    {
      id: newLayerId(),
      name: 'Foto / logo',
      type: 'logo',
      x: 19,
      y: 32,
      w: 202,
      h: 176,
      z: 2,
      objectFit: 'contain',
      data: { source: 'mvp', rank, field: 'logo' },
    },
    {
      id: newLayerId(),
      name: 'Nick',
      type: 'text',
      x: 14,
      y: 218,
      w: 211,
      h: 38,
      z: 3,
      data: { source: 'mvp', rank, field: 'nome' },
      style: {
        text: { ...DEFAULT_TEXT, fontSize: 16, color: '#ffffff', align: 'left' },
      },
    },
    {
      id: newLayerId(),
      name: 'Abates',
      type: 'number',
      x: 14,
      y: 262,
      w: 67,
      h: 38,
      z: 3,
      data: { source: 'mvp', rank, field: 'abates' },
      style: { text: { ...DEFAULT_TEXT, fontSize: 13, color: '#f5e6a8', align: 'center' } },
    },
    {
      id: newLayerId(),
      name: 'K.D',
      type: 'number',
      x: 86,
      y: 262,
      w: 67,
      h: 38,
      z: 3,
      data: { source: 'mvp', rank, field: 'kd' },
      style: { text: { ...DEFAULT_TEXT, fontSize: 13, color: '#f5e6a8', align: 'center' } },
    },
    {
      id: newLayerId(),
      name: 'Quedas',
      type: 'number',
      x: 158,
      y: 262,
      w: 67,
      h: 38,
      z: 3,
      data: { source: 'mvp', rank, field: 'quedas' },
      style: { text: { ...DEFAULT_TEXT, fontSize: 13, color: '#f5e6a8', align: 'center' } },
    },
  ]
  return layers
}

/** Quadrado vazio — sem mapa/template. Usuário define nome, pos, tamanho, fundo e conteúdo. */
export function createEmptyCard(name = 'Bloco', opts?: { x?: number; y?: number; w?: number; h?: number }): StreamCardBlock {
  return {
    id: newBlockId(),
    type: 'card',
    name,
    x: opts?.x ?? 40,
    y: opts?.y ?? 40,
    canvasW: opts?.w ?? 240,
    canvasH: opts?.h ?? 160,
    layerLayout: 'px',
    box: {
      fill: { mode: 'none', color: 'transparent', opacity: 1 },
      borderColor: '#c9a227',
      borderWidth: 1,
      borderRadius: 4,
      padding: 0,
    },
    transition: { ...DEFAULT_TRANSITION, enter: 'fade' },
    layers: [],
  }
}

/** @deprecated prefira createEmptyCard — mantido para templates legados. */
export function createMapCardFolder(mapSlot: number, title: string): StreamCardBlock {
  return {
    id: newBlockId(),
    type: 'card',
    name: `Mapa ${mapSlot}`,
    x: 40 + (mapSlot - 1) * 24,
    y: 40 + (mapSlot - 1) * 24,
    canvasW: 280,
    canvasH: 220,
    layerLayout: 'px',
    box: {
      fill: { mode: 'solid', color: '#0e1014' },
      borderColor: '#e8c547',
      borderWidth: 2,
      borderRadius: 4,
      padding: 0,
    },
    transition: { ...DEFAULT_TRANSITION, enter: 'stagger', delayMs: (mapSlot - 1) * 100 },
    layers: defaultMapCardLayers(mapSlot, title),
  }
}

export function createMvpCardFolder(): StreamCardBlock {
  return {
    id: newBlockId(),
    type: 'card',
    name: 'MVP destaque',
    x: 40,
    y: 40,
    canvasW: 240,
    canvasH: 320,
    layerLayout: 'px',
    box: {
      fill: { mode: 'gradient', color: '#8b0000', colorTo: '#c62828', angle: 160 },
      borderColor: '#e8c547',
      borderWidth: 3,
      borderRadius: 8,
      padding: 0,
    },
    transition: { ...DEFAULT_TRANSITION, enter: 'scale' },
    layers: defaultMvpCardLayers(1),
  }
}

/** Normaliza card: camadas em px; migra overlays antigos (% → px). */
export function ensureCardLayers(card: any): StreamCardBlock {
  if (card?.type !== 'card') return card

  // Já no modelo novo (com layers array, inclusive vazio)
  if (Array.isArray(card.layers)) {
    const canvasW = Number(card.canvasW) || 240
    const canvasH = Number(card.canvasH) || 160
    let layers = card.layers as StreamLayer[]
    let layerLayout: 'px' = 'px'
    // legado: sem layerLayout → coordenadas em % do bloco
    if (card.layerLayout !== 'px' && layers.length) {
      layers = layers.map((l) => layerPctToPx(l, canvasW, canvasH))
    }
    return {
      ...card,
      x: Number(card.x) || 0,
      y: Number(card.y) || 0,
      canvasW,
      canvasH,
      layerLayout,
      layers,
    }
  }

  // Legado sem layers: só monta mapa/MVP se tinha data.variant
  const data = card.data || {}
  const slot = Number(data.mapSlot || 1)
  const title = String(data.titleFixed || `Mapa ${slot}`)
  if (data.variant === 'mvp_hero') {
    return {
      id: card.id,
      type: 'card',
      name: card.name || 'MVP',
      x: Number(card.x) || 40,
      y: Number(card.y) || 40,
      canvasW: 240,
      canvasH: 320,
      layerLayout: 'px',
      box: card.box,
      transition: card.transition || { ...DEFAULT_TRANSITION },
      layers: defaultMvpCardLayers(Number(data.rank || 1)),
      data,
    }
  }
  if (data.variant === 'map_result' || data.mapSlot != null) {
    return {
      id: card.id,
      type: 'card',
      name: card.name || `Mapa ${slot}`,
      x: Number(card.x) || 40,
      y: Number(card.y) || 40,
      canvasW: 280,
      canvasH: 220,
      layerLayout: 'px',
      box: card.box,
      transition: card.transition || { ...DEFAULT_TRANSITION },
      layers: defaultMapCardLayers(slot, title),
      data,
    }
  }

  // Card sem layers e sem data de mapa → quadrado vazio
  return {
    id: card.id,
    type: 'card',
    name: card.name || 'Bloco',
    x: Number(card.x) || 40,
    y: Number(card.y) || 40,
    canvasW: Number(card.canvasW) || 240,
    canvasH: Number(card.canvasH) || 160,
    layerLayout: 'px',
    box: card.box,
    transition: card.transition || { ...DEFAULT_TRANSITION },
    layers: [],
  }
}

export function duplicateCardFolder(card: StreamCardBlock, _nextSlot?: number): StreamCardBlock {
  const remap = (layer: StreamLayer): StreamLayer => ({
    ...layer,
    id: newLayerId(),
  })
  return {
    ...card,
    id: newBlockId(),
    name: `${card.name} cópia`,
    x: (card.x ?? 40) + 24,
    y: (card.y ?? 40) + 24,
    layerLayout: 'px',
    layers: (card.layers || []).map(remap),
  }
}

/** Novo item vazio — medidas em px (bloco típico 240×160). */
export function createDefaultLayer(type: LayerContentType, _mapSlot = 1): StreamLayer {
  if (type === 'image') {
    return {
      id: newLayerId(),
      name: 'Imagem livre',
      type: 'image',
      x: 40,
      y: 20,
      w: 160,
      h: 120,
      z: 2,
      objectFit: 'contain',
      data: { source: 'fixed', value: '' },
      style: { box: { fill: { mode: 'solid', color: 'transparent' }, padding: 0 } },
    }
  }
  if (type === 'logo') {
    return {
      id: newLayerId(),
      name: 'Logo / arte',
      type: 'logo',
      x: 70,
      y: 30,
      w: 100,
      h: 100,
      z: 3,
      objectFit: 'contain',
      data: { source: 'fixed', value: '' },
      style: { box: { fill: { mode: 'solid', color: 'transparent' }, padding: 0 } },
    }
  }
  if (type === 'number') {
    return {
      id: newLayerId(),
      name: 'Número',
      type: 'number',
      x: 20,
      y: 20,
      w: 96,
      h: 40,
      z: 5,
      data: { source: 'fixed', value: '0' },
      style: {
        text: { ...DEFAULT_TEXT, fontSize: 16, color: '#fff', align: 'center' },
        box: { fill: { mode: 'solid', color: '#c62828' }, padding: 4 },
      },
    }
  }
  return {
    id: newLayerId(),
    name: 'Texto livre',
    type: 'text',
    x: 20,
    y: 60,
    w: 200,
    h: 40,
    z: 5,
    data: { source: 'fixed', value: 'TABELA GERAL' },
    style: {
      text: { ...DEFAULT_TEXT, fontSize: 18, color: '#ffffff', align: 'center' },
      box: { fill: { mode: 'solid', color: 'transparent' }, padding: 4 },
    },
  }
}
