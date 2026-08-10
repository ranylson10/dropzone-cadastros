import { useCallback, useEffect, useMemo, useState } from 'react'
import { mobileApi } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { mobileCommerceFromApi } from '@/lib/commerce'

export function useChampionshipCommerce(requireAuth?: (action?: () => void) => boolean) {
  const auth = useAuth()
  const [wishlistIds, setWishlistIds] = useState<Set<string>>(new Set())
  const [cartIds, setCartIds] = useState<Set<string>>(new Set())
  const token = auth.session?.access_token

  const refresh = useCallback(async () => {
    if (!token) { setWishlistIds(new Set()); setCartIds(new Set()); return }
    const [wishlist, cart] = await Promise.all([
      mobileApi.commerceWishlist(token).catch(() => ({ items: [] })),
      mobileApi.commerceCart(token).catch(() => ({ items: [] })),
    ])
    setWishlistIds(new Set(wishlist.items.map(mobileCommerceFromApi).map((item) => item.id)))
    setCartIds(new Set(cart.items.map(mobileCommerceFromApi).map((item) => item.id)))
  }, [token])

  useEffect(() => { void refresh() }, [refresh])

  const require = useCallback((action: () => void) => {
    if (!token) { requireAuth?.(); return }
    action()
  }, [requireAuth, token])

  const toggleWishlist = useCallback((id: string) => require(() => {
    void mobileApi.toggleCommerceWishlist(id, token).then((payload) => {
      setWishlistIds(new Set(payload.items.map(mobileCommerceFromApi).map((item) => item.id)))
    }).catch(() => null)
  }), [require, token])

  const addCart = useCallback((id: string) => require(() => {
    void mobileApi.addCommerceCart(id, 1, token).then((payload) => {
      setCartIds(new Set(payload.items.map(mobileCommerceFromApi).map((item) => item.id)))
    }).catch(() => null)
  }), [require, token])

  return useMemo(() => ({ wishlistIds, cartIds, toggleWishlist, addCart, refresh }), [addCart, cartIds, refresh, toggleWishlist, wishlistIds])
}
