'use client'

export type LocalCommerceItem = {
  id: string
  itemId?: string | null
  name: string
  href: string
  image?: string | null
  banner?: string | null
  price?: number | null
  freeSlots?: number | null
  quantity?: number
}

export const CART_STORAGE_KEY = 'dropzone:cart:v1'
export const WISHLIST_STORAGE_KEY = 'dropzone:wishlist:v1'

function readItems(key: string): LocalCommerceItem[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(key)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((item) => item?.id) : []
  } catch {
    return []
  }
}

function writeItems(key: string, items: LocalCommerceItem[]) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(key, JSON.stringify(items))
  window.dispatchEvent(new CustomEvent('dropzone:commerce-updated', { detail: { key } }))
}

export function getCartItems() {
  return readItems(CART_STORAGE_KEY)
}

export function getWishlistItems() {
  return readItems(WISHLIST_STORAGE_KEY)
}

export function addToCart(item: LocalCommerceItem, quantity = 1) {
  const items = getCartItems()
  const existing = items.find((current) => current.id === item.id)
  if (existing) {
    existing.quantity = Math.max(1, Math.min(Number(item.freeSlots || 99), Number(existing.quantity || 1) + quantity))
  } else {
    items.push({ ...item, quantity: Math.max(1, quantity) })
  }
  writeItems(CART_STORAGE_KEY, items)
  return items
}

export function removeFromCart(id: string) {
  const items = getCartItems().filter((item) => item.id !== id)
  writeItems(CART_STORAGE_KEY, items)
  return items
}

export function setCartQuantity(id: string, quantity: number) {
  const items = getCartItems().map((item) => item.id === id ? { ...item, quantity: Math.max(1, quantity) } : item)
  writeItems(CART_STORAGE_KEY, items)
  return items
}

export function toggleWishlist(item: LocalCommerceItem) {
  const items = getWishlistItems()
  const exists = items.some((current) => current.id === item.id)
  const next = exists ? items.filter((current) => current.id !== item.id) : [{ ...item, quantity: 1 }, ...items]
  writeItems(WISHLIST_STORAGE_KEY, next)
  return next
}

export function isWishlisted(id: string) {
  return getWishlistItems().some((item) => item.id === id)
}
