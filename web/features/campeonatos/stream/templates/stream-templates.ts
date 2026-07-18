import {
  DEFAULT_BOX,
  DEFAULT_TEXT,
  DEFAULT_TRANSITION,
  newBlockId,
  type StreamBlock,
  type StreamCardBlock,
  type StreamOverlay,
  type StreamTableBlock,
  type StreamTemplateId,
} from '../types/stream.types'

export type TemplateMeta = {
  id: StreamTemplateId
  title: string
  description: string
  badge: string
}

export const TEMPLATE_CATALOG: TemplateMeta[] = [
  {
    id: 'map_cards',
    title: 'Cards de mapas',
    description: 'Resultado por mapa/queda — só cards (Bermuda, Purgatório, Nova Terra…).',
    badge: 'Só cards',
  },
  {
    id: 'standings',
    title: 'Tabela de classificação',
    description: 'Ranking de lines com posição, logo, booyah, abates e pontos.',
    badge: 'Só tabela',
  },
  {
    id: 'mvp_combo',
    title: 'MVP + lista',
    description: 'Card destaque do 1º + tabela do restante (combo).',
    badge: 'Card + tabela',
  },
  {
    id: 'custom',
    title: 'Em branco',
    description: 'Começa vazio e você adiciona cards e tabelas.',
    badge: 'Custom',
  },
]

const goldText = { ...DEFAULT_TEXT, color: '#f5e6a8', fontSize: 16 }
const whiteText = { ...DEFAULT_TEXT, color: '#ffffff', fontSize: 22 }
const redBar = {
  ...DEFAULT_BOX,
  fill: { mode: 'solid' as const, color: '#c62828', opacity: 1 },
  borderColor: '#e8c547',
  borderWidth: 2,
  borderRadius: 4,
  padding: 0,
}
const darkCard = {
  ...DEFAULT_BOX,
  fill: { mode: 'solid' as const, color: '#12151c', opacity: 1 },
  borderColor: '#c9a227',
  borderWidth: 2,
  borderRadius: 6,
  padding: 0,
}

function mapCard(slot: number, title: string): StreamCardBlock {
  return {
    id: newBlockId(),
    type: 'card',
    name: `Mapa ${slot}`,
    box: {
      ...darkCard,
      fill: {
        mode: 'image',
        color: '#1a1d24',
        imageUrl: '',
        fit: 'cover',
        overlayColor: '#000000',
        overlayOpacity: 0.35,
      },
    },
    transition: { ...DEFAULT_TRANSITION, enter: 'stagger', delayMs: (slot - 1) * 120 },
    data: {
      variant: 'map_result',
      mapSlot: slot,
      titleFixed: title,
      metrics: ['pts', 'abates'],
      fieldStyles: {
        title: { text: { ...whiteText, fontSize: 20, color: '#c62828' }, box: { fill: { mode: 'solid', color: '#e8c547' }, padding: 8, borderRadius: 0 } },
        metric_primary: { text: { ...DEFAULT_TEXT, fontSize: 15, color: '#ffffff' }, box: { fill: { mode: 'solid', color: '#c62828' }, padding: 8 } },
        metric_secondary: { text: { ...DEFAULT_TEXT, fontSize: 15, color: '#ffffff' }, box: { fill: { mode: 'solid', color: '#c62828' }, padding: 8 } },
      },
    },
  }
}

function standingsTable(rows = 12, startRank = 1): StreamTableBlock {
  return {
    id: newBlockId(),
    type: 'table',
    name: 'Classificação',
    box: {
      ...DEFAULT_BOX,
      fill: { mode: 'solid', color: '#1a1208', opacity: 1 },
      borderColor: '#c9a227',
      borderWidth: 2,
      borderRadius: 4,
      padding: 0,
    },
    transition: { ...DEFAULT_TRANSITION, enter: 'slide-up', onDataChange: 'rank-move' },
    data: {
      variant: 'standings',
      source: 'classificacao',
      rows,
      startRank,
      columns: ['pos', 'logo', 'nome', 'booyah', 'abates', 'pts', 'delta'],
      headerStyle: {
        text: { ...goldText, fontSize: 12, color: '#1a1208' },
        box: { fill: { mode: 'solid', color: '#e8c547' }, padding: 6 },
      },
      rowStyle: {
        text: { ...DEFAULT_TEXT, fontSize: 14, align: 'left', color: '#fff8e7' },
        box: { fill: { mode: 'solid', color: '#c62828' }, padding: 6, borderRadius: 0 },
      },
      altRowFill: '#b71c1c',
      highlightFirst: true,
    },
  }
}

function mvpHero(): StreamCardBlock {
  return {
    id: newBlockId(),
    type: 'card',
    name: 'MVP destaque',
    box: {
      ...redBar,
      fill: {
        mode: 'gradient',
        color: '#8b0000',
        colorTo: '#c62828',
        angle: 160,
        opacity: 1,
      },
      borderColor: '#e8c547',
      borderWidth: 3,
      borderRadius: 8,
      padding: 12,
    },
    transition: { ...DEFAULT_TRANSITION, enter: 'scale', onDataChange: 'pulse' },
    data: {
      variant: 'mvp_hero',
      rank: 1,
      metrics: ['abates', 'kd', 'quedas'],
      fieldStyles: {
        title: { text: { ...whiteText, fontSize: 22, align: 'left' } },
        metric_primary: { text: { ...DEFAULT_TEXT, fontSize: 14, color: '#f5e6a8' } },
        metric_secondary: { text: { ...DEFAULT_TEXT, fontSize: 14, color: '#f5e6a8' } },
        metric_tertiary: { text: { ...DEFAULT_TEXT, fontSize: 14, color: '#f5e6a8' } },
      },
    },
  }
}

function mvpList(): StreamTableBlock {
  return {
    id: newBlockId(),
    type: 'table',
    name: 'MVP lista',
    box: {
      ...DEFAULT_BOX,
      fill: { mode: 'solid', color: '#141820' },
      borderColor: '#c9a227',
      borderWidth: 2,
      borderRadius: 4,
      padding: 0,
    },
    transition: { ...DEFAULT_TRANSITION, enter: 'fade', onDataChange: 'pulse' },
    data: {
      variant: 'mvp_list',
      source: 'mvp',
      rows: 9,
      startRank: 2,
      columns: ['pos', 'logo', 'nome', 'quedas', 'kd', 'abates', 'delta'],
      headerStyle: {
        text: { ...DEFAULT_TEXT, fontSize: 11, color: '#1a1208' },
        box: { fill: { mode: 'solid', color: '#e8c547' }, padding: 6 },
      },
      rowStyle: {
        text: { ...DEFAULT_TEXT, fontSize: 13, align: 'left' },
        box: { fill: { mode: 'solid', color: '#c62828' }, padding: 6 },
      },
      altRowFill: '#a61b1b',
      highlightFirst: false,
    },
  }
}

export function buildTemplateBlocks(template: StreamTemplateId): StreamBlock[] {
  if (template === 'map_cards') {
    return [mapCard(1, 'BERMUDA 1'), mapCard(2, 'PURGATÓRIO 1'), mapCard(3, 'NOVA TERRA 1')]
  }
  if (template === 'standings') {
    return [standingsTable(12, 1)]
  }
  if (template === 'mvp_combo') {
    return [mvpHero(), mvpList()]
  }
  return []
}

export function createOverlayFromTemplate(template: StreamTemplateId, name?: string): Omit<StreamOverlay, 'id' | 'updatedAt'> {
  const meta = TEMPLATE_CATALOG.find((t) => t.id === template)
  return {
    name: name || meta?.title || 'Nova overlay',
    template,
    blocks: buildTemplateBlocks(template),
  }
}

export const TEMPLATE_LABEL: Record<StreamTemplateId, string> = {
  map_cards: 'Cards de mapas',
  standings: 'Tabela',
  mvp_combo: 'MVP combo',
  custom: 'Custom',
}
