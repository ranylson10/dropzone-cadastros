'use client'

import { ChevronRight, CirclePlus, Flame, Heart, Search, ShoppingCart, SlidersHorizontal, Ticket, Users, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState, type KeyboardEvent, type MouseEvent } from 'react'
import { addToCart, getCartItems, getWishlistItems, removeFromCart, toggleWishlist, type LocalCommerceItem } from '@/features/commerce/local-commerce'
import { supabase } from '@/lib/supabase-browser'
import { cachedStorageMediaUrl } from '@/lib/upload-public'
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

function registrationPriceLabel(value: unknown) {
  if (value == null || String(value).trim() === '') return 'Sob consulta'
  const number = Number(value)
  if (!Number.isFinite(number)) return 'Sob consulta'
  if (number <= 0) return 'Grátis'
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

function shortDateLabel(value: unknown) {
  const raw = String(value || '').trim()
  if (!raw) return ''
  const date = new Date(raw.length === 10 ? `${raw}T12:00:00` : raw)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

function championshipFormat(item: DirectoryItem) {
  const format = getMetaValue(item, 'Formato')
  if (format !== '—') return format
  const type = getMetaValue(item, 'Tipo')
  return type !== '—' ? type : 'Competição'
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
  const raw = String(value)
  const date = new Date(raw.length === 10 ? `${raw}T12:00:00` : raw)
  if (Number.isNaN(date.getTime())) return false
  const now = new Date()
  return date.getFullYear() === now.getFullYear()
    && date.getMonth() === now.getMonth()
    && date.getDate() === now.getDate()
}

type UserCompetitionPurchase = {
  campeonato_id: string
  status: string
  claim_url?: string | null
}

type MarketSort = 'soon' | 'prize' | 'price' | 'vacancies'

type ChampFilters = {
  openVacancies: boolean
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
  openVacancies: false,
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
  return filters.openVacancies || filters.today || filters.free || filters.lastVacancies || filters.live || filters.withPrize || filters.mine || filters.maxPrice || filters.minPrize
}

function filterChampionships(items: DirectoryItem[], filters: ChampFilters, myChampionshipIds: Set<string>) {
  const maxPrice = filters.maxPrice ? Number(filters.maxPrice) : null
  const minPrize = filters.minPrize ? Number(filters.minPrize) : null
  return items.filter((item) => {
    const price = moneyNumber(item.commercial?.valor_inscricao)
    const prize = moneyNumber(item.commercial?.premiacao)
    const free = Number(item.commercial?.vagas_livres ?? 0)
    if (filters.mine && !myChampionshipIds.has(item.id)) return false
    if (filters.openVacancies && free <= 0) return false
    if (filters.today && !isToday(item.commercial?.data_jogo || item.commercial?.data_limite_inscricao)) return false
    if (filters.free && !(item.commercial?.valor_inscricao != null && Number(item.commercial.valor_inscricao) <= 0)) return false
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
  participatingChampionshipIds,
  followHrefByChampionship,
  purchaseByChampionship,
  wishlistIds,
  cartIds,
  pendingWishlistIds,
  pendingCartIds,
  onCartToggle,
  onWishlistToggle,
}: {
  items: DirectoryItem[]
  participatingChampionshipIds: Set<string>
  followHrefByChampionship: Map<string, string>
  purchaseByChampionship: Map<string, UserCompetitionPurchase>
  wishlistIds: Set<string>
  cartIds: Set<string>
  pendingWishlistIds: Set<string>
  pendingCartIds: Set<string>
  onCartToggle: (item: DirectoryItem) => void
  onWishlistToggle: (item: DirectoryItem) => void
}) {
  return (
    <div className="directory-champ-card-grid">
      {items.map((item) => {
        const free = Number(item.commercial?.vagas_livres ?? 0)
        const price = moneyNumber(item.commercial?.valor_inscricao)
        const hasPrize = Number(item.commercial?.premiacao || 0) > 0
        const isParticipating = participatingChampionshipIds.has(item.id)
        const purchase = purchaseByChampionship.get(item.id)
        const followHref = followHrefByChampionship.get(item.id) || '/?painel=1'
        const isInCart = cartIds.has(item.id)
        const coverUrl = cachedStorageMediaUrl(item.banner || item.image || '')
        const championshipHref = `/${item.kind}/${item.id}`
        const buyHref = `${championshipHref}?comprar=1`
        const deadlineLabel = shortDateLabel(item.commercial?.data_limite_inscricao)
        const formatLabel = championshipFormat(item)
        const openChampionship = (event: MouseEvent<HTMLElement> | KeyboardEvent<HTMLElement>) => {
          const target = event.target as HTMLElement
          if (target.closest('a,button,input,select,textarea,label')) return
          if ('key' in event && event.key !== 'Enter' && event.key !== ' ') return
          if ('key' in event) event.preventDefault()
          window.location.assign(championshipHref)
        }
        return (
          <article
            className="directory-champ-card"
            key={item.id}
            tabIndex={0}
            role="link"
            aria-label={`Abrir campeonato ${item.name}`}
            onClick={openChampionship}
            onKeyDown={openChampionship}
          >
            <a
              className="directory-champ-cover"
              href={championshipHref}
              aria-label={`Abrir ${item.name}`}
            >
              <span className="directory-champ-cover-empty" aria-hidden="true">
                {coverUrl ? <img src={coverUrl} alt="" loading="lazy" decoding="async" /> : <b>{item.name.slice(0, 2).toUpperCase()}</b>}
              </span>
              <span className="directory-champ-badges">
                {free > 0 ? <b><Ticket size={11} /> {free} vaga{free === 1 ? '' : 's'}</b> : <b className="is-full">Sem vagas</b>}
                {free > 0 && free <= 3 ? <b><Flame size={11} /> Últimas vagas</b> : null}
              </span>
            </a>
            <div className="directory-champ-body">
              <div className="directory-champ-title-row">
                <a className="directory-champ-title" href={championshipHref}>
                  <small>{formatLabel}</small>
                  <strong>{item.name}</strong>
                  {item.producerName ? <em>por {item.producerName}</em> : null}
                </a>
                <span className="directory-champ-quick-actions">
                  <button
                    type="button"
                    className={`directory-champ-wish ${wishlistIds.has(item.id) ? 'active' : ''}`}
                    aria-label={wishlistIds.has(item.id) ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
                    aria-pressed={wishlistIds.has(item.id)}
                    disabled={pendingWishlistIds.has(item.id)}
                    onClick={() => onWishlistToggle(item)}
                  >
                    <Heart size={17} />
                  </button>
                  <button
                    type="button"
                    className={`directory-champ-cart-icon ${isInCart ? 'active' : ''}`}
                    aria-label={isInCart ? 'Remover do carrinho' : 'Adicionar ao carrinho'}
                    aria-pressed={isInCart}
                    disabled={(free <= 0 && !isInCart) || pendingCartIds.has(item.id)}
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
              {isParticipating ? <span className="directory-champ-participating"><Users size={12} /> Você já participa</span> : purchase ? <span className="directory-champ-participating is-purchased"><Ticket size={12} /> Vaga comprada · falta concluir entrada</span> : null}
              <div className="directory-champ-facts">
                <span><b>{registrationPriceLabel(item.commercial?.valor_inscricao)}</b><small>por vaga</small></span>
                <span><b>{free}</b><small>livres</small></span>
                {hasPrize ? <span><b>{money(item.commercial?.premiacao)}</b><small>prêmio</small></span> : null}
              </div>
              <div className="directory-champ-next-game">
                <span>Próximo jogo <b>{nextGameLabel(item.commercial?.data_jogo)}</b></span>
                {deadlineLabel ? <span>Inscrições até <b>{deadlineLabel}</b></span> : null}
              </div>
              <div className="directory-champ-vacancy">
                <small>{free > 0 ? `${free} de ${item.commercial?.total_vagas || 0} vagas disponíveis` : 'Inscrições sem vagas disponíveis agora'}</small>
              </div>
              <div className="directory-champ-actions">
                <a className="directory-champ-details-link" href={championshipHref}>Detalhes <ChevronRight size={14} /></a>
                {isParticipating
                  ? <a className="directory-champ-cart-action" href={followHref}>Acompanhar <ChevronRight size={14} /></a>
                  : purchase?.claim_url
                    ? <a className="directory-champ-cart-action" href={purchase.claim_url}>Concluir entrada <ChevronRight size={14} /></a>
                    : free > 0
                      ? <a className="directory-champ-cart-action" href={price > 0 ? buyHref : championshipHref}>{price > 0 ? 'Comprar vaga' : 'Ver inscrição'} <ChevronRight size={14} /></a>
                      : <span className="directory-champ-cart-action is-disabled">Sem vagas</span>}
              </div>
            </div>
          </article>
        )
      })}
    </div>
  )
}

export function DirectoryListClient({ items, kind, cardsOnly = false }: { items: DirectoryItem[]; kind?: DirectoryItem['kind']; cardsOnly?: boolean }) {
  const [query, setQuery] = useState('')
  const [champFilters, setChampFilters] = useState<ChampFilters>(emptyChampFilters)
  const [myChampionshipIds, setMyChampionshipIds] = useState<Set<string>>(new Set())
  const [participatingChampionshipIds, setParticipatingChampionshipIds] = useState<Set<string>>(new Set())
  const [followHrefByChampionship, setFollowHrefByChampionship] = useState<Map<string, string>>(new Map())
  const [purchaseByChampionship, setPurchaseByChampionship] = useState<Map<string, UserCompetitionPurchase>>(new Map())
  const [sortMode, setSortMode] = useState<MarketSort>('soon')
  const [cartItems, setCartItems] = useState<LocalCommerceItem[]>([])
  const [wishlistItems, setWishlistItems] = useState<LocalCommerceItem[]>([])
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [commerceError, setCommerceError] = useState('')
  const [pendingCartIds, setPendingCartIds] = useState<Set<string>>(new Set())
  const [pendingWishlistIds, setPendingWishlistIds] = useState<Set<string>>(new Set())
  const [canCreateChampionship, setCanCreateChampionship] = useState(false)
  const [authenticated, setAuthenticated] = useState(false)
  const isChampionshipDirectory = cardsOnly || kind === 'campeonatos' || items[0]?.kind === 'campeonatos'

  const refreshRemoteCart = useCallback(async (token: string): Promise<LocalCommerceItem[]> => {
    const response = await fetch('/api/me/commerce/cart', {
      cache: 'no-store',
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => null)
    const payload = response?.ok ? await response.json().catch(() => null) : null
    const remoteItems = Array.isArray(payload?.items)
      ? payload.items.map(commerceItemFromApi).filter((item: LocalCommerceItem) => item.id)
      : null
    if (remoteItems) setCartItems(remoteItems)
    return remoteItems || []
  }, [])

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
    const params = new URLSearchParams(window.location.search)
    const initialQuery = String(params.get('q') || '').trim()
    if (initialQuery) setQuery(initialQuery)
    if (params.get('vagas') === '1') setChampFilters((current) => ({ ...current, openVacancies: true }))
    if (params.get('meus') === '1') setChampFilters((current) => ({ ...current, mine: true }))
    if (params.get('gratis') === '1') setChampFilters((current) => ({ ...current, free: true }))
    if (params.get('hoje') === '1') setChampFilters((current) => ({ ...current, today: true }))
    if (params.get('ultimas') === '1') setChampFilters((current) => ({ ...current, lastVacancies: true }))
    const order = params.get('ordem')
    if (order === 'premio') setSortMode('prize')
    if (order === 'preco') setSortMode('price')
    if (order === 'vagas') setSortMode('vacancies')
  }, [isChampionshipDirectory])

  useEffect(() => {
    if (!isChampionshipDirectory) return
    let alive = true
    void supabase.auth.getSession().then(async ({ data }) => {
      const accessToken = data.session?.access_token
      setAuthenticated(Boolean(accessToken))
      if (!accessToken) return
      setAccessToken(accessToken)
      const localCart = getCartItems()
      const [cartResponse, wishlistResponse, meResponse, journeyResponse] = await Promise.all([
        fetch('/api/me/commerce/cart', {
          cache: 'no-store',
          headers: { Authorization: `Bearer ${accessToken}` },
        }).catch(() => null),
        fetch('/api/me/commerce/wishlist', {
          cache: 'no-store',
          headers: { Authorization: `Bearer ${accessToken}` },
        }).catch(() => null),
        fetch('/api/me', {
          cache: 'no-store',
          headers: { Authorization: `Bearer ${accessToken}` },
        }).catch(() => null),
        fetch('/api/me/competicoes', {
          cache: 'no-store',
          headers: { Authorization: `Bearer ${accessToken}` },
        }).catch(() => null),
      ])
      const cartPayload = cartResponse?.ok ? await cartResponse.json().catch(() => null) : null
      const wishlistPayload = wishlistResponse?.ok ? await wishlistResponse.json().catch(() => null) : null
      const mePayload = meResponse?.ok ? await meResponse.json().catch(() => null) : null
      const journeyPayload = journeyResponse?.ok ? await journeyResponse.json().catch(() => null) : null
      const remoteCartIds = new Set((cartPayload?.items || []).map((item: any) => String(item?.campeonato_id || '')))
      const localItemsToSync = localCart.filter((item) => !remoteCartIds.has(item.id))
      if (localItemsToSync.length) {
        await Promise.all(localItemsToSync.map((item) => fetch('/api/me/commerce/cart', {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ campeonato_id: item.id, quantidade: item.quantity || 1, origem: 'direto' }),
        }).catch(() => null)))
      }
      if (alive) {
        if (localItemsToSync.length) await refreshRemoteCart(accessToken)
        else if (cartPayload?.items) setCartItems(cartPayload.items.map(commerceItemFromApi).filter((item: LocalCommerceItem) => item.id))
        setCanCreateChampionship((mePayload?.accounts || []).some((account: any) => account?.profile_type === 'produtora'))
      }
      if (wishlistPayload?.items && alive) setWishlistItems(wishlistPayload.items.map(commerceItemFromApi).filter((item: LocalCommerceItem) => item.id))
      if (!alive) return
      const teamJourney = journeyPayload?.team || []
      const playerJourney = journeyPayload?.player || []
      const participating = new Set<string>([...teamJourney, ...playerJourney].map((row: any) => String(row.campeonato_id || '')).filter(Boolean))
      const followHrefs = new Map<string, string>()
      for (const row of teamJourney) {
        const championshipId = String(row.campeonato_id || '')
        const teamId = String(row.equipe_id || '')
        if (championshipId && teamId && !followHrefs.has(championshipId)) {
          followHrefs.set(championshipId, `/?painel=1&perfil=equipe&perfil_id=${encodeURIComponent(teamId)}&section=campeonatos`)
        }
      }
      for (const row of playerJourney) {
        const championshipId = String(row.campeonato_id || '')
        const playerId = String(row.jogador_id || '')
        if (championshipId && playerId && !followHrefs.has(championshipId)) {
          followHrefs.set(championshipId, `/?painel=1&perfil=jogador&perfil_id=${encodeURIComponent(playerId)}&section=competicoes`)
        }
      }
      const purchases = new Map<string, UserCompetitionPurchase>()
      for (const row of journeyPayload?.purchases || []) {
        const championshipId = String(row.campeonato_id || '')
        if (championshipId && !purchases.has(championshipId)) purchases.set(championshipId, row)
      }
      setParticipatingChampionshipIds(participating)
      setFollowHrefByChampionship(followHrefs)
      setPurchaseByChampionship(purchases)
      setMyChampionshipIds(new Set<string>([...participating, ...purchases.keys()]))
    })
    return () => { alive = false }
  }, [isChampionshipDirectory, refreshRemoteCart])

  const filtered = useMemo(() => {
    const clean = query.trim().toLowerCase()
    const queryItems = clean ? items.filter((item) => item.searchText.includes(clean)) : items
    if (!isChampionshipDirectory) return queryItems

    return filterChampionships(queryItems, champFilters, myChampionshipIds)
      .sort((a, b) => {
        if (sortMode === 'prize') return moneyNumber(b.commercial?.premiacao) - moneyNumber(a.commercial?.premiacao) || a.name.localeCompare(b.name, 'pt-BR')
        if (sortMode === 'price') return moneyNumber(a.commercial?.valor_inscricao) - moneyNumber(b.commercial?.valor_inscricao) || a.name.localeCompare(b.name, 'pt-BR')
        if (sortMode === 'vacancies') return Number(b.commercial?.vagas_livres || 0) - Number(a.commercial?.vagas_livres || 0) || a.name.localeCompare(b.name, 'pt-BR')
        const aFree = Number(a.commercial?.vagas_livres || 0)
        const bFree = Number(b.commercial?.vagas_livres || 0)
        if (Boolean(aFree) !== Boolean(bFree)) return bFree > 0 ? 1 : -1
        const aDate = String(a.commercial?.data_jogo || '9999-12-31')
        const bDate = String(b.commercial?.data_jogo || '9999-12-31')
        return aDate.localeCompare(bDate) || a.name.localeCompare(b.name, 'pt-BR')
      })
  }, [champFilters, isChampionshipDirectory, items, myChampionshipIds, query, sortMode])

  const metaLabels = useMemo(() => getMetaLabels(items), [items])
  const wishlistIds = useMemo(() => new Set(wishlistItems.map((item) => item.id)), [wishlistItems])
  const cartIds = useMemo(() => new Set(cartItems.map((item) => item.id)), [cartItems])
  const cartQuantity = cartItems.reduce((sum, item) => sum + Number(item.quantity || 1), 0)
  const toggleChampFilter = (key: keyof Pick<ChampFilters, 'openVacancies' | 'today' | 'free' | 'lastVacancies' | 'live' | 'withPrize' | 'mine'>) => {
    setChampFilters((current) => ({ ...current, [key]: !current[key] }))
  }
  const handleCartToggle = async (item: DirectoryItem) => {
    if (pendingCartIds.has(item.id)) return
    const wasInCart = cartItems.some((row) => row.id === item.id)
    const previous = cartItems
    setCommerceError('')
    setPendingCartIds((current) => new Set(current).add(item.id))
    setCartItems((current) => wasInCart ? current.filter((row) => row.id !== item.id) : optimisticCartAdd(current, item))

    if (!accessToken) {
      setCartItems(wasInCart ? removeFromCart(item.id) : addToCart(commerceItemFromDirectory(item), 1))
      setPendingCartIds((current) => {
        const next = new Set(current)
        next.delete(item.id)
        return next
      })
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
    if (!response?.ok) {
      setCartItems(previous)
      setCommerceError(payload?.error || 'Não foi possível atualizar o carrinho. Tente novamente.')
    } else {
      void refreshRemoteCart(accessToken)
    }
    setPendingCartIds((current) => {
      const next = new Set(current)
      next.delete(item.id)
      return next
    })
  }

  const handleWishlistToggle = async (item: DirectoryItem) => {
    if (pendingWishlistIds.has(item.id)) return
    const shouldFavorite = !wishlistItems.some((row) => row.id === item.id)
    const previous = wishlistItems
    setCommerceError('')
    setPendingWishlistIds((current) => new Set(current).add(item.id))
    setWishlistItems((current) => optimisticWishlistToggle(current, item))

    if (!accessToken) {
      setWishlistItems(toggleWishlist(commerceItemFromDirectory(item)))
      setPendingWishlistIds((current) => {
        const next = new Set(current)
        next.delete(item.id)
        return next
      })
      return
    }

    const response = await fetch('/api/me/commerce/wishlist', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ campeonato_id: item.id, favorito: shouldFavorite, origem: 'direto' }),
    }).catch(() => null)
    const payload = response ? await response.json().catch(() => null) : null
    if (!response?.ok) {
      setWishlistItems(previous)
      setCommerceError(payload?.error || 'Não foi possível atualizar os favoritos. Tente novamente.')
    }
    setPendingWishlistIds((current) => {
      const next = new Set(current)
      next.delete(item.id)
      return next
    })
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
                placeholder="Buscar campeonato, produtora ou formato"
              />
            </label>
            <span className="directory-result-count"><strong>{filtered.length}</strong> campeonato{filtered.length === 1 ? '' : 's'}</span>
            {canCreateChampionship ? <a className="directory-create-championship" href="/?painel=1&perfil=produtora&acao=criar-campeonato"><CirclePlus size={16} /> Criar campeonato</a> : null}
            <a className="directory-market-cart-link" href="/carrinho" aria-label={`Abrir carrinho com ${cartQuantity} vagas`}><ShoppingCart size={18} /><b>{cartQuantity}</b></a>
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
              <button type="button" className={champFilters.openVacancies ? 'active' : ''} onClick={() => toggleChampFilter('openVacancies')}>Vagas abertas</button>
              <button type="button" className={champFilters.today ? 'active' : ''} onClick={() => toggleChampFilter('today')}>Hoje</button>
              <button type="button" className={champFilters.free ? 'active' : ''} onClick={() => toggleChampFilter('free')}>Grátis</button>
              <button type="button" className={champFilters.lastVacancies ? 'active' : ''} onClick={() => toggleChampFilter('lastVacancies')}>Últimas vagas</button>
              {authenticated ? <button type="button" className={champFilters.mine ? 'active' : ''} onClick={() => toggleChampFilter('mine')}>Meus</button> : null}
            </div>
            <label className="directory-market-sort"><span>Ordenar</span><select value={sortMode} onChange={(event) => setSortMode(event.target.value as MarketSort)}><option value="soon">Próximos jogos</option><option value="vacancies">Mais vagas</option><option value="prize">Maior premiação</option><option value="price">Menor preço</option></select></label>
            <details className="directory-market-more">
              <summary><SlidersHorizontal size={15} /> Filtros</summary>
              <div className="directory-market-filter-fields">
                <label><span>Vaga até R$</span><input inputMode="decimal" min="0" type="number" value={champFilters.maxPrice} onChange={(event) => setChampFilters((current) => ({ ...current, maxPrice: event.target.value }))} placeholder="0" /></label>
                <label><span>Prêmio mínimo</span><input inputMode="decimal" min="0" type="number" value={champFilters.minPrize} onChange={(event) => setChampFilters((current) => ({ ...current, minPrize: event.target.value }))} placeholder="R$" /></label>
                <button type="button" className={champFilters.withPrize ? 'active' : ''} onClick={() => toggleChampFilter('withPrize')}>Com premiação</button>
                <button type="button" className={champFilters.live ? 'active' : ''} onClick={() => toggleChampFilter('live')}>Com transmissão</button>
                {hasChampFilters(champFilters) ? <button type="button" className="directory-market-clear" onClick={() => setChampFilters(emptyChampFilters)}><X size={14} /> Limpar filtros</button> : null}
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
          participatingChampionshipIds={participatingChampionshipIds}
          followHrefByChampionship={followHrefByChampionship}
          purchaseByChampionship={purchaseByChampionship}
          wishlistIds={wishlistIds}
          cartIds={cartIds}
          pendingWishlistIds={pendingWishlistIds}
          pendingCartIds={pendingCartIds}
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
