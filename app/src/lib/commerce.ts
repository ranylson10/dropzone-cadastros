import AsyncStorage from '@react-native-async-storage/async-storage'
import { ChampionshipCard } from '@/types/dropzone'

const CART_KEY = 'dropzone:mobile:cart:v1'
const WISHLIST_KEY = 'dropzone:mobile:wishlist:v1'

export type MobileCommerceItem = ChampionshipCard & {
  quantity: number
}

async function readList(key: string): Promise<MobileCommerceItem[]> {
  try {
    const raw = await AsyncStorage.getItem(key)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((item) => item?.id) : []
  } catch {
    return []
  }
}

async function writeList(key: string, items: MobileCommerceItem[]) {
  await AsyncStorage.setItem(key, JSON.stringify(items))
  return items
}

export function getMobileCart() {
  return readList(CART_KEY)
}

export function getMobileWishlist() {
  return readList(WISHLIST_KEY)
}

export async function addMobileCart(championship: ChampionshipCard, quantity = 1) {
  const items = await getMobileCart()
  const existing = items.find((item) => item.id === championship.id)
  if (existing) {
    existing.quantity = Math.max(1, existing.quantity + quantity)
  } else {
    items.push({ ...championship, quantity: Math.max(1, quantity) })
  }
  return writeList(CART_KEY, items)
}

export async function toggleMobileWishlist(championship: ChampionshipCard) {
  const items = await getMobileWishlist()
  const exists = items.some((item) => item.id === championship.id)
  const next = exists ? items.filter((item) => item.id !== championship.id) : [{ ...championship, quantity: 1 }, ...items]
  return writeList(WISHLIST_KEY, next)
}

export async function removeMobileCart(id: string) {
  const next = (await getMobileCart()).filter((item) => item.id !== id)
  return writeList(CART_KEY, next)
}

export function mobileCommerceFromApi(row: any): MobileCommerceItem {
  const campeonato = Array.isArray(row?.campeonato) ? row.campeonato[0] : row?.campeonato
  const price = Number(row?.preco_unitario_centavos || 0) / 100 || Number(campeonato?.valor_inscricao || 0)
  return {
    id: String(row?.campeonato_id || campeonato?.id || row?.id || 'campeonato'),
    name: String(campeonato?.nome || 'Campeonato'),
    mode: 'competitivo',
    logoUrl: campeonato?.logo_url || null,
    bannerUrl: campeonato?.banner_url || null,
    priceLabel: price ? price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'Grátis',
    freeSlots: Number(campeonato?.vagas_livres || 0),
    quantity: Number(row?.quantidade || 1),
  }
}
