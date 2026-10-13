'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase-browser'
import { commerceItemFromApi } from './commerce-items'
import {
  addToCart,
  getCartItems,
  getWishlistItems,
  removeFromCart,
  setCartQuantity,
  toggleWishlist as toggleLocalWishlist,
  type CommerceOrigin,
  type LocalCommerceItem,
} from './local-commerce'

type CommerceContextValue = {
  cartItems: LocalCommerceItem[]
  wishlistItems: LocalCommerceItem[]
  cartIds: Set<string>
  wishlistIds: Set<string>
  pendingCartIds: Set<string>
  pendingWishlistIds: Set<string>
  authenticated: boolean
  accessToken: string | null
  loading: boolean
  error: string
  cartQuantity: number
  refresh: () => Promise<void>
  toggleCart: (item: LocalCommerceItem, options?: { origin?: CommerceOrigin; sellerManagerId?: string | null }) => Promise<void>
  toggleWishlist: (item: LocalCommerceItem, options?: { origin?: CommerceOrigin }) => Promise<void>
  setQuantity: (item: LocalCommerceItem, quantity: number) => Promise<void>
  removeItem: (item: LocalCommerceItem) => Promise<void>
}

const CommerceContext = createContext<CommerceContextValue | null>(null)

function withAttribution(
  item: LocalCommerceItem,
  options?: { origin?: CommerceOrigin; sellerManagerId?: string | null },
): LocalCommerceItem {
  return {
    ...item,
    origin: options?.origin || item.origin || 'direto',
    sellerManagerId: options?.sellerManagerId ?? item.sellerManagerId ?? null,
  }
}

export function CommerceProvider({ children }: { children: React.ReactNode }) {
  const [cartItems, setCartItems] = useState<LocalCommerceItem[]>([])
  const [wishlistItems, setWishlistItems] = useState<LocalCommerceItem[]>([])
  const [pendingCartIds, setPendingCartIds] = useState<Set<string>>(new Set())
  const [pendingWishlistIds, setPendingWishlistIds] = useState<Set<string>>(new Set())
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const tokenRef = useRef<string | null>(null)
  const mountedRef = useRef(true)

  const loadRemote = useCallback(async (token: string) => {
    const [cartResponse, wishlistResponse] = await Promise.all([
      fetch('/api/me/commerce/cart', { cache: 'no-store', headers: { Authorization: `Bearer ${token}` } }).catch(() => null),
      fetch('/api/me/commerce/wishlist', { cache: 'no-store', headers: { Authorization: `Bearer ${token}` } }).catch(() => null),
    ])
    const cartPayload = cartResponse?.ok ? await cartResponse.json().catch(() => null) : null
    const wishlistPayload = wishlistResponse?.ok ? await wishlistResponse.json().catch(() => null) : null
    const nextCart = Array.isArray(cartPayload?.items) ? cartPayload.items.map(commerceItemFromApi).filter((item: LocalCommerceItem) => item.id) : []
    const nextWishlist = Array.isArray(wishlistPayload?.items) ? wishlistPayload.items.map(commerceItemFromApi).filter((item: LocalCommerceItem) => item.id) : []
    if (mountedRef.current) {
      setCartItems(nextCart)
      setWishlistItems(nextWishlist)
    }
    return { cart: nextCart, wishlist: nextWishlist }
  }, [])

  const syncGuestState = useCallback(async (token: string, remote: { cart: LocalCommerceItem[]; wishlist: LocalCommerceItem[] }) => {
    const guestCart = getCartItems()
    const guestWishlist = getWishlistItems()
    const remoteCartIds = new Set(remote.cart.map((item) => item.id))
    const remoteWishlistIds = new Set(remote.wishlist.map((item) => item.id))
    const cartToSync = guestCart.filter((item) => !remoteCartIds.has(item.id))
    const wishlistToSync = guestWishlist.filter((item) => !remoteWishlistIds.has(item.id))
    if (!cartToSync.length && !wishlistToSync.length) return remote

    await Promise.all([
      ...cartToSync.map((item) => fetch('/api/me/commerce/cart', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campeonato_id: item.id,
          quantidade: Math.max(1, Number(item.quantity || 1)),
          origem: item.origin || 'direto',
          vendedor_manager_id: item.sellerManagerId || null,
        }),
      }).catch(() => null)),
      ...wishlistToSync.map((item) => fetch('/api/me/commerce/wishlist', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ campeonato_id: item.id, favorito: true, origem: item.origin || 'direto' }),
      }).catch(() => null)),
    ])
    return loadRemote(token)
  }, [loadRemote])

  const hydrate = useCallback(async (token: string | null) => {
    tokenRef.current = token
    if (mountedRef.current) {
      setAccessToken(token)
      setError('')
    }
    if (!token) {
      if (mountedRef.current) {
        setCartItems(getCartItems())
        setWishlistItems(getWishlistItems())
        setLoading(false)
      }
      return
    }
    try {
      const remote = await loadRemote(token)
      await syncGuestState(token, remote)
    } catch (cause: any) {
      if (mountedRef.current) setError(cause?.message || 'Não foi possível sincronizar carrinho e favoritos.')
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }, [loadRemote, syncGuestState])

  useEffect(() => {
    mountedRef.current = true
    void supabase.auth.getSession().then(({ data }) => hydrate(data.session?.access_token || null))
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.access_token !== tokenRef.current) void hydrate(session?.access_token || null)
    })
    const refreshGuest = () => {
      if (tokenRef.current) return
      setCartItems(getCartItems())
      setWishlistItems(getWishlistItems())
    }
    const refreshAuthenticated = () => {
      const token = tokenRef.current
      if (token) void loadRemote(token)
    }
    window.addEventListener('storage', refreshGuest)
    window.addEventListener('dropzone:commerce-updated', refreshGuest)
    window.addEventListener('focus', refreshAuthenticated)
    return () => {
      mountedRef.current = false
      authListener.subscription.unsubscribe()
      window.removeEventListener('storage', refreshGuest)
      window.removeEventListener('dropzone:commerce-updated', refreshGuest)
      window.removeEventListener('focus', refreshAuthenticated)
    }
  }, [hydrate, loadRemote])

  const refresh = useCallback(async () => {
    const token = tokenRef.current
    if (token) await loadRemote(token)
    else {
      setCartItems(getCartItems())
      setWishlistItems(getWishlistItems())
    }
  }, [loadRemote])

  const toggleCart = useCallback(async (
    rawItem: LocalCommerceItem,
    options?: { origin?: CommerceOrigin; sellerManagerId?: string | null },
  ) => {
    const item = withAttribution(rawItem, options)
    if (pendingCartIds.has(item.id)) return
    const token = tokenRef.current
    const wasInCart = cartItems.some((row) => row.id === item.id)
    const previous = cartItems
    setError('')
    setPendingCartIds((current) => new Set(current).add(item.id))
    setCartItems((current) => wasInCart
      ? current.filter((row) => row.id !== item.id)
      : [...current, { ...item, quantity: Math.max(1, Number(item.quantity || 1)) }])
    try {
      if (!token) {
        setCartItems(wasInCart ? removeFromCart(item.id) : addToCart(item, 1))
        return
      }
      const response = await fetch(
        wasInCart ? `/api/me/commerce/cart?campeonato_id=${encodeURIComponent(item.id)}` : '/api/me/commerce/cart',
        {
          method: wasInCart ? 'DELETE' : 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          ...(wasInCart ? {} : { body: JSON.stringify({
            campeonato_id: item.id,
            quantidade: Math.max(1, Number(item.quantity || 1)),
            origem: item.origin || 'direto',
            vendedor_manager_id: item.sellerManagerId || null,
          }) }),
        },
      )
      const payload = await response.json().catch(() => null)
      if (!response.ok) throw new Error(payload?.error || 'Não foi possível atualizar o carrinho.')
      await loadRemote(token)
    } catch (cause: any) {
      setCartItems(previous)
      setError(cause?.message || 'Não foi possível atualizar o carrinho.')
    } finally {
      setPendingCartIds((current) => {
        const next = new Set(current)
        next.delete(item.id)
        return next
      })
    }
  }, [cartItems, loadRemote, pendingCartIds])

  const toggleWishlist = useCallback(async (rawItem: LocalCommerceItem, options?: { origin?: CommerceOrigin }) => {
    const item = withAttribution(rawItem, options)
    if (pendingWishlistIds.has(item.id)) return
    const token = tokenRef.current
    const shouldFavorite = !wishlistItems.some((row) => row.id === item.id)
    const previous = wishlistItems
    setError('')
    setPendingWishlistIds((current) => new Set(current).add(item.id))
    setWishlistItems((current) => shouldFavorite
      ? [{ ...item, quantity: 1 }, ...current]
      : current.filter((row) => row.id !== item.id))
    try {
      if (!token) {
        setWishlistItems(toggleLocalWishlist(item))
        return
      }
      const response = await fetch('/api/me/commerce/wishlist', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ campeonato_id: item.id, favorito: shouldFavorite, origem: item.origin || 'direto' }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) throw new Error(payload?.error || 'Não foi possível atualizar os favoritos.')
      await loadRemote(token)
    } catch (cause: any) {
      setWishlistItems(previous)
      setError(cause?.message || 'Não foi possível atualizar os favoritos.')
    } finally {
      setPendingWishlistIds((current) => {
        const next = new Set(current)
        next.delete(item.id)
        return next
      })
    }
  }, [loadRemote, pendingWishlistIds, wishlistItems])

  const setQuantity = useCallback(async (item: LocalCommerceItem, nextQuantity: number) => {
    const quantity = Math.max(1, Math.min(Math.max(1, Number(item.freeSlots || 99)), Math.floor(nextQuantity)))
    const token = tokenRef.current
    setError('')
    setPendingCartIds((current) => new Set(current).add(item.id))
    try {
      if (!token || !item.itemId) {
        setCartItems(setCartQuantity(item.id, quantity))
        return
      }
      const response = await fetch('/api/me/commerce/cart', {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_id: item.itemId, quantidade: quantity }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) throw new Error(payload?.error || 'Não foi possível atualizar a quantidade.')
      await loadRemote(token)
    } catch (cause: any) {
      setError(cause?.message || 'Não foi possível atualizar a quantidade.')
    } finally {
      setPendingCartIds((current) => {
        const next = new Set(current)
        next.delete(item.id)
        return next
      })
    }
  }, [loadRemote])

  const removeItem = useCallback(async (item: LocalCommerceItem) => {
    const token = tokenRef.current
    setError('')
    setPendingCartIds((current) => new Set(current).add(item.id))
    try {
      if (!token || !item.itemId) {
        setCartItems(removeFromCart(item.id))
        return
      }
      const response = await fetch(`/api/me/commerce/cart?item_id=${encodeURIComponent(item.itemId)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) throw new Error(payload?.error || 'Não foi possível remover o item.')
      await loadRemote(token)
    } catch (cause: any) {
      setError(cause?.message || 'Não foi possível remover o item.')
    } finally {
      setPendingCartIds((current) => {
        const next = new Set(current)
        next.delete(item.id)
        return next
      })
    }
  }, [loadRemote])

  const value = useMemo<CommerceContextValue>(() => ({
    cartItems,
    wishlistItems,
    cartIds: new Set(cartItems.map((item) => item.id)),
    wishlistIds: new Set(wishlistItems.map((item) => item.id)),
    pendingCartIds,
    pendingWishlistIds,
    authenticated: Boolean(accessToken),
    accessToken,
    loading,
    error,
    cartQuantity: cartItems.reduce((sum, item) => sum + Math.max(1, Number(item.quantity || 1)), 0),
    refresh,
    toggleCart,
    toggleWishlist,
    setQuantity,
    removeItem,
  }), [accessToken, cartItems, error, loading, pendingCartIds, pendingWishlistIds, refresh, removeItem, setQuantity, toggleCart, toggleWishlist, wishlistItems])

  return <CommerceContext.Provider value={value}>{children}</CommerceContext.Provider>
}

export function useCommerce() {
  const value = useContext(CommerceContext)
  if (!value) throw new Error('useCommerce precisa estar dentro de CommerceProvider.')
  return value
}
