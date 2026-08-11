import {
  DEFAULT_STREAM_OVERLAY_CONFIGS,
  DEFAULT_STREAM_PACKAGE_SHARED_CONFIG,
  STREAM_SYSTEM_OVERLAYS,
  type StreamOverlayPackage,
  type StreamPackageAssetKey,
  type StreamPackageOverlayConfig,
  type StreamSystemOverlayType,
} from '../types/stream-package.types'

export function asStreamOverlayTypeList(raw: unknown): StreamSystemOverlayType[] {
  if (!Array.isArray(raw)) return []
  const allowed = new Set<string>(STREAM_SYSTEM_OVERLAYS)
  const seen = new Set<string>()
  const out: StreamSystemOverlayType[] = []
  for (const item of raw) {
    const key = String(item || '').trim()
    if (!allowed.has(key) || seen.has(key)) continue
    seen.add(key)
    out.push(key as StreamSystemOverlayType)
  }
  return out
}

export function asStreamConfigObject(raw: unknown): Record<string, any> {
  return raw && typeof raw === 'object' && !Array.isArray(raw)
    ? raw as Record<string, any>
    : {}
}


const STREAM_PACKAGE_ASSET_KEYS: StreamPackageAssetKey[] = [
  'event_logo',
  'table_row_bg',
  'table_rank_bg',
  'table_logo_bg',
  'table_name_bg',
  'table_stat_bg',
  'table_points_bg',
  'card_bg',
  'card_stats_bg',
  'top_art',
]

function normalizeAssetMap(raw: unknown): Partial<Record<StreamPackageAssetKey, string>> {
  const source = asStreamConfigObject(raw)
  const out: Partial<Record<StreamPackageAssetKey, string>> = {}
  for (const key of STREAM_PACKAGE_ASSET_KEYS) {
    const value = String(source[key] || '').trim()
    if (value) out[key] = value
  }
  return out
}

function normalizeOverlayConfig(type: StreamSystemOverlayType, raw: unknown): StreamPackageOverlayConfig {
  const source = asStreamConfigObject(raw)
  const defaultConfig = DEFAULT_STREAM_OVERLAY_CONFIGS[type]
  const assetOverrides = normalizeAssetMap(source.assetOverrides)
  const structureOverrides = asStreamConfigObject(source.structureOverrides)
  const looseOverrides = asStreamConfigObject(source.looseOverrides)
  const tableMode = source.tableMode === 'single' || source.tableMode === 'double'
    ? source.tableMode
    : defaultConfig.tableMode
  const columns = Array.isArray(source.columns)
    ? source.columns.map((item: unknown) => String(item || '').trim()).filter(Boolean)
    : defaultConfig.columns
  const maxItemsNumber = Number(source.maxItems)
  const maxItems = Number.isFinite(maxItemsNumber) && maxItemsNumber > 0
    ? Math.round(maxItemsNumber)
    : defaultConfig.maxItems
  const title = typeof source.title === 'string' ? source.title : defaultConfig.title

  return {
    maxItems,
    tableMode,
    columns,
    title,
    ...(Object.keys(assetOverrides).length ? { assetOverrides } : {}),
    ...(Object.keys(structureOverrides).length ? {
      structureOverrides: {
        ...(Object.keys(asStreamConfigObject(structureOverrides.layout)).length ? { layout: asStreamConfigObject(structureOverrides.layout) } : {}),
        ...(Object.keys(asStreamConfigObject(structureOverrides.table)).length ? { table: asStreamConfigObject(structureOverrides.table) } : {}),
        ...(Object.keys(asStreamConfigObject(structureOverrides.card)).length ? { card: asStreamConfigObject(structureOverrides.card) } : {}),
      },
    } : {}),
    ...(Object.keys(looseOverrides).length ? {
      looseOverrides: {
        ...(Object.keys(asStreamConfigObject(looseOverrides.image)).length ? { image: asStreamConfigObject(looseOverrides.image) } : {}),
        ...(Object.keys(asStreamConfigObject(looseOverrides.text)).length ? { text: asStreamConfigObject(looseOverrides.text) } : {}),
      },
    } : {}),
  }
}

export function resolveStreamOverlayConfig(
  pack: StreamOverlayPackage,
  type: StreamSystemOverlayType,
): StreamPackageOverlayConfig {
  return {
    ...DEFAULT_STREAM_OVERLAY_CONFIGS[type],
    ...(pack.overlay_configs[type] || {}),
  }
}

export function resolveStreamAsset(
  pack: StreamOverlayPackage,
  type: StreamSystemOverlayType,
  key: StreamPackageAssetKey,
): string {
  const override = resolveStreamOverlayConfig(pack, type).assetOverrides?.[key]
  return String(override || pack.assets[key] || '').trim()
}

export function resolveStreamLayoutConfig(pack: StreamOverlayPackage, type: StreamSystemOverlayType) {
  return { ...pack.shared_config.layout, ...(resolveStreamOverlayConfig(pack, type).structureOverrides?.layout || {}) }
}

export function resolveStreamTableConfig(pack: StreamOverlayPackage, type: StreamSystemOverlayType) {
  return { ...pack.shared_config.table, ...(resolveStreamOverlayConfig(pack, type).structureOverrides?.table || {}) }
}

export function resolveStreamCardConfig(pack: StreamOverlayPackage, type: StreamSystemOverlayType) {
  return { ...pack.shared_config.card, ...(resolveStreamOverlayConfig(pack, type).structureOverrides?.card || {}) }
}

export function resolveStreamLooseImageConfig(pack: StreamOverlayPackage, type: StreamSystemOverlayType) {
  return { ...pack.shared_config.looseImage, ...(resolveStreamOverlayConfig(pack, type).looseOverrides?.image || {}) }
}

export function resolveStreamLooseTextConfig(pack: StreamOverlayPackage, type: StreamSystemOverlayType) {
  return { ...pack.shared_config.looseText, ...(resolveStreamOverlayConfig(pack, type).looseOverrides?.text || {}) }
}


export function normalizeStreamOverlayPackage(
  campeonatoId: string,
  pack: any,
): StreamOverlayPackage {
  const rawShared = asStreamConfigObject(pack?.shared_config)
  const rawOverlayConfigs = asStreamConfigObject(pack?.overlay_configs)
  const overlayConfigs = Object.fromEntries(
    STREAM_SYSTEM_OVERLAYS.map((type) => [type, normalizeOverlayConfig(type, rawOverlayConfigs[type])]),
  ) as Record<StreamSystemOverlayType, StreamPackageOverlayConfig>

  return {
    campeonato_id: campeonatoId,
    enabled_overlay_types: asStreamOverlayTypeList(pack?.enabled_overlay_types),
    assets: normalizeAssetMap(pack?.assets),
    shared_config: {
      ...DEFAULT_STREAM_PACKAGE_SHARED_CONFIG,
      ...rawShared,
      identity: {
        ...DEFAULT_STREAM_PACKAGE_SHARED_CONFIG.identity,
        ...asStreamConfigObject(rawShared.identity),
      },
      looseImage: {
        ...DEFAULT_STREAM_PACKAGE_SHARED_CONFIG.looseImage,
        ...asStreamConfigObject(rawShared.looseImage),
      },
      looseText: {
        ...DEFAULT_STREAM_PACKAGE_SHARED_CONFIG.looseText,
        ...asStreamConfigObject(rawShared.looseText),
      },
      layout: {
        ...DEFAULT_STREAM_PACKAGE_SHARED_CONFIG.layout,
        ...asStreamConfigObject(rawShared.layout),
      },
      table: {
        ...DEFAULT_STREAM_PACKAGE_SHARED_CONFIG.table,
        ...asStreamConfigObject(rawShared.table),
      },
      card: {
        ...DEFAULT_STREAM_PACKAGE_SHARED_CONFIG.card,
        ...asStreamConfigObject(rawShared.card),
      },
      animation: {
        ...DEFAULT_STREAM_PACKAGE_SHARED_CONFIG.animation,
        ...asStreamConfigObject(rawShared.animation),
      },
    },
    overlay_configs: overlayConfigs,
    schema_version: Math.max(2, Number(pack?.schema_version) || 2),
    updated_at: pack?.updated_at || null,
  }
}
