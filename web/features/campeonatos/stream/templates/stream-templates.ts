import {
  DEFAULT_BOX,
  DEFAULT_TEXT,
  DEFAULT_TRANSITION,
  newBlockId,
  type StreamBlock,
  type StreamOverlay,
  type StreamTableBlock,
  type StreamTemplateId,
} from '../types/stream.types'
import { createEmptyCard, createMapCardFolder, createMvpCardFolder } from '../utils/card-layers'
import { ensureTableStructure } from '../utils/table-structure'

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
    description: '3 pastas-card pré-montadas (mapa, logo, nome, pts, abates). Abra e edite cada item.',
    badge: 'Pastas card',
  },
  {
    id: 'standings',
    title: 'Tabela de classificação',
    description: 'Pasta tabela com colunas de ranking já ligadas aos dados.',
    badge: 'Pasta tabela',
  },
  {
    id: 'mvp_combo',
    title: 'MVP + lista',
    description: 'Pasta card MVP + pasta tabela com o restante.',
    badge: 'Card + tabela',
  },
  {
    id: 'custom',
    title: 'Em branco',
    description: 'Começa vazio: adicione pastas card/tabela e itens dentro.',
    badge: 'Custom',
  },
]

const goldText = { ...DEFAULT_TEXT, color: '#f5e6a8', fontSize: 16 }

function standingsTable(rows = 1, startRank = 1, name = 'Classificação'): StreamTableBlock {
  // Etapa 1: template nasce com 1 linha modelo (igual + Tabela no editor).
  return ensureTableStructure({
    id: newBlockId(),
    type: 'table',
    name,
    tableW: 560,
    x: 40,
    y: 40,
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
      variant: startRank > 1 ? 'mvp_list' : 'standings',
      source: startRank > 1 ? 'mvp' : 'equipes_geral',
      rows: 1,
      startRank,
      columns:
        startRank > 1
          ? ['pos', 'logo', 'nick', 'quedas', 'kd', 'abates', 'delta']
          : ['pos', 'logo', 'nome', 'booyahs', 'abates', 'pontos', 'delta'],
      rowHeight: 36,
      rowGap: 0,
      headerHeight: 32,
      showHeader: true,
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
  })
}

export function buildTemplateBlocks(template: StreamTemplateId): StreamBlock[] {
  if (template === 'map_cards') {
    return [
      createMapCardFolder(1, 'BERMUDA 1'),
      createMapCardFolder(2, 'PURGATÓRIO 1'),
      createMapCardFolder(3, 'NOVA TERRA 1'),
    ]
  }
  if (template === 'standings') {
    return [standingsTable(1, 1, 'Classificação')]
  }
  if (template === 'mvp_combo') {
    return [createMvpCardFolder(), standingsTable(1, 2, 'MVP lista')]
  }
  return []
}

export function createOverlayFromTemplate(
  template: StreamTemplateId,
  name?: string,
): Omit<StreamOverlay, 'id' | 'updatedAt'> {
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

export { createEmptyCard }
