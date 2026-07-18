import { supabase } from '@/lib/supabase-browser'
import type {
  StreamBlock,
  StreamCatalogModel,
  StreamCatalogVisibility,
  StreamPurchaseCode,
} from '../types/stream.types'
import { FRAME_H, FRAME_W } from '../types/stream.types'
import { packOverlayBlocks, unpackOverlayBlocks } from '../utils/overlay-frame'

async function authFetch(url: string, options?: RequestInit) {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  const response = await fetch(url, {
    cache: 'no-store',
    ...options,
    headers: {
      ...(options?.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options?.headers || {}),
    },
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error || 'Falha no catálogo de overlays.')
  return payload
}

function mapModel(raw: any): StreamCatalogModel {
  const packed = unpackOverlayBlocks(raw.blocks)
  return {
    id: String(raw.id),
    owner_user_id: String(raw.owner_user_id || ''),
    name: String(raw.nome || raw.name || 'Modelo'),
    description: String(raw.descricao || raw.description || ''),
    blocks: packed.blocks as StreamBlock[],
    frameW: packed.frameW || FRAME_W,
    frameH: packed.frameH || FRAME_H,
    visibility: (raw.visibility || 'private') as StreamCatalogVisibility,
    is_purchased_copy: Boolean(raw.is_purchased_copy),
    source_catalog_id: raw.source_catalog_id || null,
    price_label: raw.price_label || null,
    preview_note: raw.preview_note || null,
    updatedAt: String(raw.updated_at || raw.updatedAt || new Date().toISOString()),
    createdAt: raw.created_at || raw.createdAt,
    entitled: raw.entitled,
    entitlement_source: raw.entitlement_source ?? null,
    block_count: Array.isArray(packed.blocks) ? packed.blocks.length : raw.block_count,
    is_mine: Boolean(raw.is_mine),
  }
}

/** Lista modelos: mine | public | entitled */
export async function listCatalog(scope: 'mine' | 'public' | 'entitled' = 'mine'): Promise<{
  models: StreamCatalogModel[]
  missing_table?: boolean
}> {
  try {
    const payload = await authFetch(`/api/stream/catalog?scope=${encodeURIComponent(scope)}`)
    if (payload.missing_table) return { models: [], missing_table: true }
    return {
      models: (Array.isArray(payload.models) ? payload.models : []).map(mapModel),
      missing_table: false,
    }
  } catch (e: any) {
    if (String(e?.message || '').includes('não existe') || String(e?.message || '').includes('503')) {
      return { models: [], missing_table: true }
    }
    throw e
  }
}

/** Salva overlay atual como modelo no catálogo. */
export async function saveOverlayAsCatalogModel(input: {
  name: string
  description?: string
  blocks: StreamBlock[]
  frameW?: number
  frameH?: number
  visibility?: StreamCatalogVisibility
  price_label?: string
  /** se veio de compra, força is_purchased_copy */
  is_purchased_copy?: boolean
  source_catalog_id?: string | null
  license_kind?: string
}) {
  if (input.license_kind === 'purchased' || input.is_purchased_copy) {
    // comprado: só private, sem venda
    input.visibility = 'private'
  }
  const payload = await authFetch('/api/stream/catalog', {
    method: 'POST',
    body: JSON.stringify({
      name: input.name,
      description: input.description || '',
      blocks: packOverlayBlocks(input.blocks, input.frameW, input.frameH),
      visibility: input.visibility || 'private',
      price_label: input.price_label || null,
      is_purchased_copy: Boolean(input.is_purchased_copy || input.license_kind === 'purchased'),
      source_catalog_id: input.source_catalog_id || null,
    }),
  })
  return mapModel(payload.model)
}

export async function updateCatalogModel(
  id: string,
  patch: Partial<{
    name: string
    description: string
    visibility: StreamCatalogVisibility
    price_label: string | null
    blocks: StreamBlock[]
    frameW: number
    frameH: number
  }>,
) {
  const body: Record<string, unknown> = { ...patch }
  if (patch.blocks) {
    body.blocks = packOverlayBlocks(patch.blocks, patch.frameW, patch.frameH)
    delete body.frameW
    delete body.frameH
  }
  const payload = await authFetch(`/api/stream/catalog/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
  return mapModel(payload.model)
}

export async function deleteCatalogModel(id: string) {
  await authFetch(`/api/stream/catalog/${id}`, { method: 'DELETE' })
}

/** Gera código de compra (só dono; modelo não pode ser purchased copy). */
export async function generatePurchaseCode(catalogId: string): Promise<StreamPurchaseCode> {
  const payload = await authFetch(`/api/stream/catalog/${catalogId}/codes`, { method: 'POST', body: '{}' })
  const c = payload.code
  return {
    id: String(c.id),
    catalog_id: String(c.catalog_id),
    code: String(c.code),
    max_redemptions: Number(c.max_redemptions || 1),
    redemption_count: Number(c.redemption_count || 0),
    ativo: Boolean(c.ativo !== false),
    createdAt: String(c.created_at || new Date().toISOString()),
  }
}

export async function listPurchaseCodes(catalogId: string): Promise<StreamPurchaseCode[]> {
  const payload = await authFetch(`/api/stream/catalog/${catalogId}/codes`)
  return (Array.isArray(payload.codes) ? payload.codes : []).map((c: any) => ({
    id: String(c.id),
    catalog_id: String(c.catalog_id),
    code: String(c.code),
    max_redemptions: Number(c.max_redemptions || 1),
    redemption_count: Number(c.redemption_count || 0),
    ativo: Boolean(c.ativo !== false),
    createdAt: String(c.created_at || new Date().toISOString()),
  }))
}

/** Resgata código de compra e libera o modelo. */
export async function redeemPurchaseCode(code: string): Promise<StreamCatalogModel> {
  const payload = await authFetch('/api/stream/catalog/redeem', {
    method: 'POST',
    body: JSON.stringify({ code: code.trim() }),
  })
  return mapModel(payload.model)
}

/** Cria overlay no campeonato a partir de um modelo do catálogo. */
export async function createOverlayFromCatalog(campeonatoId: string, catalogId: string, name?: string) {
  const payload = await authFetch(`/api/campeonatos/${campeonatoId}/stream/overlays/from-catalog`, {
    method: 'POST',
    body: JSON.stringify({ catalog_id: catalogId, name }),
  })
  return payload.overlay
}
