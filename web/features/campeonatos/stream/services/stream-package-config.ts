import {
  DEFAULT_STREAM_OVERLAY_CONFIGS,
  DEFAULT_STREAM_PACKAGE_SHARED_CONFIG,
  STREAM_OUTPUT_PROFILES,
  STREAM_SYSTEM_OVERLAYS,
  type StreamOverlayPackage,
  type StreamPackageAssetKey,
  type StreamOutputProfileId,
  type StreamPackageOutputVariantConfig,
  type StreamPackageOverlayConfig,
  type StreamSceneItem,
  type StreamOutputLayout,
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


export function normalizeStreamOutputLayouts(raw: unknown): StreamOutputLayout[] {
  if (!Array.isArray(raw)) return []
  const allowedTypes = new Set<string>(STREAM_SYSTEM_OVERLAYS)
  const allowedProfiles = new Set<string>(STREAM_OUTPUT_PROFILES.map((profile) => profile.id))
  return raw.slice(0, 40).map((item: unknown, layoutIndex: number) => {
    const source = asStreamConfigObject(item)
    const sliceCount = Math.max(1, Math.min(8, Math.round(Number(source.sliceCount) || 1)))
    const sliceDirection = source.sliceDirection === 'vertical' ? 'vertical' : 'horizontal'
    const legacyWidth = Math.max(240, Math.min(7680, Math.round(Number(source.width) || 1080)))
    const legacyHeight = Math.max(240, Math.min(7680, Math.round(Number(source.height) || 1350)))
    const sliceWidth = Math.max(240, Math.min(7680, Math.round(Number(source.sliceWidth) || (sliceDirection === 'horizontal' ? Math.round(legacyWidth / sliceCount) : legacyWidth) || 1080)))
    const sliceHeight = Math.max(240, Math.min(7680, Math.round(Number(source.sliceHeight) || (sliceDirection === 'vertical' ? Math.round(legacyHeight / sliceCount) : legacyHeight) || 1350)))
    const width = sliceDirection === 'horizontal' ? Math.min(16384, sliceWidth * sliceCount) : sliceWidth
    const height = sliceDirection === 'vertical' ? Math.min(16384, sliceHeight * sliceCount) : sliceHeight
    const backgroundType = ['transparent', 'color', 'image'].includes(String(source.backgroundType))
      ? source.backgroundType as StreamOutputLayout['backgroundType']
      : 'transparent'
    const outputFormat = source.outputFormat === 'jpg' ? 'jpg' : 'png'
    const areas = Array.isArray(source.areas) ? source.areas : []
    return {
      id: String(source.id || `layout-${layoutIndex + 1}`).slice(0, 120),
      name: String(source.name || `Saída ${layoutIndex + 1}`).slice(0, 120),
      width,
      height,
      backgroundType,
      backgroundColor: String(source.backgroundColor || '#101218').slice(0, 32),
      backgroundUrl: String(source.backgroundUrl || '').slice(0, 2000),
      outputFormat,
      sliceCount,
      sliceDirection,
      sliceWidth,
      sliceHeight,
      areas: areas.slice(0, 30).map((area: unknown, areaIndex: number) => {
        const row = asStreamConfigObject(area)
        const overlayTypeRaw = String(row.overlayType || 'standings_general')
        const profileIdRaw = String(row.profileId || 'live-hd')
        const dataStart = Math.max(1, Math.min(999, Math.round(Number(row.dataStart) || 1)))
        const dataEnd = Math.max(dataStart, Math.min(999, Math.round(Number(row.dataEnd) || dataStart)))
        return {
          id: String(row.id || `area-${areaIndex + 1}`).slice(0, 120),
          overlayType: (allowedTypes.has(overlayTypeRaw) ? overlayTypeRaw : 'standings_general') as StreamOutputLayout['areas'][number]['overlayType'],
          profileId: (allowedProfiles.has(profileIdRaw) ? profileIdRaw : 'live-hd') as StreamOutputLayout['areas'][number]['profileId'],
          x: Math.max(-16384, Math.min(16384, Math.round(Number(row.x) || 0))),
          y: Math.max(-16384, Math.min(16384, Math.round(Number(row.y) || 0))),
          width: Math.max(80, Math.min(7680, Math.round(Number(row.width) || width))),
          height: Math.max(80, Math.min(7680, Math.round(Number(row.height) || Math.min(height, 900)))),
          zIndex: Math.max(0, Math.min(999, Math.round(Number(row.zIndex) || areaIndex))),
          dataStart,
          dataEnd,
          visible: row.visible !== false,
          contentMode: row.contentMode === 'clean' ? 'clean' : 'full',
          lockAspect: row.lockAspect === true,
        }
      }),
    }
  })
}

function normalizeVariantConfig(raw: unknown): StreamPackageOutputVariantConfig {
  const source = asStreamConfigObject(raw)
  const assetOverrides = normalizeAssetMap(source.assetOverrides)
  const structureOverrides = asStreamConfigObject(source.structureOverrides)
  const looseOverrides = asStreamConfigObject(source.looseOverrides)
  const tableMode = source.tableMode === 'single' || source.tableMode === 'double' ? source.tableMode : undefined
  const columns = Array.isArray(source.columns)
    ? source.columns.map((item: unknown) => String(item || '').trim()).filter(Boolean)
    : undefined
  const maxItemsNumber = Number(source.maxItems)
  const maxItems = Number.isFinite(maxItemsNumber) && maxItemsNumber > 0 ? Math.round(maxItemsNumber) : undefined
  const title = typeof source.title === 'string' ? source.title : undefined
  const columnLabels = asStreamConfigObject(source.columnLabels) as Record<string, string>
  const hiddenHeaders = Array.isArray(source.hiddenHeaders) ? source.hiddenHeaders.map((item) => String(item || '').trim()).filter(Boolean) : undefined
  const sceneItems = Array.isArray(source.sceneItems) ? source.sceneItems.slice(0, 12).map((rawItem, index) => {
    const item = asStreamConfigObject(rawItem)
    const type = ['text', 'image', 'timer', 'round_counter'].includes(String(item.type)) ? item.type as StreamSceneItem['type'] : 'text'
    return {
      id: String(item.id || `item-${index + 1}`).slice(0, 80), type, show: item.show !== false,
      x: Math.max(-1920, Math.min(1920, Number(item.x) || 0)), y: Math.max(-1080, Math.min(1080, Number(item.y) || 0)),
      width: Math.max(40, Math.min(1920, Number(item.width) || 240)), height: Math.max(24, Math.min(1080, Number(item.height) || 80)),
      text: String(item.text || '').slice(0, 160), color: String(item.color || '#ffffff').slice(0, 24),
      fontSize: Math.max(8, Math.min(240, Number(item.fontSize) || 36)), fontWeight: Math.max(100, Math.min(900, Number(item.fontWeight) || 700)),
      imageUrl: String(item.imageUrl || '').slice(0, 2000), backgroundUrl: String(item.backgroundUrl || '').slice(0, 2000),
      pastUrl: String(item.pastUrl || '').slice(0, 2000), currentUrl: String(item.currentUrl || '').slice(0, 2000), nextUrl: String(item.nextUrl || '').slice(0, 2000),
      currentRound: Math.max(1, Math.min(99, Number(item.currentRound) || 1)), totalRounds: Math.max(1, Math.min(99, Number(item.totalRounds) || 12)),
    }
  }) as StreamSceneItem[] : undefined

  return {
    ...(maxItems ? { maxItems } : {}),
    ...(tableMode ? { tableMode } : {}),
    ...(columns ? { columns } : {}),
    ...(title !== undefined ? { title } : {}),
    ...(Object.keys(columnLabels).length ? { columnLabels } : {}),
    ...(hiddenHeaders?.length ? { hiddenHeaders } : {}),
    ...(sceneItems?.length ? { sceneItems } : {}),
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

function normalizeOverlayConfig(type: StreamSystemOverlayType, raw: unknown): StreamPackageOverlayConfig {
  const source = asStreamConfigObject(raw)
  const defaultConfig = DEFAULT_STREAM_OVERLAY_CONFIGS[type]
  const base = normalizeVariantConfig(source)
  const rawVariants = asStreamConfigObject(source.outputVariants)
  const allowedProfiles = new Set<string>(STREAM_OUTPUT_PROFILES.map((profile) => profile.id))
  const outputVariants = Object.fromEntries(
    Object.entries(rawVariants)
      .filter(([profileId]) => profileId !== 'live-hd' && allowedProfiles.has(profileId))
      .map(([profileId, value]) => [profileId, normalizeVariantConfig(value)])
      .filter(([, value]) => Object.keys(value as Record<string, unknown>).length),
  ) as StreamPackageOverlayConfig['outputVariants']

  return {
    maxItems: base.maxItems ?? defaultConfig.maxItems,
    tableMode: base.tableMode ?? defaultConfig.tableMode,
    columns: base.columns ?? defaultConfig.columns,
    title: base.title ?? defaultConfig.title,
    ...(base.columnLabels ? { columnLabels: base.columnLabels } : {}),
    ...(base.hiddenHeaders ? { hiddenHeaders: base.hiddenHeaders } : {}),
    ...(base.assetOverrides ? { assetOverrides: base.assetOverrides } : {}),
    ...(base.structureOverrides ? { structureOverrides: base.structureOverrides } : {}),
    ...(base.looseOverrides ? { looseOverrides: base.looseOverrides } : {}),
    ...(base.sceneItems ? { sceneItems: base.sceneItems } : {}),
    ...(outputVariants && Object.keys(outputVariants).length ? { outputVariants } : {}),
  }
}

export function resolveStreamOverlayConfig(
  pack: StreamOverlayPackage,
  type: StreamSystemOverlayType,
  outputProfileId: StreamOutputProfileId = 'live-hd',
): StreamPackageOverlayConfig {
  const stored = pack.overlay_configs[type] || {}
  const base: StreamPackageOverlayConfig = {
    ...DEFAULT_STREAM_OVERLAY_CONFIGS[type],
    ...stored,
  }
  if (outputProfileId === 'live-hd') return base
  const variant = stored.outputVariants?.[outputProfileId]
  if (!variant) return base
  const assetOverrides = { ...(base.assetOverrides || {}), ...(variant.assetOverrides || {}) }
  const layout = { ...(base.structureOverrides?.layout || {}), ...(variant.structureOverrides?.layout || {}) }
  const table = { ...(base.structureOverrides?.table || {}), ...(variant.structureOverrides?.table || {}) }
  const card = { ...(base.structureOverrides?.card || {}), ...(variant.structureOverrides?.card || {}) }
  const structureOverrides = {
    ...(Object.keys(layout).length ? { layout } : {}),
    ...(Object.keys(table).length ? { table } : {}),
    ...(Object.keys(card).length ? { card } : {}),
  }
  const image = { ...(base.looseOverrides?.image || {}), ...(variant.looseOverrides?.image || {}) }
  const text = { ...(base.looseOverrides?.text || {}), ...(variant.looseOverrides?.text || {}) }
  const looseOverrides = {
    ...(Object.keys(image).length ? { image } : {}),
    ...(Object.keys(text).length ? { text } : {}),
  }
  return {
    ...base,
    ...variant,
    ...(Object.keys(assetOverrides).length ? { assetOverrides } : { assetOverrides: undefined }),
    ...(Object.keys(structureOverrides).length ? { structureOverrides } : { structureOverrides: undefined }),
    ...(Object.keys(looseOverrides).length ? { looseOverrides } : { looseOverrides: undefined }),
    outputVariants: stored.outputVariants,
  }
}

export function resolveStreamAsset(
  pack: StreamOverlayPackage,
  type: StreamSystemOverlayType,
  key: StreamPackageAssetKey,
  outputProfileId: StreamOutputProfileId = 'live-hd',
): string {
  const override = resolveStreamOverlayConfig(pack, type, outputProfileId).assetOverrides?.[key]
  return String(override || pack.assets[key] || '').trim()
}

export function resolveStreamLayoutConfig(pack: StreamOverlayPackage, type: StreamSystemOverlayType, outputProfileId: StreamOutputProfileId = 'live-hd') {
  return { ...pack.shared_config.layout, ...(resolveStreamOverlayConfig(pack, type, outputProfileId).structureOverrides?.layout || {}) }
}

export function resolveStreamTableConfig(pack: StreamOverlayPackage, type: StreamSystemOverlayType, outputProfileId: StreamOutputProfileId = 'live-hd') {
  return { ...pack.shared_config.table, ...(resolveStreamOverlayConfig(pack, type, outputProfileId).structureOverrides?.table || {}) }
}

export function resolveStreamCardConfig(pack: StreamOverlayPackage, type: StreamSystemOverlayType, outputProfileId: StreamOutputProfileId = 'live-hd') {
  return { ...pack.shared_config.card, ...(resolveStreamOverlayConfig(pack, type, outputProfileId).structureOverrides?.card || {}) }
}

export function resolveStreamLooseImageConfig(pack: StreamOverlayPackage, type: StreamSystemOverlayType, outputProfileId: StreamOutputProfileId = 'live-hd') {
  return { ...pack.shared_config.looseImage, ...(resolveStreamOverlayConfig(pack, type, outputProfileId).looseOverrides?.image || {}) }
}

export function resolveStreamLooseTextConfig(pack: StreamOverlayPackage, type: StreamSystemOverlayType, outputProfileId: StreamOutputProfileId = 'live-hd') {
  return { ...pack.shared_config.looseText, ...(resolveStreamOverlayConfig(pack, type, outputProfileId).looseOverrides?.text || {}) }
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
        columnStyles: Object.fromEntries(
          Object.entries(DEFAULT_STREAM_PACKAGE_SHARED_CONFIG.table.columnStyles).map(([key, defaults]) => [
            key,
            { ...defaults, ...asStreamConfigObject(asStreamConfigObject(rawShared.table).columnStyles)[key] },
          ]),
        ) as StreamOverlayPackage['shared_config']['table']['columnStyles'],
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
    output_layouts: normalizeStreamOutputLayouts(pack?.output_layouts),
    schema_version: Math.max(3, Number(pack?.schema_version) || 3),
    updated_at: pack?.updated_at || null,
  }
}
