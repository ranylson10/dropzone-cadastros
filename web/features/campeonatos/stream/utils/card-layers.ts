import {
  DEFAULT_TEXT,
  DEFAULT_TRANSITION,
  newBlockId,
  newLayerId,
  type LayerContentType,
  type StreamCardBlock,
  type StreamLayer,
} from '../types/stream.types'

/** 5 itens pré-montados do card de mapa (pasta GT). */
export function defaultMapCardLayers(mapSlot: number, _title: string): StreamLayer[] {
  const layers: StreamLayer[] = [
    {
      id: newLayerId(),
      name: 'Imagem do mapa',
      type: 'image',
      x: 0,
      y: 0,
      w: 100,
      h: 62,
      z: 1,
      objectFit: 'cover',
      data: { source: 'map_image', mapSlot },
      style: { box: { fill: { mode: 'solid', color: '#1a1d24' } } },
    },
    {
      id: newLayerId(),
      name: 'Logo',
      type: 'logo',
      x: 32,
      y: 12,
      w: 36,
      h: 36,
      z: 3,
      objectFit: 'contain',
      data: { source: 'map_logo', mapSlot },
    },
    {
      id: newLayerId(),
      name: 'Nome do mapa',
      type: 'text',
      x: 0,
      y: 62,
      w: 100,
      h: 16,
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
      y: 78,
      w: 50,
      h: 22,
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
      x: 50,
      y: 78,
      w: 50,
      h: 22,
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

export function defaultMvpCardLayers(rank = 1): StreamLayer[] {
  const layers: StreamLayer[] = [
    {
      id: newLayerId(),
      name: 'Foto / logo',
      type: 'logo',
      x: 8,
      y: 10,
      w: 84,
      h: 55,
      z: 2,
      objectFit: 'contain',
      data: { source: 'mvp', rank, field: 'logo' },
    },
    {
      id: newLayerId(),
      name: 'Nick',
      type: 'text',
      x: 6,
      y: 68,
      w: 88,
      h: 12,
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
      x: 6,
      y: 82,
      w: 28,
      h: 12,
      z: 3,
      data: { source: 'mvp', rank, field: 'abates' },
      style: { text: { ...DEFAULT_TEXT, fontSize: 13, color: '#f5e6a8', align: 'center' } },
    },
    {
      id: newLayerId(),
      name: 'K.D',
      type: 'number',
      x: 36,
      y: 82,
      w: 28,
      h: 12,
      z: 3,
      data: { source: 'mvp', rank, field: 'kd' },
      style: { text: { ...DEFAULT_TEXT, fontSize: 13, color: '#f5e6a8', align: 'center' } },
    },
    {
      id: newLayerId(),
      name: 'Quedas',
      type: 'number',
      x: 66,
      y: 82,
      w: 28,
      h: 12,
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
    box: {
      fill: { mode: 'solid', color: 'rgba(18, 20, 28, 0.85)' },
      borderColor: '#c9a227',
      borderWidth: 2,
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

/** Normaliza card: preserva layers vazias (não injeta mapa). */
export function ensureCardLayers(card: any): StreamCardBlock {
  if (card?.type !== 'card') return card

  // Já no modelo novo (com layers array, inclusive vazio)
  if (Array.isArray(card.layers)) {
    return {
      ...card,
      x: Number(card.x) || 0,
      y: Number(card.y) || 0,
      canvasW: Number(card.canvasW) || 240,
      canvasH: Number(card.canvasH) || 160,
      layers: card.layers as StreamLayer[],
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
    layers: (card.layers || []).map(remap),
  }
}

/** Novo item vazio — sem vínculo de mapa automático. */
export function createDefaultLayer(type: LayerContentType, _mapSlot = 1): StreamLayer {
  const base = { id: newLayerId(), x: 8, y: 8, w: 40, h: 24, z: 5 }
  if (type === 'image') {
    return {
      ...base,
      name: 'Imagem',
      type: 'image',
      w: 100,
      h: 55,
      x: 0,
      y: 0,
      z: 1,
      objectFit: 'cover',
      data: { source: 'fixed', value: '' },
      style: { box: { fill: { mode: 'solid', color: '#2a2f3a' } } },
    }
  }
  if (type === 'logo') {
    return {
      ...base,
      name: 'Logo',
      type: 'logo',
      w: 28,
      h: 28,
      x: 36,
      y: 12,
      z: 3,
      objectFit: 'contain',
      data: { source: 'fixed', value: '' },
    }
  }
  if (type === 'number') {
    return {
      ...base,
      name: 'Número',
      type: 'number',
      data: { source: 'fixed', value: '0' },
      style: {
        text: { ...DEFAULT_TEXT, fontSize: 16, color: '#fff', align: 'center' },
        box: { fill: { mode: 'solid', color: '#c62828' }, padding: 4 },
      },
    }
  }
  return {
    ...base,
    name: 'Texto',
    type: 'text',
    w: 84,
    h: 22,
    data: { source: 'fixed', value: 'Texto' },
    style: {
      text: { ...DEFAULT_TEXT, fontSize: 14, color: '#fff', align: 'center' },
      box: { fill: { mode: 'solid', color: 'transparent' }, padding: 4 },
    },
  }
}
