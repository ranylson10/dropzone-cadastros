'use client'

import { Input as UiInput, Select as UiSelect } from '@/components/ui/Field'
import { Heart, Search, ShoppingCart, SlidersHorizontal, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { ChampionshipListRow } from '@/components/championship'
import { EntityListRow } from '@/components/entities'
import { championshipCommerceItem, useCommerce, type LocalCommerceItem } from '@/features/commerce'
import { cachedStorageMediaUrl } from '@/lib/upload-public'
import type { DirectoryItem } from '../types'
import { registrationPriceLabel } from '@/lib/registration-price'

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

function prizeLabel(value: unknown) {
  const number = Number(value)
  if (!Number.isFinite(number) || number <= 0) return '—'
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(number)
}

function dateLabel(value: unknown) {
  const raw = String(value || '').trim()
  if (!raw) return 'A confirmar'
  const date = new Date(raw.length === 10 ? `${raw}T12:00:00` : raw)
  if (Number.isNaN(date.getTime())) return 'A confirmar'
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '')
}

function numericAmount(value: unknown): number | null {
  if (value == null || String(value).trim() === '') return null
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 ? number : null
}

function moneyNumber(value: unknown) {
  return numericAmount(value) ?? 0
}

function championshipFormat(item: DirectoryItem) {
  const format = getMetaValue(item, 'Formato')
  if (format !== '—') return format
  const type = getMetaValue(item, 'Tipo')
  return type !== '—' ? type : item.eyebrow || 'Competição'
}

function commerceItemFromDirectory(item: DirectoryItem, sellerManagerId?: string | null): LocalCommerceItem {
  return championshipCommerceItem({
    id: item.id,
    name: item.name,
    href: `/${item.kind}/${item.id}`,
    image: item.image,
    banner: item.banner,
    price: moneyNumber(item.commercial?.valor_inscricao),
    freeSlots: Number(item.commercial?.vagas_livres ?? 0),
  }, sellerManagerId ? { origin: 'vendedor', sellerManagerId } : undefined)
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

type MarketSort = 'soon' | 'prize' | 'price' | 'price-high' | 'vacancies'

type ChampFilters = {
  type: string
  openVacancies: boolean
  today: boolean
  free: boolean
  lastVacancies: boolean
  live: boolean
  withPrize: boolean
  mine: boolean
  favorites: boolean
  minPrice: string
  maxPrice: string
  minPrize: string
  maxPrize: string
  platform: string
  server: string
}

const emptyChampFilters: ChampFilters = {
  type: '',
  openVacancies: false,
  today: false,
  free: false,
  lastVacancies: false,
  live: false,
  withPrize: false,
  mine: false,
  favorites: false,
  minPrice: '',
  maxPrice: '',
  minPrize: '',
  maxPrize: '',
  platform: '',
  server: '',
}

function hasChampFilters(filters: ChampFilters) {
  return Boolean(
    filters.type || filters.openVacancies
    || filters.today
    || filters.free
    || filters.lastVacancies
    || filters.live
    || filters.withPrize
    || filters.mine
    || filters.favorites
    || filters.minPrice
    || filters.maxPrice
    || filters.minPrize
    || filters.maxPrize
    || filters.platform
    || filters.server,
  )
}

function filterChampionships(
  items: DirectoryItem[],
  filters: ChampFilters,
  myChampionshipIds: Set<string>,
  wishlistIds: Set<string>,
  producerScopeId: string,
  sellerScopeId: string,
  sellerAllowedIds: Set<string> | null,
) {
  const minPrice = filters.minPrice ? Number(filters.minPrice) : null
  const maxPrice = filters.maxPrice ? Number(filters.maxPrice) : null
  const minPrize = filters.minPrize ? Number(filters.minPrize) : null
  const maxPrize = filters.maxPrize ? Number(filters.maxPrize) : null
  const platform = filters.platform.trim().toLowerCase()
  const server = filters.server.trim().toLowerCase()

  return items.filter((item) => {
    const price = numericAmount(item.commercial?.valor_inscricao)
    const prize = numericAmount(item.commercial?.premiacao)
    const freeSlots = Number(item.commercial?.vagas_livres ?? 0)
    if (filters.type && String(item.commercial?.tipo || item.eyebrow || '').trim().toLowerCase() !== filters.type) return false

    if (producerScopeId && String(item.producerId || '') !== producerScopeId) return false
    if (sellerScopeId && (!sellerAllowedIds || !sellerAllowedIds.has(item.id))) return false
    if (filters.mine && !myChampionshipIds.has(item.id)) return false
    if (filters.favorites && !wishlistIds.has(item.id)) return false
    if (filters.openVacancies && freeSlots <= 0) return false
    if (filters.today && !isToday(item.commercial?.data_jogo || item.commercial?.data_limite_inscricao)) return false
    if (filters.free && price !== 0) return false
    if (filters.lastVacancies && !(freeSlots > 0 && freeSlots <= 3)) return false
    if (filters.live && !item.commercial?.tem_live) return false
    if (filters.withPrize && !(prize != null && prize > 0)) return false
    if ((minPrice != null && Number.isFinite(minPrice)) || (maxPrice != null && Number.isFinite(maxPrice))) {
      if (price == null) return false
      if (minPrice != null && Number.isFinite(minPrice) && price < minPrice) return false
      if (maxPrice != null && Number.isFinite(maxPrice) && price > maxPrice) return false
    }
    if ((minPrize != null && Number.isFinite(minPrize)) || (maxPrize != null && Number.isFinite(maxPrize))) {
      if (prize == null) return false
      if (minPrize != null && Number.isFinite(minPrize) && prize < minPrize) return false
      if (maxPrize != null && Number.isFinite(maxPrize) && prize > maxPrize) return false
    }
    if (platform && String(item.commercial?.plataforma || '').trim().toLowerCase() !== platform) return false
    if (server && String(item.commercial?.servidor || '').trim().toLowerCase() !== server) return false
    return true
  })
}

function uniqueOptions(items: DirectoryItem[], field: 'plataforma' | 'servidor') {
  return Array.from(new Set(items.map((item) => String(item.commercial?.[field] || '').trim()).filter(Boolean)))
    .sort((a, b) => a.localeCompare(b, 'pt-BR'))
}

export function DirectoryListClient({ items, kind }: { items: DirectoryItem[]; kind?: DirectoryItem['kind'] }) {
  const [query, setQuery] = useState('')
  const [visibleCount, setVisibleCount] = useState(24)
  const [entitySort, setEntitySort] = useState<'az' | 'za'>('az')
  const [champFilters, setChampFilters] = useState<ChampFilters>(emptyChampFilters)
  const [myChampionshipIds, setMyChampionshipIds] = useState<Set<string>>(new Set())
  const [participatingChampionshipIds, setParticipatingChampionshipIds] = useState<Set<string>>(new Set())
  const [purchaseByChampionship, setPurchaseByChampionship] = useState<Map<string, UserCompetitionPurchase>>(new Map())
  const [sortMode, setSortMode] = useState<MarketSort>('soon')
  const [producerScopeId, setProducerScopeId] = useState('')
  const [sellerScopeId, setSellerScopeId] = useState('')
  const [sellerAllowedIds, setSellerAllowedIds] = useState<Set<string> | null>(null)
  const [scopeLabel, setScopeLabel] = useState('')
  const [scopeLoading, setScopeLoading] = useState(false)
  const [scopeError, setScopeError] = useState('')
  const isChampionshipDirectory = kind === 'campeonatos' || items[0]?.kind === 'campeonatos'
  const {
    wishlistItems,
    cartIds,
    wishlistIds,
    pendingCartIds,
    pendingWishlistIds,
    accessToken,
    authenticated,
    error: commerceError,
    cartQuantity,
    toggleCart,
    toggleWishlist,
  } = useCommerce()

  useEffect(() => {
    if (!isChampionshipDirectory) return
    const params = new URLSearchParams(window.location.search)
    const initialQuery = String(params.get('q') || '').trim()
    const producerId = String(params.get('produtora') || '').trim()
    const sellerId = String(params.get('vendedor') || '').trim()

    if (initialQuery) setQuery(initialQuery)
    const rawType = String(params.get('tipo') || '').trim().toLowerCase()
    const type = ({ sala: 'diario', x1: 'confronto' } as Record<string, string>)[rawType] || rawType
    if (['diario', 'copa', 'liga', 'xtreino', 'confronto'].includes(type)) setChampFilters(current => ({ ...current, type }))
    if (params.get('vagas') === '1') setChampFilters((current) => ({ ...current, openVacancies: true }))
    if (params.get('meus') === '1') setChampFilters((current) => ({ ...current, mine: true }))
    if (params.get('favoritos') === '1') setChampFilters((current) => ({ ...current, favorites: true }))
    if (params.get('gratis') === '1') setChampFilters((current) => ({ ...current, free: true }))
    if (params.get('hoje') === '1') setChampFilters((current) => ({ ...current, today: true }))
    if (params.get('ultimas') === '1') setChampFilters((current) => ({ ...current, lastVacancies: true }))
    if (params.get('live') === '1') setChampFilters((current) => ({ ...current, live: true }))
    if (params.get('premio') === '1') setChampFilters((current) => ({ ...current, withPrize: true }))
    if (params.get('plataforma')) setChampFilters((current) => ({ ...current, platform: String(params.get('plataforma')) }))
    if (params.get('servidor')) setChampFilters((current) => ({ ...current, server: String(params.get('servidor')) }))

    const order = params.get('ordem')
    if (order === 'premio') setSortMode('prize')
    if (order === 'preco') setSortMode('price')
    if (order === 'preco-maior') setSortMode('price-high')
    if (order === 'vagas') setSortMode('vacancies')

    setProducerScopeId(producerId)
    setSellerScopeId(sellerId)
    setScopeError('')

    if (producerId) {
      const producer = items.find((item) => String(item.producerId || '') === producerId)
      setScopeLabel(producer?.producerName || 'Produtora selecionada')
    } else if (!sellerId) {
      setScopeLabel('')
    }

    if (!sellerId) {
      setSellerAllowedIds(null)
      setScopeLoading(false)
      return
    }

    let alive = true
    setScopeLoading(true)
    setSellerAllowedIds(new Set())
    void fetch(`/api/vagas?vendedor=${encodeURIComponent(sellerId)}`, { cache: 'no-store' })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(payload.error || 'Não foi possível carregar o catálogo do vendedor.')
        if (!alive) return
        setSellerAllowedIds(new Set((payload.announcements || []).map((item: any) => String(item.id || '')).filter(Boolean)))
        setScopeLabel(String(payload.scope?.nome || 'Vendedor selecionado'))
      })
      .catch((cause: any) => {
        if (!alive) return
        setSellerAllowedIds(new Set())
        setScopeError(cause?.message || 'Não foi possível carregar o catálogo do vendedor.')
      })
      .finally(() => {
        if (alive) setScopeLoading(false)
      })

    return () => { alive = false }
  }, [isChampionshipDirectory, items])

  useEffect(() => {
    if (!isChampionshipDirectory) return
    if (!accessToken) {
      setParticipatingChampionshipIds(new Set())
      setPurchaseByChampionship(new Map())
      setMyChampionshipIds(new Set())
      return
    }
    let alive = true
    void fetch('/api/me/competicoes', { cache: 'no-store', headers: { Authorization: `Bearer ${accessToken}` } }).catch(() => null).then(async (journeyResponse) => {
      const journeyPayload = journeyResponse?.ok ? await journeyResponse.json().catch(() => null) : null
      if (!alive) return
      const teamJourney = journeyPayload?.team || []
      const playerJourney = journeyPayload?.player || []
      const participating = new Set<string>([...teamJourney, ...playerJourney].map((row: any) => String(row.campeonato_id || '')).filter(Boolean))
      const purchases = new Map<string, UserCompetitionPurchase>()
      for (const row of journeyPayload?.purchases || []) {
        const championshipId = String(row.campeonato_id || '')
        if (championshipId && !purchases.has(championshipId)) purchases.set(championshipId, row)
      }
      setParticipatingChampionshipIds(participating)
      setPurchaseByChampionship(purchases)
      setMyChampionshipIds(new Set<string>([...participating, ...purchases.keys()]))
    })
    return () => { alive = false }
  }, [accessToken, isChampionshipDirectory])

  const filtered = useMemo(() => {
    const clean = query.trim().toLowerCase()
    const queryItems = clean ? items.filter((item) => item.searchText.includes(clean)) : items
    if (!isChampionshipDirectory) return [...queryItems].sort((a, b) => entitySort === 'az'
      ? a.name.localeCompare(b.name, 'pt-BR')
      : b.name.localeCompare(a.name, 'pt-BR'))

    return filterChampionships(queryItems, champFilters, myChampionshipIds, wishlistIds, producerScopeId, sellerScopeId, sellerAllowedIds)
      .sort((a, b) => {
        if (sortMode === 'prize') return moneyNumber(b.commercial?.premiacao) - moneyNumber(a.commercial?.premiacao) || a.name.localeCompare(b.name, 'pt-BR')
        if (sortMode === 'price' || sortMode === 'price-high') {
          const aPrice = numericAmount(a.commercial?.valor_inscricao)
          const bPrice = numericAmount(b.commercial?.valor_inscricao)
          if (aPrice == null && bPrice != null) return 1
          if (aPrice != null && bPrice == null) return -1
          if (aPrice != null && bPrice != null && aPrice !== bPrice) return sortMode === 'price' ? aPrice - bPrice : bPrice - aPrice
          return a.name.localeCompare(b.name, 'pt-BR')
        }
        if (sortMode === 'vacancies') return Number(b.commercial?.vagas_livres || 0) - Number(a.commercial?.vagas_livres || 0) || a.name.localeCompare(b.name, 'pt-BR')
        const aFree = Number(a.commercial?.vagas_livres || 0)
        const bFree = Number(b.commercial?.vagas_livres || 0)
        if (Boolean(aFree) !== Boolean(bFree)) return bFree > 0 ? 1 : -1
        const aDate = String(a.commercial?.data_jogo || '9999-12-31')
        const bDate = String(b.commercial?.data_jogo || '9999-12-31')
        return aDate.localeCompare(bDate) || a.name.localeCompare(b.name, 'pt-BR')
      })
  }, [champFilters, entitySort, isChampionshipDirectory, items, myChampionshipIds, producerScopeId, query, sellerAllowedIds, sellerScopeId, sortMode, wishlistIds])

  useEffect(() => { setVisibleCount(24) }, [filtered])

  const metaLabels = useMemo(() => getMetaLabels(items), [items])
  const platformOptions = useMemo(() => uniqueOptions(items, 'plataforma'), [items])
  const serverOptions = useMemo(() => uniqueOptions(items, 'servidor'), [items])
  const toggleChampFilter = (key: keyof Pick<ChampFilters, 'openVacancies' | 'today' | 'free' | 'lastVacancies' | 'live' | 'withPrize' | 'mine' | 'favorites'>) => {
    setChampFilters((current) => ({ ...current, [key]: !current[key] }))
  }
  const handleCartToggle = (item: DirectoryItem) => {
    const sellerManagerId = sellerScopeId || null
    const origin = sellerManagerId ? 'vendedor' : 'direto'
    void toggleCart(commerceItemFromDirectory(item, sellerManagerId), { origin, sellerManagerId })
  }
  const handleWishlistToggle = (item: DirectoryItem) => {
    const origin = sellerScopeId ? 'vendedor' : 'direto'
    void toggleWishlist(commerceItemFromDirectory(item, sellerScopeId || null), { origin })
  }

  return (
    <>
      {isChampionshipDirectory ? (
        <>
          <section className="championship-directory-controls" aria-label="Busca e filtros de campeonatos">
            <div className="championship-directory-tools">
              <label className="directory-search championship-directory-search">
                <Search size={18} />
                <UiInput value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar campeonato, produtora, formato..." />
              </label>
              <a className="championship-directory-icon-link" href="/carrinho" aria-label={`Abrir carrinho com ${cartQuantity} vagas`}><ShoppingCart size={18} /><b>{cartQuantity}</b></a>
              <details className="championship-directory-favorites">
                <summary aria-label="Favoritos"><Heart size={18} /><b>{wishlistItems.length}</b></summary>
                <div>{wishlistItems.length ? wishlistItems.slice(0, 8).map((item) => <a href={item.href} key={item.id}>{item.name}</a>) : <p>Nenhum favorito ainda.</p>}</div>
              </details>
            </div>

            <div className="championship-directory-filterbar">
              <div className="championship-directory-chips">
                <button type="button" className={champFilters.openVacancies ? 'active' : ''} onClick={() => toggleChampFilter('openVacancies')}>Vagas abertas</button>
                <button type="button" className={champFilters.today ? 'active' : ''} onClick={() => toggleChampFilter('today')}>Hoje</button>
                <button type="button" className={champFilters.free ? 'active' : ''} onClick={() => toggleChampFilter('free')}>Grátis</button>
                <button type="button" className={champFilters.lastVacancies ? 'active' : ''} onClick={() => toggleChampFilter('lastVacancies')}>Últimas vagas</button>
                <button type="button" className={champFilters.withPrize ? 'active' : ''} onClick={() => toggleChampFilter('withPrize')}>Com premiação</button>
                <button type="button" className={champFilters.live ? 'active' : ''} onClick={() => toggleChampFilter('live')}>Com transmissão</button>
                {authenticated ? <button type="button" className={champFilters.mine ? 'active' : ''} onClick={() => toggleChampFilter('mine')}>Meus</button> : null}
                <button type="button" className={champFilters.favorites ? 'active' : ''} onClick={() => toggleChampFilter('favorites')}>Favoritos</button>
              </div>

              <label className="championship-directory-sort"><span>Ordenar</span><UiSelect value={sortMode} onChange={(event) => setSortMode(event.target.value as MarketSort)}><option value="soon">Próximos jogos</option><option value="vacancies">Mais vagas</option><option value="prize">Maior premiação</option><option value="price">Menor inscrição</option><option value="price-high">Maior inscrição</option></UiSelect></label>

              <details className="championship-directory-more">
                <summary><SlidersHorizontal size={15} /> Mais filtros</summary>
                <div className="championship-directory-filter-fields">
                  <label><span>Tipo de campeonato</span><UiSelect value={champFilters.type} onChange={event => setChampFilters(current => ({ ...current, type: event.target.value }))}><option value="">Todos</option><option value="copa">Copas</option><option value="liga">Ligas</option><option value="diario">Salas diárias</option><option value="xtreino">XTreino</option><option value="confronto">Confrontos / X1</option></UiSelect></label>
                  <label><span>Inscrição mínima</span><UiInput inputMode="decimal" min="0" type="number" value={champFilters.minPrice} onChange={(event) => setChampFilters((current) => ({ ...current, minPrice: event.target.value }))} placeholder="R$ 0" /></label>
                  <label><span>Inscrição máxima</span><UiInput inputMode="decimal" min="0" type="number" value={champFilters.maxPrice} onChange={(event) => setChampFilters((current) => ({ ...current, maxPrice: event.target.value }))} placeholder="R$" /></label>
                  <label><span>Premiação mínima</span><UiInput inputMode="decimal" min="0" type="number" value={champFilters.minPrize} onChange={(event) => setChampFilters((current) => ({ ...current, minPrize: event.target.value }))} placeholder="R$ 0" /></label>
                  <label><span>Premiação máxima</span><UiInput inputMode="decimal" min="0" type="number" value={champFilters.maxPrize} onChange={(event) => setChampFilters((current) => ({ ...current, maxPrize: event.target.value }))} placeholder="R$" /></label>
                  <label><span>Plataforma</span><UiSelect value={champFilters.platform} onChange={(event) => setChampFilters((current) => ({ ...current, platform: event.target.value }))}><option value="">Todas</option>{platformOptions.map((option) => <option key={option} value={option}>{option}</option>)}</UiSelect></label>
                  <label><span>Servidor</span><UiSelect value={champFilters.server} onChange={(event) => setChampFilters((current) => ({ ...current, server: event.target.value }))}><option value="">Todos</option>{serverOptions.map((option) => <option key={option} value={option}>{option}</option>)}</UiSelect></label>
                  {hasChampFilters(champFilters) ? <button type="button" className="championship-directory-clear" onClick={() => setChampFilters(emptyChampFilters)}><X size={14} /> Limpar filtros</button> : null}
                </div>
              </details>
            </div>

            {scopeLabel || scopeError || scopeLoading ? (
              <div className="championship-directory-scope" role="status">
                <span>{scopeLoading ? 'Carregando seleção...' : scopeError || <>Mostrando campeonatos de <strong>{scopeLabel}</strong></>}</span>
                {(producerScopeId || sellerScopeId) ? <a href="/campeonatos">Ver todos</a> : null}
              </div>
            ) : null}
          </section>

          {commerceError ? <p className="directory-commerce-error" role="alert">{commerceError}</p> : null}

          {filtered.length ? (
            <>
              <div className="dz-market-section-title" id="campeonatos-lista">
                <div><span className="dz-market-section-eyebrow">EXPLORE E PARTICIPE</span><h2>Campeonatos disponíveis</h2></div>
                <span aria-live="polite">{filtered.length} resultado{filtered.length === 1 ? '' : 's'}</span>
              </div>
              <div className={`directory-list championship-directory-list is-card-grid ${filtered.length <= 3 ? 'is-short-list' : ''}`}>
                {filtered.slice(0, visibleCount).map((item) => {
                  const free = item.commercial?.vagas_livres == null ? null : Math.max(0, Number(item.commercial.vagas_livres))
                  const total = item.commercial?.total_vagas == null ? null : Math.max(0, Number(item.commercial.total_vagas))
                  const hasCheckoutPrice = numericAmount(item.commercial?.valor_inscricao) != null
                  const isParticipating = participatingChampionshipIds.has(item.id)
                  const purchase = purchaseByChampionship.get(item.id)
                  const href = `/${item.kind}/${item.id}`
                  const imageUrl = cachedStorageMediaUrl(item.banner || item.image || '') || null
                  const statusLabel = free == null ? 'Vagas a confirmar' : free > 0 && free <= 3 ? 'Últimas vagas' : free > 0 ? 'Vagas abertas' : 'Sem vagas'
                  const participationLabel = isParticipating ? 'Você participa' : purchase ? 'Vaga comprada' : null
                  const registrationLabel = registrationPriceLabel(item.commercial?.valor_inscricao)
                  const rewardsLabel = prizeLabel(item.commercial?.premiacao)
                  const nextDate = dateLabel(item.commercial?.data_jogo || item.commercial?.data_limite_inscricao)
                    return (
                      <ChampionshipListRow
                        key={item.id}
                        championship={{
                          id: item.id,
                          name: item.name,
                          href,
                          imageUrl,
                          isBannerImage: Boolean(item.banner),
                          producerLabel: item.producerName || 'Produtora DropZone',
                          formatLabel: championshipFormat(item),
                          freeSlots: free,
                          totalSlots: total,
                          statusLabel,
                          participationLabel,
                          priceLabel: registrationLabel,
                          prizeLabel: rewardsLabel,
                          nextDateLabel: nextDate,
                        }}
                        favorite={wishlistIds.has(item.id)}
                        inCart={cartIds.has(item.id)}
                        favoritePending={pendingWishlistIds.has(item.id)}
                        cartPending={pendingCartIds.has(item.id)}
                        cartDisabled={((free ?? 0) <= 0 || !hasCheckoutPrice) && !cartIds.has(item.id)}
                        onFavorite={() => handleWishlistToggle(item)}
                        onCart={() => handleCartToggle(item)}
                      />
                    )
                })}
              </div>
              {filtered.length > visibleCount ? <button type="button" className="button secondary" onClick={() => setVisibleCount(count => count + 24)}>Mostrar mais campeonatos ({visibleCount} de {filtered.length})</button> : null}
            </>
          ) : <div className="directory-empty championship-directory-empty">Nenhum campeonato encontrado com esses filtros.</div>}
        </>
      ) : (
        <>
          <div className="directory-toolbar directory-v1-toolbar">
            <label className="directory-search">
              <Search size={17} aria-hidden="true" />
              <UiInput value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Buscar perfis" placeholder="Buscar por nome, usuário, tag ou localidade..." />
            </label>
            <span className="directory-v1-results" role="status" aria-live="polite"><strong>{filtered.length}</strong> resultado{filtered.length === 1 ? '' : 's'}</span>
            <label className="directory-v1-sort"><span>Ordenar</span>
              <UiSelect value={entitySort} onChange={(event) => setEntitySort(event.target.value as 'az' | 'za')} aria-label="Ordenar resultados">
                <option value="az">Nome A–Z</option>
                <option value="za">Nome Z–A</option>
              </UiSelect>
            </label>
          </div>

          {filtered.length ? (
            <div className="dz-directory-table-head dz-directory-table-head--entity" aria-hidden="true">
              <span>Perfil</span>
              <span>Detalhes</span>
              <span>{metaLabels[0] || 'Indicador 1'}</span>
              <span>{metaLabels[1] || 'Indicador 2'}</span>
              <span>{metaLabels[2] || 'Indicador 3'}</span>
              <span>Abrir</span>
            </div>
          ) : null}

          <div className={`directory-list directory-list-${items[0]?.kind || 'empty'} directory-list--table`}>
            {filtered.map((item) => (
              <EntityListRow
                key={item.id}
                kind={item.kind as 'equipes' | 'jogadores' | 'produtoras' | 'managers'}
                href={`/${item.kind}/${item.id}`}
                name={item.name}
                image={item.image}
                eyebrow={item.eyebrow}
                username={item.username}
                description={item.description}
                meta={metaLabels.map((label) => ({ label, value: getMetaValue(item, label) }))}
                className="dz-entity-row--table"
              />
            ))}
          </div>
          {!filtered.length ? <div className="directory-empty">Nenhum resultado encontrado.</div> : null}
        </>
      )}
    </>
  )
}
