'use client'

import { ChevronRight, Flame, Heart, Radio, Search, ShoppingCart, SlidersHorizontal, Ticket, Users, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { addToCart, getCartItems, getWishlistItems, removeFromCart, setCartQuantity, toggleWishlist, type LocalCommerceItem } from '@/features/commerce/local-commerce'
import { supabase } from '@/lib/supabase-browser'
import type { DirectoryItem } from '../types'

function getMetaLabels(items: DirectoryItem[]) {
  const labels: string[] = []
  for (const item of items) {
    for (const meta of item.meta || []) {
      if (!labels.includes(meta.label)) labels.push(meta.label)
      if (labels.length === 3) return labels
    }
  }
  return labels
}

function getMetaValue(item: DirectoryItem, label: string) {
  return item.meta?.find((meta) => meta.label === label)?.value || '—'
}

function money(value: unknown) {
  const number = Number(value)
  if (!Number.isFinite(number) || number <= 0) return 'Grátis'
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(number)
}

function moneyNumber(value: unknown) {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? number : 0
}

function nextGameLabel(value: unknown) {
  const raw = String(value || '').trim()
  if (!raw) return 'Data a confirmar'
  const date = new Date(raw.length === 10 ? `${raw}T12:00:00` : raw)
  if (Number.isNaN(date.getTime())) return 'Data a confirmar'
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

function commerceItemFromDirectory(item: DirectoryItem): LocalCommerceItem {
  return {
    id: item.id,
    name: item.name,
    href: `/${item.kind}/${item.id}`,
    image: item.image,
    banner: item.banner,
    price: moneyNumber(item.commercial?.valor_inscricao),
    freeSlots: Number(item.commercial?.vagas_livres ?? 0),
  }
}

function optimisticCartAdd(current: LocalCommerceItem[], item: DirectoryItem) {
  const nextItem = commerceItemFromDirectory(item)
  const existing = current.find((row) => row.id === item.id)
  if (!existing) return [...current, { ...nextItem, quantity: 1 }]
  const max = Math.max(1, Number(existing.freeSlots || nextItem.freeSlots || 99))
  return current.map((row) => row.id === item.id
    ? { ...row, quantity: Math.min(max, Number(row.quantity || 1) + 1) }
    : row)
}

function optimisticWishlistToggle(current: LocalCommerceItem[], item: DirectoryItem) {
  const exists = current.some((row) => row.id === item.id)
  if (exists) return current.filter((row) => row.id !== item.id)
  return [{ ...commerceItemFromDirectory(item), quantity: 1 }, ...current]
}

function commerceItemFromApi(row: any): LocalCommerceItem {
  const campeonato = Array.isArray(row?.campeonato) ? row.campeonato[0] : row?.campeonato
  return {
    id: String(row?.campeonato_id || campeonato?.id || row?.id || ''),
    name: String(campeonato?.nome || row?.name || 'Campeonato'),
    href: `/campeonatos/${row?.campeonato_id || campeonato?.id || ''}`,
    image: campeonato?.logo_url || null,
    banner: campeonato?.banner_url || null,
    price: Number(row?.preco_unitario_centavos || 0) / 100 || Number(campeonato?.valor_inscricao || 0),
    freeSlots: Number(campeonato?.vagas_livres || 0),
    quantity: Number(row?.quantidade || 1),
    itemId: row?.id,
  } as LocalCommerceItem & { itemId?: string }
}

function isToday(value: unknown) {
  if (!value) return false
  const date = new Date(String(value))
  if (Number.isNaN(date.getTime())) return false
  const now = new Date()
  return date.getFullYear() === now.getFullYear()
    && date.getMonth() === now.getMonth()
    && date.getDate() === now.getDate()
}

type ChampFilters = {
  today: boolean
  free: boolean
  lastVacancies: boolean
  live: boolean
  withPrize: boolean
  mine: boolean
  maxPrice: string
  minPrize: string
}

const emptyChampFilters: ChampFilters = {
  today: false,
  free: false,
  lastVacancies: false,
  live: false,
  withPrize: false,
  mine: false,
  maxPrice: '',
  minPrize: '',
}

function hasChampFilters(filters: ChampFilters) {
  return filters.today || filters.free || filters.lastVacancies || filters.live || filters.withPrize || filters.mine || filters.maxPrice || filters.minPrize
}

function filterChampionships(items: DirectoryItem[], filters: ChampFilters, myChampionshipIds: Set<string>) {
  const maxPrice = filters.maxPrice ? Number(filters.maxPrice) : null
  const minPrize = filters.minPrize ? Number(filters.minPrize) : null
  return items.filter((item) => {
    const price = moneyNumber(item.commercial?.valor_inscricao)
    const prize = moneyNumber(item.commercial?.premiacao)
    const free = Number(item.commercial?.vagas_livres ?? 0)
    if (filters.mine && !myChampionshipIds.has(item.id)) return false
    if (filters.today && !isToday(item.commercial?.data_jogo || item.commercial?.data_limite_inscricao)) return false
    if (filters.free && price > 0) return false
    if (filters.lastVacancies && !(free > 0 && free <= 3)) return false
    if (filters.live && !item.commercial?.tem_live) return false
    if (filters.withPrize && prize <= 0) return false
    if (maxPrice != null && Number.isFinite(maxPrice) && price > maxPrice) return false
    if (minPrize != null && Number.isFinite(minPrize) && prize < minPrize) return false
    return true
  })
}

function ChampionshipCards({
  items,
  myChampionshipIds,
  wishlistIds,
  cartIds,
  onCartToggle,
  onWishlistToggle,
}: {
  items: DirectoryItem[]
  myChampionshipIds: Set<string>
  wishlistIds: Set<string>
  cartIds: Set<string>
  onCartToggle: (item: DirectoryItem) => void
  onWishlistToggle: (item: DirectoryItem) => void
}) {
  return (
    <div className="directory-champ-card-grid">
      {items.map((item) => {
        const free = Number(item.commercial?.vagas_livres ?? 0)
        const hasPrize = Number(item.commercial?.premiacao || 0) > 0
        const isMine = myChampionshipIds.has(item.id)
        const isInCart = cartIds.has(item.id)
        return (
          <article className="directory-champ-card" key={item.id}>
            <a
              className="directory-champ-cover"
              href={`/${item.kind}/${item.id}`}
              aria-label={`Abrir ${item.name}`}
            >
              <span className="directory-champ-cover-empty" aria-hidden="true">
                {item.banner || item.image ? <img src={item.banner || item.image} alt="" loading="lazy" decoding="async" /> : <b>{item.name.slice(0, 2).toUpperCase()}</b>}
              </span>
              <span className="directory-champ-badges">
                {item.commercial?.tem_live ? <b><Radio size={11} /> Live</b> : null}
                {free > 0 && free <= 3 ? <b><Flame size={11} /> Últimas vagas</b> : null}
              </span>
            </a>
            <div className="directory-champ-body">
              <div className="directory-champ-title-row">
                <a className="directory-champ-title" href={`/${item.kind}/${item.id}`}>
                  <small>{item.eyebrow || item.description || 'Campeonato'}</small>
                  <strong>{item.name}</strong>
                </a>
                <span className="directory-champ-quick-actions">
                  <button
                    type="button"
                    className={`directory-champ-wish ${wishlistIds.has(item.id) ? 'active' : ''}`}
                    aria-label={wishlistIds.has(item.id) ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
                    aria-pressed={wishlistIds.has(item.id)}
                    onClick={() => onWishlistToggle(item)}
                  >
                    <Heart size={17} />
                  </button>
                  <button
                    type="button"
                    className={`directory-champ-cart-icon ${isInCart ? 'active' : ''}`}
                    aria-label={isInCart ? 'Remover do carrinho' : 'Adicionar ao carrinho'}
                    aria-pressed={isInCart}
                    disabled={free <= 0 && !isInCart}
                    onClick={(event) => {
                      event.preventDefault()
                      event.stopPropagation()
                      onCartToggle(item)
                    }}
                  >
                    <ShoppingCart size={17} />
                  </button>
                </span>
              </div>
              <div className="directory-champ-facts">
                <span><b>{money(item.commercial?.valor_inscricao)}</b><small>vaga</small></span>
                {hasPrize ? <span><b>{money(item.commercial?.premiacao)}</b><small>prêmio</small></span> : null}
                <span><b>{free}</b><small>livres</small></span>
              </div>
              <div className="directory-champ-next-game">Próximo jogo: <b>{nextGameLabel(item.commercial?.data_jogo)}</b></div>
              <div className="directory-champ-vacancy">
                <small>{free} de {item.commercial?.total_vagas || 0} vagas disponíveis</small>
              </div>
              <div className="directory-champ-actions">
                <a href={`/${item.kind}/${item.id}`}>Ver campeonato <ChevronRight size={14} /></a>
                <a className="directory-champ-cart-action" href={`/${item.kind}/${item.id}`}>
                  {free > 0 ? 'Garantir vaga' : 'Ver campeonato'} <ChevronRight size={14} />
                </a>
              </div>
              {isMine ? (
                <button
                  type="button"
                  className="directory-champ-lineup-action"
                  onClick={() => { window.location.href = '/?painel=1&section=campeonatos' }}
                >
                  <Users size={14} /> Escalar elenco
                </button>
              ) : null}
            </div>
          </article>
        )
      })}
    </div>
  )
}

export function DirectoryListClient({ items, cardsOnly = false }: { items: DirectoryItem[]; cardsOnly?: boolean }) {
  const [query, setQuery] = useState('')
  const [champFilters, setChampFilters] = useState<ChampFilters>(emptyChampFilters)
  const [myChampionshipIds, setMyChampionshipIds] = useState<Set<string>>(new Set())
  const [cartItems, setCartItems] = useState<LocalCommerceItem[]>([])
  const [wishlistItems, setWishlistItems] = useState<LocalCommerceItem[]>([])
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [cartPaymentMethod, setCartPaymentMethod] = useState<'pix' | 'cartao' | 'paypal'>('pix')
  const [commerceError, setCommerceError] = useState('')
  const isChampionshipDirectory = cardsOnly || items[0]?.kind === 'campeonatos'

  useEffect(() => {
    if (!isChampionshipDirectory) return
    const refresh = () => {
      setCartItems(getCartItems())
      setWishlistItems(getWishlistItems())
    }
    refresh()
    window.addEventListener('storage', refresh)
    window.addEventListener('dropzone:commerce-updated', refresh)
    return () => {
      window.removeEventListener('storage', refresh)
      window.removeEventListener('dropzone:commerce-updated', refresh)
    }
  }, [isChampionshipDirectory])

  useEffect(() => {
    if (!isChampionshipDirectory) return
    let alive = true
    void supabase.auth.getSession().then(async ({ data }) => {
      const accessToken = data.session?.access_token
      if (!accessToken) return
      setAccessToken(accessToken)
      const [cartResponse, wishlistResponse] = await Promise.all([
        fetch('/api/me/commerce/cart', {
          cache: 'no-store',
          headers: { Authorization: `Bearer ${accessToken}` },
        }).catch(() => null),
        fetch('/api/me/commerce/wishlist', {
          cache: 'no-store',
          headers: { Authorization: `Bearer ${accessToken}` },
        }).catch(() => null),
      ])
      const cartPayload = cartResponse?.ok ? await cartResponse.json().catch(() => null) : null
      const wishlistPayload = wishlistResponse?.ok ? await wishlistResponse.json().catch(() => null) : null
      if (cartPayload?.items && alive) setCartItems(cartPayload.items.map(commerceItemFromApi).filter((item: LocalCommerceItem) => item.id))
      if (wishlistPayload?.items && alive) setWishlistItems(wishlistPayload.items.map(commerceItemFromApi).filter((item: LocalCommerceItem) => item.id))
      const response = await fetch('/api/equipe/escalacoes', {
        cache: 'no-store',
        headers: { Authorization: `Bearer ${accessToken}` },
      }).catch(() => null)
      const payload = response?.ok ? await response.json().catch(() => ({})) : {}
      if (!alive) return
      setMyChampionshipIds(new Set<string>((payload.escalacoes || []).map((row: any) => String(row.campeonato_id || '')).filter(Boolean)))
    })
    return () => { alive = false }
  }, [isChampionshipDirectory])

  const filtered = useMemo(() => {
    const clean = query.trim().toLowerCase()
    const queryItems = clean ? items.filter((item) => item.searchText.includes(clean)) : items
    return isChampionshipDirectory ? filterChampionships(queryItems, champFilters, myChampionshipIds) : queryItems
  }, [champFilters, isChampionshipDirectory, items, myChampionshipIds, query])

  const metaLabels = useMemo(() => getMetaLabels(items), [items])
  const wishlistIds = useMemo(() => new Set(wishlistItems.map((item) => item.id)), [wishlistItems])
  const cartIds = useMemo(() => new Set(cartItems.map((item) => item.id)), [cartItems])
  const cartQuantity = cartItems.reduce((sum, item) => sum + Number(item.quantity || 1), 0)
  const cartTotal = cartItems.reduce((sum, item) => sum + moneyNumber(item.price) * Number(item.quantity || 1), 0)
  const toggleChampFilter = (key: keyof Pick<ChampFilters, 'today' | 'free' | 'lastVacancies' | 'live' | 'withPrize' | 'mine'>) => {
    setChampFilters((current) => ({ ...current, [key]: !current[key] }))
  }
  const handleCartToggle = async (item: DirectoryItem) => {
    const wasInCart = cartItems.some((row) => row.id === item.id)
    const previous = cartItems
    setCommerceError('')
    setCartItems((current) => wasInCart ? current.filter((row) => row.id !== item.id) : optimisticCartAdd(current, item))

    if (!accessToken) {
      setCartItems(wasInCart ? removeFromCart(item.id) : addToCart(commerceItemFromDirectory(item), 1))
      return
    }

    const response = await fetch(
      wasInCart ? `/api/me/commerce/cart?campeonato_id=${encodeURIComponent(item.id)}` : '/api/me/commerce/cart',
      {
        method: wasInCart ? 'DELETE' : 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        ...(wasInCart ? {} : { body: JSON.stringify({ campeonato_id: item.id, quantidade: 1, origem: 'direto' }) }),
      },
    ).catch(() => null)
    const payload = response ? await response.json().catch(() => null) : null
    if (response?.ok && payload?.items) {
      setCartItems(payload.items.map(commerceItemFromApi).filter((row: LocalCommerceItem) => row.id))
      return
    }
    setCartItems(previous)
    setCommerceError(payload?.error || 'Não foi possível atualizar o carrinho. Tente novamente.')
  }

  const handleWishlistToggle = async (item: DirectoryItem) => {
    const shouldFavorite = !wishlistItems.some((row) => row.id === item.id)
    const previous = wishlistItems
    setCommerceError('')
    setWishlistItems((current) => optimisticWishlistToggle(current, item))

    if (!accessToken) {
      setWishlistItems(toggleWishlist(commerceItemFromDirectory(item)))
      return
    }

    const response = await fetch('/api/me/commerce/wishlist', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ campeonato_id: item.id, favorito: shouldFavorite, origem: 'direto' }),
    }).catch(() => null)
    const payload = response ? await response.json().catch(() => null) : null
    if (response?.ok && payload?.items) {
      setWishlistItems(payload.items.map(commerceItemFromApi).filter((row: LocalCommerceItem) => row.id))
      return
    }
    setWishlistItems(previous)
    setCommerceError(payload?.error || 'Não foi possível atualizar os favoritos. Tente novamente.')
  }
  const handleCartQuantity = async (item: LocalCommerceItem, quantity: number) => {
    if (accessToken && item.itemId) {
      const response = await fetch('/api/me/commerce/cart', {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_id: item.itemId, quantidade: quantity }),
      }).catch(() => null)
      const payload = response?.ok ? await response.json().catch(() => null) : null
      if (payload?.items) {
        setCartItems(payload.items.map(commerceItemFromApi).filter((row: LocalCommerceItem) => row.id))
        return
      }
    }
    setCartItems(setCartQuantity(item.id, quantity))
  }
  const handleCartRemove = async (item: LocalCommerceItem) => {
    if (accessToken && item.itemId) {
      const response = await fetch(`/api/me/commerce/cart?item_id=${encodeURIComponent(item.itemId)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      }).catch(() => null)
      const payload = response?.ok ? await response.json().catch(() => null) : null
      if (payload?.items) {
        setCartItems(payload.items.map(commerceItemFromApi).filter((row: LocalCommerceItem) => row.id))
        return
      }
    }
    setCartItems(removeFromCart(item.id))
  }
  const handleCartCheckout = async (item: LocalCommerceItem) => {
    if (!accessToken || !item.itemId) {
      window.location.href = item.href
      return
    }
    const response = await fetch('/api/me/commerce/cart/checkout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ item_id: item.itemId, method: cartPaymentMethod }),
    }).catch(() => null)
    const payload = response?.ok ? await response.json().catch(() => null) : null
    const checkoutUrl = payload?.payment?.paypal_approval_url || payload?.payment?.invoice_url || payload?.claim_url
    if (checkoutUrl) window.location.href = checkoutUrl
    else window.location.href = item.href
  }

  return (
    <>
      {isChampionshipDirectory && !cardsOnly ? (
        <>
          <div className="champ-directory-tools">
            <label className="directory-search">
              <Search size={18} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar campeonato"
              />
            </label>
            <span className="directory-result-count"><strong>{filtered.length}</strong> resultado{filtered.length === 1 ? '' : 's'}</span>
            <details className="directory-market-tool directory-cart-preview">
              <summary aria-label="Carrinho"><ShoppingCart size={18} /><b>{cartQuantity}</b></summary>
              <div>
                {cartItems.length ? (
                  <>
                    <label className="directory-cart-method">
                      <span>Pagamento</span>
                      <select value={cartPaymentMethod} onChange={(event) => setCartPaymentMethod(event.target.value as 'pix' | 'cartao' | 'paypal')}>
                        <option value="pix">PIX</option>
                        <option value="cartao">Cartão</option>
                        <option value="paypal">PayPal</option>
                      </select>
                    </label>
                    {cartItems.map((item) => (
                      <article key={item.id}>
                        <span>{item.image ? <img src={item.image} alt="" /> : <Ticket size={16} />}</span>
                        <div><strong>{item.name}</strong><small>{money(item.price)} por vaga</small></div>
                        <input aria-label={`Quantidade para ${item.name}`} min={1} max={Math.max(1, Number(item.freeSlots || 1))} type="number" value={Number(item.quantity || 1)} onChange={(event) => void handleCartQuantity(item, Number(event.target.value || 1))} />
                        <button type="button" onClick={() => void handleCartCheckout(item)}>Comprar</button>
                        <button type="button" onClick={() => void handleCartRemove(item)}>Remover</button>
                      </article>
                    ))}
                    <p>Total: {money(cartTotal)}</p>
                  </>
                ) : <p>Seu carrinho está vazio.</p>}
              </div>
            </details>
            <details className="directory-market-tool directory-wishlist-preview">
              <summary aria-label="Favoritos"><Heart size={18} /><b>{wishlistItems.length}</b></summary>
              <div>
                {wishlistItems.length ? wishlistItems.slice(0, 6).map((item) => <a href={item.href} key={item.id}>{item.name}</a>) : <p>Nenhum favorito ainda.</p>}
              </div>
            </details>
          </div>

          {commerceError ? <p className="directory-commerce-error" role="alert">{commerceError}</p> : null}

          <div className="directory-market-filters" aria-label="Filtros de campeonatos">
            <div className="directory-market-filter-chips">
              <button type="button" className={champFilters.today ? 'active' : ''} onClick={() => toggleChampFilter('today')}>Hoje</button>
              <button type="button" className={champFilters.free ? 'active' : ''} onClick={() => toggleChampFilter('free')}>Grátis</button>
              <button type="button" className={champFilters.lastVacancies ? 'active' : ''} onClick={() => toggleChampFilter('lastVacancies')}>Últimas vagas</button>
              <button type="button" className={champFilters.live ? 'active' : ''} onClick={() => toggleChampFilter('live')}>Live</button>
              <button type="button" className={champFilters.withPrize ? 'active' : ''} onClick={() => toggleChampFilter('withPrize')}>Premiação</button>
              <button type="button" className={champFilters.mine ? 'active' : ''} onClick={() => toggleChampFilter('mine')}>Meus</button>
            </div>
            <details className="directory-market-more">
              <summary><SlidersHorizontal size={15} /> Filtros</summary>
              <div className="directory-market-filter-fields">
                <label><span>Vaga até R$</span><input inputMode="decimal" min="0" type="number" value={champFilters.maxPrice} onChange={(event) => setChampFilters((current) => ({ ...current, maxPrice: event.target.value }))} placeholder="0" /></label>
                <label><span>Prêmio mínimo</span><input inputMode="decimal" min="0" type="number" value={champFilters.minPrize} onChange={(event) => setChampFilters((current) => ({ ...current, minPrize: event.target.value }))} placeholder="R$" /></label>
                {hasChampFilters(champFilters) ? <button type="button" className="directory-market-clear" onClick={() => setChampFilters(emptyChampFilters)}><X size={14} /> Limpar</button> : null}
              </div>
            </details>
          </div>
        </>
      ) : (
        <div className="directory-toolbar">
          <label className="directory-search">
            <Search size={17} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por nome, usuário, tag ou localidade..." />
          </label>
          <div className="directory-result-count"><strong>{filtered.length}</strong><span>resultado{filtered.length === 1 ? '' : 's'}</span></div>
        </div>
      )}

      {filtered.length && !isChampionshipDirectory ? (
        <div className="directory-list-head" aria-hidden="true">
          <span className="directory-list-head-main">Perfil</span>
          <span className="directory-list-head-meta">
            {metaLabels.map((label) => (
              <em key={label}>{label}</em>
            ))}
          </span>
        </div>
      ) : null}

      {isChampionshipDirectory ? (
        <ChampionshipCards
          items={filtered}
          myChampionshipIds={myChampionshipIds}
          wishlistIds={wishlistIds}
          cartIds={cartIds}
          onCartToggle={handleCartToggle}
          onWishlistToggle={handleWishlistToggle}
        />
      ) : (
        <div className={`directory-list directory-list-${items[0]?.kind || 'empty'}`}>
          {filtered.map((item) => (
            <a className={`directory-list-row directory-list-row-${item.kind}`} href={`/${item.kind}/${item.id}`} key={item.id}>
              <span className="directory-list-media">{item.image ? <img src={item.image} alt="" /> : <b>{item.name.slice(0, 2).toUpperCase()}</b>}</span>
              <span className="directory-list-main">
                <small>{item.eyebrow}</small>
                <strong>{item.name}</strong>
                <span>{item.username ? `@${item.username} · ` : ''}{item.description}</span>
              </span>
              <span className="directory-list-meta">
                {metaLabels.map((label) => (
                  <em key={label} data-label={label}>
                    <b>{getMetaValue(item, label)}</b>
                  </em>
                ))}
              </span>
              <ChevronRight size={18} className="directory-list-arrow" />
            </a>
          ))}
        </div>
      )}
      {!filtered.length ? <div className="directory-empty">Nenhum resultado encontrado.</div> : null}
    </>
  )
}
